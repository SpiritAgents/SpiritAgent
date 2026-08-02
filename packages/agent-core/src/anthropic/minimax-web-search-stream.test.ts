import assert from 'node:assert/strict';
import test from 'node:test';
import type { TextStreamPart } from 'ai';

import { isJsonObject } from '../tool-agent.js';
import {
  parseResponsesBuiltInToolUiFromArgumentsJson,
  resolveResponsesBuiltInToolStreamPhaseFromArgumentsJson,
} from '../open-responses/responses-built-in-tools.js';
import {
  ANTHROPIC_ASSISTANT_CONTENT_BLOCKS_KEY,
  createMinimaxWebSearchStreamState,
  handleMinimaxWebSearchStreamPart,
  shouldSuppressMinimaxWebSearchStreamError,
} from './minimax-web-search-stream.js';

const probeResults = [
  {
    type: 'web_search_result',
    title: 'Shanghai weather today',
    url: 'https://www.tianqi.com/shanghai/today/',
    content: '多云 28 ~ 36℃',
  },
];

test('handleMinimaxWebSearchStreamPart emits preview then succeeded card', () => {
  const state = createMinimaxWebSearchStreamState();
  const events: Array<{ kind: string; toolName?: string; argumentsJson?: string }> = [];

  const push = (part: TextStreamPart<any>) => {
    handleMinimaxWebSearchStreamPart(part, state, events as never);
  };

  push({
    type: 'tool-input-start',
    id: 'call_search',
    toolName: 'web_search',
  });
  push({
    type: 'tool-input-delta',
    id: 'call_search',
    delta: '{"query":"Shanghai weather today"}',
  });
  push({
    type: 'tool-call',
    toolCallId: 'call_search',
    toolName: 'web_search',
    input: { query: 'Shanghai weather today' },
  });
  push({
    type: 'raw',
    rawValue: {
      type: 'content_block_start',
      index: 2,
      content_block: {
        type: 'web_search_tool_result',
        tool_use_id: 'call_search',
        content: probeResults,
      },
    },
  });
  push({
    type: 'tool-error',
    toolCallId: 'call_search',
    toolName: 'web_search',
    input: { query: 'Shanghai weather today' },
    error: new Error('web_search_tool_result validation failed'),
  });

  assert.equal(events.length, 3);
  assert.equal(events[0]?.kind, 'streaming-tool-preview');
  assert.equal(events[0]?.toolName, 'web_search');
  assert.match(events[0]?.argumentsJson ?? '', /Shanghai weather today/);
  assert.equal(events[2]?.kind, 'streaming-tool-preview');
  assert.equal(
    resolveResponsesBuiltInToolStreamPhaseFromArgumentsJson(events[2]?.argumentsJson ?? ''),
    'succeeded',
  );
  const ui = parseResponsesBuiltInToolUiFromArgumentsJson(events[2]?.argumentsJson ?? '');
  assert.ok(ui?.sourceCount === 1);
  assert.ok(state.executedProviderBuiltinToolCallIds.has('call_search'));
  assert.equal(
    shouldSuppressMinimaxWebSearchStreamError(
      new Error('web_search_tool_result validation failed'),
      state,
    ),
    true,
  );
});

test('handleMinimaxWebSearchStreamPart records anthropic content blocks', () => {
  const state = createMinimaxWebSearchStreamState();
  const events: never[] = [];

  handleMinimaxWebSearchStreamPart({
    type: 'raw',
    rawValue: {
      type: 'content_block_start',
      content_block: {
        type: 'server_tool_use',
        id: 'call_search',
        name: 'web_search',
        input: { query: 'Beijing weather today' },
      },
    },
  }, state, events);

  handleMinimaxWebSearchStreamPart({
    type: 'raw',
    rawValue: {
      type: 'content_block_start',
      content_block: {
        type: 'web_search_tool_result',
        tool_use_id: 'call_search',
        content: probeResults,
      },
    },
  }, state, events);

  assert.equal(state.anthropicContentBlocks.length, 2);
  assert.equal(
    (state.anthropicContentBlocks[0] as { type?: string }).type,
    'server_tool_use',
  );
});

test('assistant message stores _anthropicContentBlocks for replay', () => {
  const state = createMinimaxWebSearchStreamState();
  handleMinimaxWebSearchStreamPart({
    type: 'raw',
    rawValue: {
      type: 'content_block_start',
      content_block: {
        type: 'server_tool_use',
        id: 'call_search',
        name: 'web_search',
        input: { query: 'Beijing weather today' },
      },
    },
  }, state, []);

  const message = {
    role: 'assistant',
    content: 'Answer text',
    [ANTHROPIC_ASSISTANT_CONTENT_BLOCKS_KEY]: state.anthropicContentBlocks,
  };

  assert.ok(Array.isArray(message[ANTHROPIC_ASSISTANT_CONTENT_BLOCKS_KEY]));
  assert.ok(isJsonObject(message));
  assert.equal(message.content, 'Answer text');
});
