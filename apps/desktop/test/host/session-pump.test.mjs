import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import {
  SessionPump,
  sessionBundleNeedsPumpTick,
} from '../../dist-electron/src/host/session-pump.js';
import { pumpSessionsCommand } from '../../dist-electron/src/host/session-turn-orchestrator.js';

function createFakeRuntime({ pollsUntilIdle, chunkPerPoll = false }) {
  const runtime = {
    pollCount: 0,
    busy: true,
    pendingEvents: [],
    isBusy: () => runtime.busy,
    poll: async () => {
      runtime.pollCount += 1;
      if (chunkPerPoll) {
        runtime.pendingEvents.push({ kind: 'assistant-chunk', text: `chunk-${runtime.pollCount}` });
      }
      if (runtime.pollCount >= pollsUntilIdle) {
        runtime.busy = false;
      }
    },
    tickThinkingSpinner: () => {},
    drainEvents: () => runtime.pendingEvents.splice(0, runtime.pendingEvents.length),
    drainActiveChildSessionEvents: () => [],
    childSessionArchives: () => [],
    currentPendingApproval: () => undefined,
    currentPendingQuestions: () => undefined,
  };
  return runtime;
}

function createFakeBundle(runtime) {
  return {
    id: 'session-pump-test',
    workspaceRoot: '/tmp/workspace',
    runtime,
    messages: [],
    messageTimeline: { toMessages: () => [] },
    deferredRuntimeHostEvents: [],
    responsesBuiltInPreviewSeenCallIds: new Set(),
    conversationRevision: 0,
    queuedUserTurns: [],
    subagentDesktopMessagesBySessionId: new Map(),
    subagentConversationProjections: new Map(),
  };
}

function createFakeOrchestratorContext(bundle, calls) {
  const runtimeEvents = {
    applyRuntimeHostEvents: () => {},
    consumeCompletedTurnResult: () => {},
    syncPendingToolStates: () => {},
    syncAssistantPrefixFromHistoryBeforeToolRow: () => {},
  };
  return {
    runSerialized: async (work) => work(),
    ensureInitialized: async () => {
      calls.push('ensureInitialized');
    },
    allBundles: () => [bundle],
    getActiveBundle: () => bundle,
    activeSessionId: () => 'other-session',
    orchestrationFor: () => ({ runtimeEvents }),
    syncSubagentToolStreamingOutput: () => {},
    persistSessionBundle: async () => {
      calls.push('persist');
    },
    flushDeferredRuntimeRefreshIfIdle: async () => {},
    refreshTodoSnapshotForBundle: async () => {},
    syncActiveRuntimePointer: () => {},
    startDreamCollectorIfNeeded: () => {},
    emitLiveSnapshotUpdate: () => {},
    requestLiveSnapshotEmit: () => {
      calls.push('request-emit');
    },
    persistCurrentSessionIfNeeded: async () => {},
  };
}

async function waitUntil(predicate, { timeoutMs = 2_000, stepMs = 10 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await delay(stepMs);
  }
  throw new Error('waitUntil timed out');
}

test('sessionBundleNeedsPumpTick tracks runtime busy state', () => {
  const runtime = createFakeRuntime({ pollsUntilIdle: 1 });
  const bundle = createFakeBundle(runtime);
  assert.equal(sessionBundleNeedsPumpTick(bundle), true);
  runtime.busy = false;
  assert.equal(sessionBundleNeedsPumpTick(bundle), false);
  assert.equal(sessionBundleNeedsPumpTick(createFakeBundle(undefined)), false);
});

test('pump drives a busy streaming round to completion without external poll', async () => {
  const runtime = createFakeRuntime({ pollsUntilIdle: 3, chunkPerPoll: true });
  const bundle = createFakeBundle(runtime);
  const calls = [];
  const ctx = createFakeOrchestratorContext(bundle, calls);

  const pump = new SessionPump({
    hasPumpWork: () => sessionBundleNeedsPumpTick(bundle),
    runTick: () => pumpSessionsCommand(ctx),
    intervalMs: 5,
  });

  pump.ensureRunning();
  assert.equal(pump.isRunning(), true);
  // 泵运行中重复 ensureRunning 应为幂等，不得叠加第二个循环。
  pump.ensureRunning();

  await waitUntil(() => !pump.isRunning());
  assert.equal(runtime.busy, false);
  assert.equal(runtime.pollCount, 3);
  // 落盘节流：首 tick（超时间片）+ 回合终态强制，共 2 次；中途 tick 不落盘。
  assert.equal(calls.filter((entry) => entry === 'persist').length, 2);
  // 每次 tick 应用了 assistant-chunk 事件 → 应请求节流推送，且 revision 递增。
  assert.ok(calls.filter((entry) => entry === 'request-emit').length >= 3);
  assert.equal(bundle.conversationRevision, 3);

  // 全部空闲后 ensureRunning 不应重启泵。
  pump.ensureRunning();
  assert.equal(pump.isRunning(), false);
  assert.equal(runtime.pollCount, 3);
});

test('tick persist is throttled while busy and forced at turn end', async () => {
  const runtime = createFakeRuntime({ pollsUntilIdle: 4 });
  const bundle = createFakeBundle(runtime);
  // 模拟回合开始前刚落过盘：1s 时间片内 busy tick 均不应再写盘。
  bundle.lastTickPersistAtMs = Date.now();
  const calls = [];
  const ctx = createFakeOrchestratorContext(bundle, calls);

  const pump = new SessionPump({
    hasPumpWork: () => sessionBundleNeedsPumpTick(bundle),
    runTick: () => pumpSessionsCommand(ctx),
    intervalMs: 5,
  });

  pump.ensureRunning();
  await waitUntil(() => !pump.isRunning());
  assert.equal(runtime.pollCount, 4);
  // 仅回合终态（busy→idle）那一 tick 强制落盘。
  assert.equal(calls.filter((entry) => entry === 'persist').length, 1);
});

test('entering pending approval forces persist', async () => {
  const runtime = createFakeRuntime({ pollsUntilIdle: 1_000 });
  let approval;
  runtime.currentPendingApproval = () => approval;
  const basePoll = runtime.poll;
  runtime.poll = async () => {
    await basePoll();
    if (runtime.pollCount === 2) {
      approval = { toolName: 'shell' };
    }
  };
  const bundle = createFakeBundle(runtime);
  bundle.lastTickPersistAtMs = Date.now();
  const calls = [];
  const ctx = createFakeOrchestratorContext(bundle, calls);

  const pump = new SessionPump({
    hasPumpWork: () => sessionBundleNeedsPumpTick(bundle),
    runTick: () => pumpSessionsCommand(ctx),
    intervalMs: 5,
  });

  pump.ensureRunning();
  await waitUntil(() => runtime.pollCount >= 4);
  pump.stop();
  // 进入 pending approval 的那一 tick 强制落盘；其后阻塞 tick 在时间片内不再写。
  assert.equal(calls.filter((entry) => entry === 'persist').length, 1);
});

test('long streaming round: pump completes with bounded persist and steady emits', async () => {
  const totalPolls = 500;
  const runtime = createFakeRuntime({ pollsUntilIdle: totalPolls, chunkPerPoll: true });
  const bundle = createFakeBundle(runtime);
  bundle.lastTickPersistAtMs = Date.now();
  const calls = [];
  const ctx = createFakeOrchestratorContext(bundle, calls);

  const pump = new SessionPump({
    hasPumpWork: () => sessionBundleNeedsPumpTick(bundle),
    runTick: () => pumpSessionsCommand(ctx),
    intervalMs: 0,
  });

  pump.ensureRunning();
  await waitUntil(() => !pump.isRunning(), { timeoutMs: 30_000 });

  assert.equal(runtime.pollCount, totalPolls);
  assert.equal(bundle.conversationRevision, totalPolls);
  // 每 tick 均有事件 → 每 tick 请求一次节流推送（实际 IPC 推送频率由宿主节流器另行约束）。
  assert.equal(calls.filter((entry) => entry === 'request-emit').length, totalPolls);
  // 落盘按 1s 时间片 + 终态强制：远小于 tick 数。
  const persistCount = calls.filter((entry) => entry === 'persist').length;
  assert.ok(persistCount < 10, `persist ${persistCount} should be time-sliced`);
});

test('pump stop cancels pending tick', async () => {
  const runtime = createFakeRuntime({ pollsUntilIdle: 1_000 });
  const bundle = createFakeBundle(runtime);
  const ctx = createFakeOrchestratorContext(bundle, []);

  const pump = new SessionPump({
    hasPumpWork: () => sessionBundleNeedsPumpTick(bundle),
    runTick: () => pumpSessionsCommand(ctx),
    intervalMs: 5,
  });

  pump.ensureRunning();
  await waitUntil(() => runtime.pollCount >= 1);
  pump.stop();
  const countAtStop = runtime.pollCount;
  await delay(50);
  // stop 后不允许出现新的 tick（容忍 stop 时刻已在途的一次）。
  assert.ok(runtime.pollCount <= countAtStop + 1);
  assert.equal(pump.isRunning(), false);
});
