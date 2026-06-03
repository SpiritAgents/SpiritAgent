import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatUserMessageContentForLlm,
  userMessageContentMatchesInput,
} from './user-turn-timestamp.js';

test('formatUserMessageContentForLlm uses meta-style English timestamp line', () => {
  const formatted = formatUserMessageContentForLlm('hello');
  const newline = formatted.indexOf('\n');
  assert.ok(newline > 0);
  const firstLine = formatted.slice(0, newline);
  assert.match(firstLine, /^<user_message_at>.+<\/user_message_at>$/);
  assert.equal(formatted.slice(newline + 1), 'hello');
});

test('userMessageContentMatchesInput strips meta timestamp line', () => {
  assert.equal(
    userMessageContentMatchesInput(
      '<user_message_at>2026-05-14T16:11:27.803+08:00</user_message_at>\nHi',
      'Hi',
    ),
    true,
  );
});
