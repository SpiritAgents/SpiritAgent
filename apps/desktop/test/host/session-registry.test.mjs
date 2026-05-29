import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SessionRegistry } from '../../dist-electron/src/host/session-registry.js';
import { restoreStoredSessionState } from '../../dist-electron/src/host/sessions.js';

test('SessionRegistry tracks active bundle after upsertFromRestored', () => {
  const registry = new SessionRegistry();
  const restored = restoreStoredSessionState({
    filePath: 'D:/SpiritAgent/chats/test-session.json',
    loaded: {
      llmHistory: [],
      subagentSessions: [],
      desktopMessages: [
        { id: 1, role: 'user', content: 'hello', pending: false },
      ],
    },
    fallbackMessages: [],
  });

  const bundle = registry.upsertFromRestored(
    'D:/SpiritAgent/repo',
    restored,
    (messages) => ({
      toMessages: () => messages,
      snapshot: () => [],
    }),
  );

  assert.equal(registry.activeSessionId(), bundle.id);
  assert.equal(registry.requireActive().messages.length, 1);
  assert.equal(registry.requireActive().activeSession?.displayName, 'hello');
});

test('SessionRegistry resetActive clears conversation state', () => {
  const registry = new SessionRegistry();
  registry.ensureDraft('D:/SpiritAgent/repo');
  registry.resetActive('D:/SpiritAgent/repo');
  const bundle = registry.requireActive();
  assert.equal(bundle.messages.length, 0);
  assert.equal(bundle.activeSession, undefined);
});

test('SessionRegistry beginNewActive keeps prior bundle in memory', () => {
  const registry = new SessionRegistry();
  const filePath = 'D:/SpiritAgent/chats/session-a.json';
  const restored = restoreStoredSessionState({
    filePath,
    loaded: {
      llmHistory: [],
      subagentSessions: [],
      desktopMessages: [{ id: 1, role: 'user', content: 'keep me', pending: false }],
    },
    fallbackMessages: [],
  });
  registry.upsertFromRestored(
    'D:/SpiritAgent/repo',
    restored,
    (messages) => ({
      toMessages: () => messages,
      snapshot: () => [],
    }),
  );

  const first = registry.requireActive();
  const second = registry.beginNewActive('D:/SpiritAgent/repo');
  assert.notEqual(second.id, first.id);
  assert.equal(registry.get(first.id)?.messages[0]?.content, 'keep me');
  assert.equal(registry.activeSessionId(), second.id);
});
