import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveGoplsOnPath, resolvePyrightOnPath } from './resolve-server.js';

test('resolvePyrightOnPath uses pyright-langserver --stdio', async () => {
  const result = await resolvePyrightOnPath({ PATH: '' }, 'linux');
  assert.equal(result, undefined);
});

test('resolveGoplsOnPath looks for gopls on PATH', async () => {
  const result = await resolveGoplsOnPath({ PATH: '' }, 'linux');
  assert.equal(result, undefined);
});
