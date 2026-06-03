import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildModelSecretKeyPresence,
  modelProviderKeyScope,
  providerKeyAccount,
} from '../../dist-electron/src/host/provider-api-key.js';

test('providerKeyAccount uses provider namespace', () => {
  assert.equal(providerKeyAccount('vercel-ai-gateway'), 'provider::vercel-ai-gateway');
  assert.equal(providerKeyAccount('custom'), 'provider::custom');
});

test('modelProviderKeyScope defaults missing provider to custom', () => {
  assert.equal(modelProviderKeyScope(undefined), 'custom');
  assert.equal(modelProviderKeyScope('openai'), 'openai');
});

test('buildModelSecretKeyPresence reads each provider once', () => {
  const providerReads = [];
  const modelReads = [];

  const presence = buildModelSecretKeyPresence(
    [
      { name: 'a', provider: 'openai' },
      { name: 'b', provider: 'openai' },
      { name: 'c', provider: 'anthropic' },
      { name: 'legacy-only' },
    ],
    (providerId) => {
      providerReads.push(providerId);
      return providerId === 'openai';
    },
    (modelName) => {
      modelReads.push(modelName);
      return modelName === 'legacy-only';
    },
  );

  assert.deepEqual(providerReads, ['openai', 'anthropic', 'custom']);
  assert.deepEqual(modelReads, ['c', 'legacy-only']);
  assert.equal(presence.a, true);
  assert.equal(presence.b, true);
  assert.equal(presence.c, false);
  assert.equal(presence['legacy-only'], true);
});

test('buildModelSecretKeyPresence prefers provider key over per-model key', () => {
  const presence = buildModelSecretKeyPresence(
    [{ name: 'gpt-4', provider: 'openai' }],
    () => true,
    () => false,
  );
  assert.equal(presence['gpt-4'], true);
});
