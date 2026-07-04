import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatModelDisplayNameFromId } from './model-display-name.js';

test('formatModelDisplayNameFromId replaces separators and title-cases words', () => {
  assert.equal(formatModelDisplayNameFromId('gpt-4o-mini'), 'Gpt 4o Mini');
  assert.equal(formatModelDisplayNameFromId('anthropic/claude-sonnet-4'), 'Anthropic Claude Sonnet 4');
  assert.equal(formatModelDisplayNameFromId('foo:bar/baz'), 'Foo Bar Baz');
  assert.equal(formatModelDisplayNameFromId('  spaced--id  '), 'Spaced Id');
});

test('formatModelDisplayNameFromId merges consecutive numeric version segments', () => {
  assert.equal(formatModelDisplayNameFromId('claude-opus-4-8'), 'Claude Opus 4.8');
  assert.equal(formatModelDisplayNameFromId('claude-3-5-sonnet'), 'Claude 3.5 Sonnet');
  assert.equal(formatModelDisplayNameFromId('gemini-2-5-flash'), 'Gemini 2.5 Flash');
  assert.equal(formatModelDisplayNameFromId('llama-3-1-8b'), 'Llama 3.1 8b');
});

test('formatModelDisplayNameFromId keeps empty input as-is', () => {
  assert.equal(formatModelDisplayNameFromId(''), '');
  assert.equal(formatModelDisplayNameFromId('   '), '   ');
});
