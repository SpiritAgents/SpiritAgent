import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk,
  buildResponsesProviderBuiltinToolArgumentsJson,
  isResponsesProviderBuiltinToolName,
  resolveResponsesProviderBuiltinToolStreamPhase,
  resolveResponsesProviderBuiltinToolStreamPhaseFromArgumentsJson,
  responsesProviderBuiltinToolNameFromOutputItemType,
} from './responses-provider-builtin-tools.js';

test('responsesProviderBuiltinToolNameFromOutputItemType maps Responses output items', () => {
  assert.equal(responsesProviderBuiltinToolNameFromOutputItemType('web_search_call'), 'web_search');
  assert.equal(responsesProviderBuiltinToolNameFromOutputItemType('web_extractor_call'), 'web_extractor');
  assert.equal(
    responsesProviderBuiltinToolNameFromOutputItemType('code_interpreter_call'),
    'code_interpreter',
  );
  assert.equal(responsesProviderBuiltinToolNameFromOutputItemType('function_call'), undefined);
});

test('isResponsesProviderBuiltinToolName recognizes builtin tool names', () => {
  assert.equal(isResponsesProviderBuiltinToolName('web_search'), true);
  assert.equal(isResponsesProviderBuiltinToolName('web_fetch'), false);
});

test('buildResponsesProviderBuiltinToolArgumentsJson extracts query and url', () => {
  const json = buildResponsesProviderBuiltinToolArgumentsJson({
    type: 'web_search_call',
    status: 'completed',
    query: 'DeepSeek latest generation',
    action: { type: 'search', query: 'DeepSeek latest generation' },
  });
  const parsed = JSON.parse(json) as { query?: string; status?: string };
  assert.equal(parsed.query, 'DeepSeek latest generation');
  assert.equal(parsed.status, 'completed');
});

test('resolveResponsesProviderBuiltinToolStreamPhase maps terminal statuses', () => {
  assert.equal(
    resolveResponsesProviderBuiltinToolStreamPhase({ type: 'web_search_call', status: 'completed' }),
    'succeeded',
  );
  assert.equal(
    resolveResponsesProviderBuiltinToolStreamPhase({ type: 'web_search_call', status: 'in_progress' }),
    'preview',
  );
  assert.equal(
    resolveResponsesProviderBuiltinToolStreamPhaseFromArgumentsJson(
      JSON.stringify({ status: 'completed', query: 'test' }),
    ),
    'succeeded',
  );
});

test('accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk marks completed on output_item.done', () => {
  const result = accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk(
    {
      type: 'response.output_item.done',
      item: {
        type: 'web_search_call',
        id: 'ws_done',
        status: 'completed',
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
  const args = JSON.parse(result.events[0].argumentsJson) as { status?: string };
  assert.equal(args.status, 'completed');
  assert.equal(
    resolveResponsesProviderBuiltinToolStreamPhaseFromArgumentsJson(result.events[0].argumentsJson),
    'succeeded',
  );
});
