import assert from 'node:assert/strict';
import test from 'node:test';

import { LspOrchestrator } from './orchestrator.js';
import { LspProviderSession } from './provider-session.js';

test('LspOrchestrator.probe returns false when userConfig.enabled is false', async () => {
  const orchestrator = new LspOrchestrator(process.cwd(), undefined, { enabled: false });
  assert.equal(await orchestrator.probe(), false);
  assert.equal(orchestrator.enabled, false);
});

test('LspOrchestrator routes TypeScript paths to typescript-language-server session', async () => {
  const orchestrator = new LspOrchestrator(process.cwd(), undefined, { enabled: true });
  await orchestrator.probe();
  const session = orchestrator.getSession('typescript-language-server');
  assert.ok(session);
  assert.equal(session.providerId, 'typescript-language-server');
});

test('LspProviderSession supportsPath respects provider routing', () => {
  const session = new LspProviderSession({
    providerId: 'pyright',
    workspaceRoot: process.cwd(),
    supportsPath: (path) => path.endsWith('.py'),
  });
  assert.equal(session.supportsPath('/workspace/main.py'), true);
  assert.equal(session.supportsPath('/workspace/main.ts'), false);
});
