import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COMPOSER_DRAFT_STORAGE_KEY,
  clearComposerDraft,
  normalizeComposerSessionKey,
  readComposerDraft,
  writeComposerDraft,
} from '../../dist-electron/src/lib/composer-draft-store.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    values,
  };
}

test('normalizeComposerSessionKey normalizes Windows-style paths', () => {
  assert.equal(
    normalizeComposerSessionKey('D:\\SpiritAgent\\Chats\\A.json'),
    'd:/spiritagent/chats/a.json',
  );
});

test('writeComposerDraft and readComposerDraft round-trip text and attachments', () => {
  const storage = createMemoryStorage();
  const sessionKey = 'D:/SpiritAgent/chats/session-a.json';

  writeComposerDraft(
    sessionKey,
    {
      text: 'half-written idea',
      localFilePaths: ['D:\\tmp\\note.png', 'D:/tmp/note.png'],
    },
    storage,
  );

  const restored = readComposerDraft(sessionKey, storage);
  assert.deepEqual(restored, {
    text: 'half-written idea',
    localFilePaths: ['D:/tmp/note.png'],
    updatedAt: restored.updatedAt,
  });
  assert.equal(typeof restored.updatedAt, 'number');
});

test('writeComposerDraft deletes empty drafts', () => {
  const storage = createMemoryStorage();
  const sessionKey = 'session-empty';

  writeComposerDraft(sessionKey, { text: 'temp', localFilePaths: [] }, storage);
  writeComposerDraft(sessionKey, { text: '   ', localFilePaths: [] }, storage);

  assert.equal(readComposerDraft(sessionKey, storage), undefined);
  const raw = JSON.parse(storage.getItem(COMPOSER_DRAFT_STORAGE_KEY));
  assert.equal(raw.drafts['session-empty'], undefined);
});

test('clearComposerDraft removes a stored draft', () => {
  const storage = createMemoryStorage();
  const sessionKey = 'session-clear';

  writeComposerDraft(sessionKey, { text: 'keep me briefly', localFilePaths: [] }, storage);
  clearComposerDraft(sessionKey, storage);

  assert.equal(readComposerDraft(sessionKey, storage), undefined);
});

test('readComposerDraft returns undefined for corrupted storage', () => {
  const storage = createMemoryStorage();
  storage.setItem(COMPOSER_DRAFT_STORAGE_KEY, '{not-json');

  assert.equal(readComposerDraft('any-session', storage), undefined);
});
