import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildStoredDesktopSession,
  restoreStoredSessionState,
  sessionListActivityFromBundle,
} from '../../dist-electron/src/host/sessions.js';
import { createDesktopRewindMetadata } from '../../dist-electron/src/host/rewind.js';

test('restoreStoredSessionState ignores malformed desktop timeline snapshots', () => {
  const desktopMessages = [
    {
      id: 1,
      role: 'user',
      content: 'Inspect this file',
      pending: false,
    },
  ];

  const restored = restoreStoredSessionState({
    filePath: 'D:/SpiritAgent/test-session.json',
    loaded: {
      llmHistory: [],
      subagentSessions: [],
      desktopMessages,
      desktopMessageTimeline: [
        {
          turnId: 1,
          createdOrder: 1,
          segments: null,
        },
      ],
    },
    fallbackMessages: [],
  });

  assert.deepEqual(restored.messages, desktopMessages);
  assert.equal(restored.desktopMessageTimeline, undefined);
});

test('buildStoredDesktopSession and restoreStoredSessionState roundtrip contextUsage', () => {
  const contextUsage = { inputTokens: 1200, contextLength: 128000, percent: 1 };
  const desktopMessages = [
    {
      id: 1,
      role: 'user',
      content: 'hello',
      pending: false,
    },
  ];
  const stored = buildStoredDesktopSession({
    archive: {
      messages: [],
      assistantAux: [],
      llmHistory: [],
      subagentSessions: [],
    },
    sessionDisplayName: 'hello',
    workspaceRoot: 'D:/SpiritAgent',
    desktopMessages,
    rewind: createDesktopRewindMetadata(),
    loopEnabled: false,
    approvalLevel: 'default',
    contextUsage,
  });

  assert.deepEqual(stored.contextUsage, contextUsage);

  const restored = restoreStoredSessionState({
    filePath: 'D:/SpiritAgent/test-session.json',
    loaded: stored,
    fallbackMessages: [],
  });

  assert.deepEqual(restored.contextUsage, contextUsage);
});

test('sessionListActivityFromBundle maps runtime busy states', () => {
  assert.deepEqual(sessionListActivityFromBundle(undefined), {});
  assert.deepEqual(
    sessionListActivityFromBundle({
      runtime: { isBusy: () => false },
    }),
    {},
  );
  assert.deepEqual(
    sessionListActivityFromBundle({
      runtime: {
        isBusy: () => true,
        hasPendingApproval: () => false,
        hasPendingQuestions: () => false,
      },
    }),
    { isBusy: true },
  );
  assert.deepEqual(
    sessionListActivityFromBundle({
      runtime: {
        isBusy: () => true,
        hasPendingApproval: () => true,
        hasPendingQuestions: () => false,
      },
    }),
    { isBusy: true, isBlocked: true },
  );
  assert.deepEqual(
    sessionListActivityFromBundle({
      runtime: {
        isBusy: () => true,
        hasPendingApproval: () => false,
        hasPendingQuestions: () => true,
      },
    }),
    { isBusy: true, isBlocked: true },
  );
});