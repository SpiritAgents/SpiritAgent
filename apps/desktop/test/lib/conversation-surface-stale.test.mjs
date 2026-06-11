import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveEffectiveEmptySession,
  shouldClearConversationSnapshotStale,
  shouldHideStaleConversationMessages,
  shouldMarkConversationSnapshotStale,
  shouldSuppressStaleConversation,
} from '../../src/lib/conversation-surface-stale.ts';

test('shouldMarkConversationSnapshotStale marks non-conversation surfaces only', () => {
  assert.equal(shouldMarkConversationSnapshotStale('conversation'), false);
  assert.equal(shouldMarkConversationSnapshotStale('marketplace'), true);
  assert.equal(shouldMarkConversationSnapshotStale('settings'), true);
});

test('shouldClearConversationSnapshotStale clears on settled conversation surface', () => {
  assert.equal(
    shouldClearConversationSnapshotStale({
      activeSurface: 'marketplace',
      sessionNavigationBusy: false,
      newSessionBusy: false,
    }),
    false,
  );
  assert.equal(
    shouldClearConversationSnapshotStale({
      activeSurface: 'conversation',
      sessionNavigationBusy: true,
      newSessionBusy: false,
    }),
    false,
  );
  assert.equal(
    shouldClearConversationSnapshotStale({
      activeSurface: 'conversation',
      sessionNavigationBusy: false,
      newSessionBusy: false,
    }),
    true,
  );
});

test('shouldSuppressStaleConversation suppresses only stale in-flight conversation nav', () => {
  const base = {
    conversationSnapshotStale: true,
    activeSurface: 'conversation',
    sessionNavigationBusy: false,
    newSessionBusy: true,
  };
  assert.equal(shouldSuppressStaleConversation(base), true);
  assert.equal(
    shouldSuppressStaleConversation({ ...base, conversationSnapshotStale: false }),
    false,
  );
  assert.equal(
    shouldSuppressStaleConversation({ ...base, activeSurface: 'marketplace' }),
    false,
  );
  assert.equal(
    shouldSuppressStaleConversation({
      ...base,
      newSessionBusy: false,
      sessionNavigationBusy: false,
    }),
    false,
  );
});

test('resolveEffectiveEmptySession treats pending reset as empty even with stale messages', () => {
  assert.equal(
    resolveEffectiveEmptySession({
      sessionMessageCount: 4,
      subagentViewActive: false,
      compactionDemoActive: false,
      newSessionBusy: true,
    }),
    true,
  );
  assert.equal(
    resolveEffectiveEmptySession({
      sessionMessageCount: 4,
      subagentViewActive: false,
      compactionDemoActive: false,
      newSessionBusy: false,
    }),
    false,
  );
  assert.equal(
    resolveEffectiveEmptySession({
      sessionMessageCount: 0,
      subagentViewActive: false,
      compactionDemoActive: false,
      newSessionBusy: false,
    }),
    true,
  );
});

test('shouldHideStaleConversationMessages hides list while opening another session', () => {
  assert.equal(
    shouldHideStaleConversationMessages({
      suppressStaleConversation: true,
      sessionNavigationBusy: true,
    }),
    true,
  );
  assert.equal(
    shouldHideStaleConversationMessages({
      suppressStaleConversation: true,
      sessionNavigationBusy: false,
    }),
    false,
  );
});
