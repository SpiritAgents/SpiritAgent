import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import {
  SessionPump,
  sessionBundleNeedsPumpTick,
} from '../../dist-electron/src/host/session-pump.js';
import { pumpSessionsCommand } from '../../dist-electron/src/host/session-turn-orchestrator.js';

function createFakeRuntime({ pollsUntilIdle }) {
  const runtime = {
    pollCount: 0,
    busy: true,
    isBusy: () => runtime.busy,
    poll: async () => {
      runtime.pollCount += 1;
      if (runtime.pollCount >= pollsUntilIdle) {
        runtime.busy = false;
      }
    },
    tickThinkingSpinner: () => {},
    drainEvents: () => [],
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
  const runtime = createFakeRuntime({ pollsUntilIdle: 3 });
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
  assert.ok(calls.filter((entry) => entry === 'persist').length >= 3);

  // 全部空闲后 ensureRunning 不应重启泵。
  pump.ensureRunning();
  assert.equal(pump.isRunning(), false);
  assert.equal(runtime.pollCount, 3);
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
