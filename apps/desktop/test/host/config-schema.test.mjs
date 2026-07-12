import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertSpiritConfigSchemaVersion,
  SPIRIT_CONFIG_SCHEMA_VERSION,
} from '@spiritagent/host-internal';
import { ConfigSchemaError } from '../../dist-electron/src/host/storage.js';

test('assertSpiritConfigSchemaVersion rejects legacy schemaVersion 1', () => {
  assert.throws(
    () => assertSpiritConfigSchemaVersion({ schemaVersion: 1 }),
    ConfigSchemaError,
  );
});

test('assertSpiritConfigSchemaVersion accepts schemaVersion 2', () => {
  assert.doesNotThrow(() => assertSpiritConfigSchemaVersion({ schemaVersion: SPIRIT_CONFIG_SCHEMA_VERSION }));
});
