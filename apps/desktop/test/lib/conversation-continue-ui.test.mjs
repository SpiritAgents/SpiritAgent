import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveTurnContinuePresentation } from '../../src/lib/conversation-continue-ui.ts';

test('resolveTurnContinuePresentation places Continue after tools in the turn', () => {
  const messages = [
    { id: 1, role: 'user', content: 'hi', pending: false },
    { id: 2, role: 'assistant', content: '', pending: false, canContinue: true, aux: { thinking: 'plan' } },
    { id: 3, role: 'assistant', content: '', pending: false, tool: { toolName: 'read_file', phase: 'running', headline: 'x', detailLines: [] } },
    { id: 4, role: 'assistant', content: '', pending: false, tool: { toolName: 'glob', phase: 'preview', headline: 'y', detailLines: [] } },
  ];
  const resolved = resolveTurnContinuePresentation(messages);
  assert.ok(resolved);
  assert.equal(resolved.continuableMessage.id, 2);
  assert.equal(resolved.showContinueAtIndex, 3);
});
