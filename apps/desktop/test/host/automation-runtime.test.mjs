import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildAutomationRemoteRuntimeCreateInput,
  buildEmptyAutomationArchive,
  createAutomationRuntime,
} from '../../dist-electron/src/host/automation-runtime.js';
import { desktopUsesDaemonRuntime } from '../../dist-electron/src/host/remote-runtime.js';

const sampleDefinition = {
  id: 'automation-test-id',
  title: 'Daily',
  overview: 'Run daily task',
  trigger: { kind: 'time', schedule: { kind: 'hourly' } },
  workspaceRoot: '/tmp/workspace',
  modelRef: { groupId: 'openai', name: 'gpt-test' },
  approvalLevel: 'full-approval',
  enabled: true,
  createdAtUnixMs: 1,
  updatedAtUnixMs: 1,
};

test('buildEmptyAutomationArchive seeds empty daemon session archive', () => {
  const archive = buildEmptyAutomationArchive('auto-approval');
  assert.deepEqual(archive.messages, []);
  assert.deepEqual(archive.assistantAux, []);
  assert.deepEqual(archive.llmHistory, []);
  assert.deepEqual(archive.subagentSessions, []);
  assert.equal(archive.loopEnabled, false);
  assert.equal(archive.approvalLevel, 'auto-approval');
});

test('buildAutomationRemoteRuntimeCreateInput aligns conversationKey with resolved session path', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'spirit-automation-runtime-'));
  const previousAppData = process.env.APPDATA;
  process.env.APPDATA = tempRoot;
  try {
    const sessionPath = path.join(tempRoot, 'chats', 'chat-automation-abc-123.json');
    const input = buildAutomationRemoteRuntimeCreateInput({
      definition: sampleDefinition,
      config: { activeModel: sampleDefinition.modelRef },
      sessionPath,
    });
    assert.equal(input.conversationKey, path.resolve(sessionPath));
    assert.equal(input.todoSessionKey, path.resolve(sessionPath));
    assert.equal(input.agentMode, 'agent');
    assert.deepEqual(input.modelRef, sampleDefinition.modelRef);
    assert.equal(input.approvalLevel, 'full-approval');
    assert.deepEqual(input.archive.llmHistory, []);
  } finally {
    if (previousAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = previousAppData;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('createAutomationRuntime requires in-process wiring when daemon is disabled', async () => {
  const previous = process.env.SPIRIT_INPROCESS_HOST;
  process.env.SPIRIT_INPROCESS_HOST = '1';
  try {
    assert.equal(desktopUsesDaemonRuntime(), false);
    await assert.rejects(
      () => createAutomationRuntime({
        definition: sampleDefinition,
        config: { activeModel: sampleDefinition.modelRef },
        sessionPath: '/tmp/chat-automation-test.json',
      }),
      /In-process automation runtime requires transport, metadata, and tool executor\./,
    );
  } finally {
    if (previous === undefined) {
      delete process.env.SPIRIT_INPROCESS_HOST;
    } else {
      process.env.SPIRIT_INPROCESS_HOST = previous;
    }
  }
});

test('desktopUsesDaemonRuntime defaults to daemon path', () => {
  const previous = process.env.SPIRIT_INPROCESS_HOST;
  delete process.env.SPIRIT_INPROCESS_HOST;
  try {
    assert.equal(desktopUsesDaemonRuntime(), true);
  } finally {
    if (previous === undefined) {
      delete process.env.SPIRIT_INPROCESS_HOST;
    } else {
      process.env.SPIRIT_INPROCESS_HOST = previous;
    }
  }
});
