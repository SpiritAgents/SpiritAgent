import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conversationMessageStableId,
  resolveConversationListScopeKey,
} from '../../src/lib/conversation-list-scope.ts';

test('resolveConversationListScopeKey isolates subagent viewer from main list', () => {
  assert.equal(
    resolveConversationListScopeKey({
      subagentViewActive: true,
      subagentToolCallId: 'call_abc',
      compactionDemoActive: false,
    }),
    'subagent:call_abc',
  );
  assert.equal(
    resolveConversationListScopeKey({
      subagentViewActive: false,
      subagentToolCallId: 'call_abc',
      compactionDemoActive: false,
    }),
    'main',
  );
});

test('conversationMessageStableId namespaces ids across list scopes', () => {
  const message = { id: 1, role: 'assistant', content: 'hi', pending: false };
  const sessionKey = 'session-1';
  const mainKey = conversationMessageStableId(message, sessionKey, 'main');
  const subagentKey = conversationMessageStableId(message, sessionKey, 'subagent:call_abc');
  assert.notEqual(mainKey, subagentKey);
  assert.match(mainKey, /:main:message-1-/);
  assert.match(subagentKey, /:subagent:call_abc:message-1-/);
});
