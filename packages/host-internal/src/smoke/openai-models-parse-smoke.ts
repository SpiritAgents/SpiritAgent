import assert from 'node:assert/strict';

import { parseMinimaxModelEntriesPayload, parseOpenAiModelsPayload, parseXiaomiModelEntriesPayload } from '../openai-models.js';

function run(): void {
  assert.deepEqual(parseOpenAiModelsPayload(undefined), []);
  assert.deepEqual(parseOpenAiModelsPayload(null), []);
  assert.deepEqual(parseOpenAiModelsPayload({}), []);
  assert.deepEqual(parseOpenAiModelsPayload({ data: null }), []);
  assert.deepEqual(parseOpenAiModelsPayload({ data: 'x' }), []);

  assert.deepEqual(
    parseOpenAiModelsPayload({
      object: 'list',
      data: [
        { id: 'gpt-4o', object: 'model' },
        { id: '  ', object: 'model' },
        { object: 'model' },
        { id: 'gpt-4o-mini', object: 'model' },
      ],
    }),
    ['gpt-4o', 'gpt-4o-mini'],
  );

  assert.deepEqual(
    parseXiaomiModelEntriesPayload({
      object: 'list',
      data: [{ id: 'mimo-v2.5' }, { id: 'mimo-v2-flash' }],
    }),
    [
      { id: 'mimo-v2.5', supportsImageInput: true, supportsVideoInput: true },
      { id: 'mimo-v2-flash', supportsImageInput: false, supportsVideoInput: false },
    ],
  );

  assert.deepEqual(
    parseMinimaxModelEntriesPayload({
      object: 'list',
      data: [{ id: 'MiniMax-M3' }, { id: 'MiniMax-M2.5' }],
    }),
    [
      { id: 'MiniMax-M3', supportsImageInput: true, supportsVideoInput: true },
      { id: 'MiniMax-M2.5', supportsImageInput: false, supportsVideoInput: false },
    ],
  );

  console.log('openai-models parse smoke: ok');
}

run();
