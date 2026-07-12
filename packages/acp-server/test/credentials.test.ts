import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  loadSpiritConfig,
  saveProviderSetup,
  setKeyringStoreForTests,
} from '../src/credentials/index.js';
import {
  providerAccessKeyIdAccount,
  providerKeyAccount,
  providerSecretAccessKeyAccount,
} from '../src/credentials/provider-accounts.js';
import { buildProviderSetupResult } from '../src/setup/provider-wizard.js';

function openAiSetup(overrides: Record<string, unknown> = {}) {
  return {
    ...buildProviderSetupResult({
      provider: 'openai',
      modelName: 'gpt-4o-mini',
    }),
    providerScope: 'openai' as const,
    apiKey: 'secret-key',
    ...overrides,
  };
}

test('loadSpiritConfig returns undefined for invalid JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'spirit-acp-config-'));
  writeFileSync(join(dir, 'config.json'), '{not json', 'utf8');
  assert.equal(loadSpiritConfig(dir), undefined);
});

test('loadSpiritConfig rejects legacy schemaVersion 1 config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'spirit-acp-config-v1-'));
  writeFileSync(
    join(dir, 'config.json'),
    JSON.stringify({
      schemaVersion: 1,
      models: [{ name: 'gpt-4o-mini', apiBase: 'https://api.openai.com/v1', provider: 'openai' }],
      activeModel: 'gpt-4o-mini',
    }),
    'utf8',
  );
  assert.equal(loadSpiritConfig(dir), undefined);
});

test('saveProviderSetup writes keyring before config', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'spirit-acp-save-'));
  const setup = openAiSetup();

  setKeyringStoreForTests({
    getPassword: () => undefined,
    setPassword: () => {
      throw new Error('keyring unavailable');
    },
    deletePassword: () => {},
  });

  try {
    await assert.rejects(
      () => saveProviderSetup(dir, setup),
      /keyring unavailable/,
    );
    assert.equal(existsSync(join(dir, 'config.json')), false);
  } finally {
    setKeyringStoreForTests(undefined);
  }
});

test('saveProviderSetup persists keyring and config together', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'spirit-acp-save-'));
  const passwords = new Map<string, string>();
  setKeyringStoreForTests({
    getPassword: (_service, account) => passwords.get(account),
    setPassword: (_service, account, password) => {
      passwords.set(account, password);
    },
    deletePassword: (_service, account) => {
      passwords.delete(account);
    },
  });

  const setup = openAiSetup();

  try {
    await saveProviderSetup(dir, setup);
    assert.equal(passwords.get(providerKeyAccount('openai')), 'secret-key');
    const config = loadSpiritConfig(dir);
    assert.equal(config?.schemaVersion, 2);
    assert.deepEqual(config?.activeModel, { groupId: 'openai', name: 'gpt-4o-mini' });
    assert.equal(config?.providerGroups.length, 1);
    assert.equal(config?.providerGroups[0]?.models.length, 1);
    assert.equal(config?.providerGroups[0]?.models[0]?.name, 'gpt-4o-mini');
  } finally {
    setKeyringStoreForTests(undefined);
  }
});

test('saveProviderSetup persists bedrock IAM credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'spirit-acp-save-bedrock-'));
  const passwords = new Map<string, string>();
  setKeyringStoreForTests({
    getPassword: (_service, account) => passwords.get(account),
    setPassword: (_service, account, password) => {
      passwords.set(account, password);
    },
    deletePassword: (_service, account) => {
      passwords.delete(account);
    },
  });

  const setup = {
    ...buildProviderSetupResult({
      provider: 'amazon-bedrock',
      modelName: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      awsRegion: 'us-east-1',
      transportKind: 'bedrock',
    }),
    providerScope: 'amazon-bedrock' as const,
    bedrock: {
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'secret-key',
    },
  };

  try {
    await saveProviderSetup(dir, setup);
    assert.equal(passwords.get(providerAccessKeyIdAccount('amazon-bedrock')), 'AKIAEXAMPLE');
    assert.equal(passwords.get(providerSecretAccessKeyAccount('amazon-bedrock')), 'secret-key');
    const config = loadSpiritConfig(dir);
    assert.deepEqual(config?.activeModel, {
      groupId: 'amazon-bedrock',
      name: setup.model.name,
    });
  } finally {
    setKeyringStoreForTests(undefined);
  }
});
