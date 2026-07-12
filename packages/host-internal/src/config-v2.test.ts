import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSpiritConfigSchemaVersion,
  emptyModelRef,
  findModelByRef,
  isEmptyModelRef,
  modelExistsInGroup,
  modelRefKey,
  modelRefsEqual,
  parseModelRef,
  slugifyProviderGroupLabel,
  SpiritConfigSchemaError,
  SPIRIT_CONFIG_SCHEMA_VERSION,
} from './config-v2.js';
import type { ProviderGroupV2 } from './config-v2.js';

test('assertSpiritConfigSchemaVersion rejects missing or wrong version', () => {
  assert.throws(
    () => assertSpiritConfigSchemaVersion({}),
    SpiritConfigSchemaError,
  );
  assert.throws(
    () => assertSpiritConfigSchemaVersion({ schemaVersion: 1 }),
    SpiritConfigSchemaError,
  );
  assert.doesNotThrow(() => assertSpiritConfigSchemaVersion({ schemaVersion: SPIRIT_CONFIG_SCHEMA_VERSION }));
});

test('parseModelRef requires groupId and name', () => {
  assert.deepEqual(parseModelRef({ groupId: 'openai', name: 'gpt-4.1' }), {
    groupId: 'openai',
    name: 'gpt-4.1',
  });
  assert.equal(parseModelRef({ groupId: 'openai', name: '' }), undefined);
});

test('modelExistsInGroup is scoped to group', () => {
  const groups: ProviderGroupV2[] = [
    {
      id: 'vercel-ai-gateway',
      provider: 'vercel-ai-gateway',
      apiBase: 'https://example.com/v1',
      models: [{ name: 'openai/gpt-4.1', reasoningEffort: 'medium' }],
    },
    {
      id: 'openrouter',
      provider: 'openrouter',
      apiBase: 'https://openrouter.ai/api/v1',
      models: [{ name: 'openai/gpt-4.1', reasoningEffort: 'medium' }],
    },
  ];
  assert.equal(modelExistsInGroup(groups, 'vercel-ai-gateway', 'openai/gpt-4.1'), true);
  assert.equal(modelExistsInGroup(groups, 'openrouter', 'openai/gpt-4.1'), true);
  assert.equal(modelExistsInGroup(groups, 'vercel-ai-gateway', 'missing'), false);
  assert.equal(findModelByRef(groups, { groupId: 'openrouter', name: 'openai/gpt-4.1' })?.model.name, 'openai/gpt-4.1');
});

test('slugifyProviderGroupLabel normalizes custom group names', () => {
  assert.equal(slugifyProviderGroupLabel('My Local Ollama'), 'my-local-ollama');
  assert.equal(slugifyProviderGroupLabel('---'), 'custom-group');
});

test('modelRef helpers', () => {
  const ref = { groupId: 'openai', name: 'gpt-4.1' };
  assert.equal(modelRefKey(ref), 'openai::gpt-4.1');
  assert.equal(modelRefsEqual(ref, { ...ref }), true);
  assert.equal(isEmptyModelRef(emptyModelRef()), true);
});
