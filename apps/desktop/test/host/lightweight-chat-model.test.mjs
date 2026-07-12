import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeLightweightChatModel,
  resolveLightweightChatModelName,
  resolveLightweightChatModelProfile,
} from '../../dist-electron/src/host/lightweight-chat-model.js';

const openAiGroupId = 'openai';
const exampleGroupId = 'example';

const chatModel = {
  name: 'gpt-4o-mini',
  reasoningEffort: 'medium',
  capabilities: ['chat'],
};

const flashModel = {
  name: 'deepseek/deepseek-v4-flash',
  reasoningEffort: 'medium',
  capabilities: ['chat'],
};

const imageOnlyModel = {
  name: 'dall-e-3',
  reasoningEffort: 'medium',
  capabilities: ['imageGeneration'],
};

const config = {
  providerGroups: [
    {
      id: openAiGroupId,
      provider: 'openai',
      apiBase: 'https://api.openai.com/v1',
      models: [chatModel, imageOnlyModel],
    },
    {
      id: exampleGroupId,
      provider: 'custom',
      apiBase: 'https://api.example.com/v1',
      models: [flashModel],
    },
  ],
  activeModel: { groupId: openAiGroupId, name: 'gpt-4o-mini' },
};

test('resolveLightweightChatModelName prefers explicit lightweightChatModel', () => {
  const name = resolveLightweightChatModelName({
    ...config,
    lightweightChatModel: { groupId: exampleGroupId, name: 'deepseek/deepseek-v4-flash' },
  });

  assert.deepEqual(name, { groupId: exampleGroupId, name: 'deepseek/deepseek-v4-flash' });
});

test('resolveLightweightChatModelName ignores invalid explicit config', () => {
  const name = resolveLightweightChatModelName({
    ...config,
    lightweightChatModel: { groupId: openAiGroupId, name: 'missing-model' },
  });

  assert.deepEqual(name, { groupId: exampleGroupId, name: 'deepseek/deepseek-v4-flash' });
});

test('resolveLightweightChatModelName ignores non-chat explicit config', () => {
  const name = resolveLightweightChatModelName({
    providerGroups: [{
      id: openAiGroupId,
      provider: 'openai',
      apiBase: 'https://api.openai.com/v1',
      models: [chatModel, imageOnlyModel],
    }],
    activeModel: { groupId: openAiGroupId, name: 'gpt-4o-mini' },
    lightweightChatModel: { groupId: openAiGroupId, name: 'dall-e-3' },
  });

  assert.deepEqual(name, { groupId: openAiGroupId, name: 'gpt-4o-mini' });
});

test('resolveLightweightChatModelName falls back to pattern match before activeModel', () => {
  const name = resolveLightweightChatModelName(config);

  assert.deepEqual(name, { groupId: exampleGroupId, name: 'deepseek/deepseek-v4-flash' });
});

test('resolveLightweightChatModelName falls back to activeModel when no pattern matches', () => {
  const name = resolveLightweightChatModelName({
    providerGroups: [config.providerGroups[0]],
    activeModel: { groupId: openAiGroupId, name: 'gpt-4o-mini' },
  });

  assert.deepEqual(name, { groupId: openAiGroupId, name: 'gpt-4o-mini' });
});

test('normalizeLightweightChatModel only keeps chat-capable models', () => {
  assert.equal(
    normalizeLightweightChatModel(
      { groupId: openAiGroupId, name: 'dall-e-3' },
      { providerGroups: [config.providerGroups[0]] },
    ),
    undefined,
  );
  assert.deepEqual(
    normalizeLightweightChatModel(
      { groupId: openAiGroupId, name: 'gpt-4o-mini' },
      { providerGroups: [config.providerGroups[0]] },
    ),
    { groupId: openAiGroupId, name: 'gpt-4o-mini' },
  );
});

test('resolveLightweightChatModelProfile returns profile for resolved model', () => {
  const resolved = resolveLightweightChatModelProfile({
    ...config,
    lightweightChatModel: { groupId: exampleGroupId, name: 'deepseek/deepseek-v4-flash' },
  });

  assert.equal(resolved?.name, 'deepseek/deepseek-v4-flash');
  assert.equal(resolved?.profile.groupId, exampleGroupId);
  assert.equal(resolved?.profile.name, 'deepseek/deepseek-v4-flash');
});
