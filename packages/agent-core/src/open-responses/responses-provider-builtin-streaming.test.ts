import assert from 'node:assert/strict';
import test from 'node:test';

import { accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk } from './responses-provider-builtin-tools.js';

test('accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk emits preview for web_search_call', () => {
  const result = accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk(
    {
      type: 'response.output_item.added',
      item: {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'in_progress',
        query: 'DeepSeek generation',
      },
    },
    0,
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.kind, 'streaming-tool-preview');
  if (result.events[0]?.kind !== 'streaming-tool-preview') {
    return;
  }
  assert.equal(result.events[0].toolName, 'web_search');
  assert.equal(result.events[0].toolCallId, 'ws_1');
  assert.match(result.events[0].argumentsJson, /DeepSeek generation/);
});

test('accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk preserves call id on output_item.done', () => {
  const result = accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk(
    {
      type: 'response.output_item.done',
      item: {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        query: 'DeepSeek generation',
      },
    },
    1,
  );

  assert.equal(result.events.length, 1);
  if (result.events[0]?.kind !== 'streaming-tool-preview') {
    return;
  }
  assert.equal(result.events[0].toolCallId, 'ws_1');
  assert.equal(result.nextPreviewIndex, 1);
});
