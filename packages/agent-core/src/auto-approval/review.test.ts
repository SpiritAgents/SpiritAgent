import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveToolAutoReviewGate } from './gate.js';
import { buildAutoApprovalReviewPrompt } from './prompt.js';
import { normalizeAutoApprovalReviewResult } from './run-review.js';
import { resolveToolInputSchema } from './resolve-tool-schema.js';
import type { ToolAutoReviewInput } from './types.js';

const sampleInput: ToolAutoReviewInput = {
  toolName: 'shell',
  argumentsJson: '{"command":"echo hi","reason":"test"}',
  inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
  hostApprovalContext: '高风险工具调用: shell\n命令: echo hi',
};

test('buildAutoApprovalReviewPrompt includes schema, context, and examples', () => {
  const prompt = buildAutoApprovalReviewPrompt(sampleInput);
  assert.match(prompt, /tool_name/u);
  assert.match(prompt, /shell/u);
  assert.match(prompt, /input_schema/u);
  assert.match(prompt, /host_approval_context/u);
  assert.match(prompt, /git push to main/u);
  assert.match(prompt, /npm install/u);
});

test('resolveToolInputSchema reads OpenAI function definitions', () => {
  const schema = resolveToolInputSchema(
    [{
      type: 'function',
      function: {
        name: 'shell',
        parameters: { type: 'object', properties: { command: { type: 'string' } } },
      },
    }],
    'shell',
  );
  assert.ok(schema);
  const properties = schema.properties;
  assert.ok(properties && typeof properties === 'object' && !Array.isArray(properties));
  assert.deepEqual(properties.command, { type: 'string' });
});

test('normalizeAutoApprovalReviewResult validates output', () => {
  assert.deepEqual(
    normalizeAutoApprovalReviewResult({ allow: true, reason: 'read-only' }),
    { allow: true, reason: 'read-only' },
  );
  assert.equal(normalizeAutoApprovalReviewResult({ allow: true, reason: '  ' }), undefined);
  assert.equal(normalizeAutoApprovalReviewResult({ allow: 'yes', reason: 'x' }), undefined);
});

test('resolveToolAutoReviewGate bypasses when approval level is not auto-approval', async () => {
  const gate = await resolveToolAutoReviewGate('default', async () => ({ allow: true, reason: 'x' }), sampleInput);
  assert.equal(gate.kind, 'manual');
});

test('resolveToolAutoReviewGate allows when reviewer returns allow', async () => {
  const gate = await resolveToolAutoReviewGate(
    'auto-approval',
    async () => ({ allow: true, reason: 'safe read' }),
    sampleInput,
  );
  assert.equal(gate.kind, 'allowed');
});

test('resolveToolAutoReviewGate blocks when reviewer returns deny', async () => {
  const gate = await resolveToolAutoReviewGate(
    'auto-approval',
    async () => ({ allow: false, reason: 'force push' }),
    sampleInput,
  );
  assert.deepEqual(gate, { kind: 'blocked', reason: 'force push' });
});

test('resolveToolAutoReviewGate falls back to manual when reviewer is unavailable', async () => {
  const gate = await resolveToolAutoReviewGate('auto-approval', async () => undefined, sampleInput);
  assert.equal(gate.kind, 'manual');
});
