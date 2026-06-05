import assert from 'node:assert/strict';
import test from 'node:test';

import { installLspProvider, LspInstallError } from './install.js';

test('installLspProvider rejects unknown provider', async () => {
  await assert.rejects(
    () => installLspProvider('unknown' as 'pyright'),
    LspInstallError,
  );
});

test('installLspProvider rejects platform install kind with guidance', async () => {
  await assert.rejects(() => installLspProvider('clangd'), /winget|brew/i);
});

test('installLspProvider rejects manual jdtls with guidance', async () => {
  await assert.rejects(() => installLspProvider('jdtls'), /manual/i);
});
