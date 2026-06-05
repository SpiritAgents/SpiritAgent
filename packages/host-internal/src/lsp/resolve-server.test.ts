import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCommandCandidates, buildTypescriptLanguageServerCandidates } from './resolve-server.js';

test('buildCommandCandidates expands Windows PATHEXT', () => {
  const candidates = buildCommandCandidates(
    'typescript-language-server',
    {
      Path: 'C:\\Tools;D:\\bin',
      PATHEXT: '.EXE;.CMD',
    },
    'win32',
  );
  assert.ok(candidates.includes('C:\\Tools\\typescript-language-server.exe'));
  assert.ok(candidates.includes('D:\\bin\\typescript-language-server.cmd'));
});

test('buildCommandCandidates uses POSIX PATH segments', () => {
  const candidates = buildCommandCandidates('gopls', { PATH: '/usr/bin:/opt/bin' }, 'linux');
  assert.deepEqual(candidates, ['/usr/bin/gopls', '/opt/bin/gopls']);
});

test('buildTypescriptLanguageServerCandidates delegates to buildCommandCandidates', () => {
  const candidates = buildTypescriptLanguageServerCandidates({ PATH: '/usr/bin' }, 'linux');
  assert.deepEqual(candidates, ['/usr/bin/typescript-language-server']);
});
