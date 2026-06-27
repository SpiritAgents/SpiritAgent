import assert from 'node:assert/strict';
import test from 'node:test';

import type { ToolAgentActiveSkill } from '../tool-agent.js';
import {
  formatActiveSkillUserMessageMeta,
  formatUserMessageContentForLlm,
  userMessageContentMatchesInput,
} from './user-turn-timestamp.js';

const sampleSkill: ToolAgentActiveSkill = {
  id: 'skill:test',
  scope: 'workspace',
  name: 'test',
  description: 'Test skill',
  path: '/tmp/test/SKILL.md',
  content: '# Test\nDo the thing.',
  truncated: false,
  resources: [],
  resourcesTruncated: false,
};

test('formatUserMessageContentForLlm uses meta-style English timestamp line', () => {
  const formatted = formatUserMessageContentForLlm('hello');
  const newline = formatted.indexOf('\n');
  assert.ok(newline > 0);
  const firstLine = formatted.slice(0, newline);
  assert.match(firstLine, /^<user_message_at>.+<\/user_message_at>$/);
  assert.equal(formatted.slice(newline + 1), 'hello');
});

test('formatUserMessageContentForLlm prepends active_skill meta before timestamp', () => {
  const formatted = formatUserMessageContentForLlm('hello', [sampleSkill]);
  assert.match(formatted, /^<active_skill>\n/);
  assert.match(formatted, /<content>\n# Test\nDo the thing.\n<\/content>/);
  assert.match(formatted, /<\/active_skill>\n<user_message_at>.+<\/user_message_at>\nhello$/);
});

test('formatActiveSkillUserMessageMeta returns undefined for empty skills', () => {
  assert.equal(formatActiveSkillUserMessageMeta([]), undefined);
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

test('userMessageContentMatchesInput strips active_skill and timestamp lines', () => {
  const formatted = formatUserMessageContentForLlm('Hi', [sampleSkill]);
  assert.equal(userMessageContentMatchesInput(formatted, 'Hi'), true);
});
