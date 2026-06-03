import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk,
  buildResponsesProviderBuiltinToolArgumentsJson,
  buildResponsesProviderBuiltinToolCardData,
  isGenericProviderWebSearchQuery,
  isResponsesProviderBuiltinToolName,
  parseProviderBuiltinToolUiFromArgumentsJson,
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

test('buildResponsesProviderBuiltinToolArgumentsJson extracts query and _spiritUi', () => {
  const json = buildResponsesProviderBuiltinToolArgumentsJson(
    {
      type: 'web_search_call',
      status: 'completed',
      action: { type: 'search', query: 'DeepSeek latest generation' },
    },
    'web_search',
  );
  const parsed = JSON.parse(json) as {
    query?: string;
    status?: string;
    _spiritUi?: { headlineDetail?: string; inputExcerpt?: string };
  };
  assert.equal(parsed.query, 'DeepSeek latest generation');
  assert.equal(parsed.status, 'completed');
  assert.equal(parsed._spiritUi?.headlineDetail, undefined);
  assert.match(parsed._spiritUi?.inputExcerpt ?? '', /DeepSeek latest generation/);
});

test('isGenericProviderWebSearchQuery detects Bailian placeholder query', () => {
  assert.equal(isGenericProviderWebSearchQuery('Web search'), true);
  assert.equal(isGenericProviderWebSearchQuery('DeepSeek V4'), false);
});

test('buildResponsesProviderBuiltinToolCardData formats web_search sources', () => {
  const card = buildResponsesProviderBuiltinToolCardData(
    {
      type: 'web_search_call',
      status: 'completed',
      action: {
        type: 'search',
        query: 'Web search',
        sources: [
          { type: 'url', url: 'https://www.deepseek.com/' },
          { type: 'url', url: 'https://example.com/page' },
        ],
      },
    },
    'web_search',
  );
  assert.equal(card.sourceCount, 2);
  assert.equal(card.headlineDetail, undefined);
  assert.match(card.outputExcerpt ?? '', /deepseek\.com/);
  assert.equal(card.detailLines?.length, 2);
});

test('buildResponsesProviderBuiltinToolCardData formats web_extractor output', () => {
  const card = buildResponsesProviderBuiltinToolCardData(
    {
      type: 'web_extractor_call',
      status: 'completed',
      urls: ['https://cn.aliyun.com/'],
      goal: 'Extract homepage summary',
      output: 'Summary: Alibaba Cloud homepage…',
    },
    'web_extractor',
  );
  assert.equal(card.headlineDetail, 'https://cn.aliyun.com/');
  assert.equal(card.outputExcerpt, 'Summary: Alibaba Cloud homepage…');
  assert.match(card.inputExcerpt, /cn\.aliyun\.com/);
});

test('buildResponsesProviderBuiltinToolCardData formats code_interpreter logs', () => {
  const card = buildResponsesProviderBuiltinToolCardData(
    {
      type: 'code_interpreter_call',
      status: 'completed',
      code: 'print("hello")',
      outputs: [{ type: 'logs', logs: 'hello\n' }],
    },
    'code_interpreter',
  );
  assert.equal(card.headlineDetail, 'print("hello")');
  assert.match(card.outputExcerpt ?? '', /hello/);
  assert.match(card.inputExcerpt, /print/);
});

test('parseProviderBuiltinToolUiFromArgumentsJson reads embedded ui', () => {
  const json = buildResponsesProviderBuiltinToolArgumentsJson(
    {
      type: 'web_search_call',
      status: 'completed',
      action: { type: 'search', query: 'test query' },
    },
    'web_search',
  );
  const ui = parseProviderBuiltinToolUiFromArgumentsJson(json);
  assert.equal(ui?.headlineDetail, undefined);
  assert.match(ui?.inputExcerpt ?? '', /test query/);
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
        action: { type: 'search', query: 'DeepSeek generation' },
      },
    },
    0,
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.kind, 'streaming-tool-preview');
  if (result.events[0]?.kind !== 'streaming-tool-preview') {
    return;
  }
  const args = JSON.parse(result.events[0].argumentsJson) as {
    status?: string;
    _spiritUi?: { outputExcerpt?: string };
  };
  assert.equal(args.status, 'completed');
  assert.equal(
    resolveResponsesProviderBuiltinToolStreamPhaseFromArgumentsJson(result.events[0].argumentsJson),
    'succeeded',
  );
  const ui = parseProviderBuiltinToolUiFromArgumentsJson(result.events[0].argumentsJson);
  assert.equal(ui?.headlineDetail, undefined);
  assert.equal(ui?.sourceCount, undefined);
});
