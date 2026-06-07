import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { JsonValue } from '../../ports.js';
import { AiSdkOpenResponsesTransport } from '../../open-responses/ai-sdk-transport.js';
import {
  extractLastOpenAiAssistantText,
  startOpenAiToolAgentState,
} from '../../openai/tool-agent-helpers.js';
import { printSmokeSection } from '../shared/index.js';
import {
  buildOpenResponsesFinalTextBody,
  buildOpenResponsesWebSearchCallBody,
} from './open-responses-mock.js';

async function main(): Promise<void> {
  await runGatewayWebSearchInjectionSmoke();
  await runGatewayWebSearchInvocationSmoke();
  await runGatewayWebSearchStreamingSmoke();
}

async function runGatewayWebSearchInjectionSmoke(): Promise<void> {
  let capturedBody: Record<string, unknown> | undefined;
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || !request.url?.includes('/responses')) {
      response.statusCode = 404;
      response.end('not found');
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    capturedBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(
      buildOpenResponsesFinalTextBody('gpt-5.4', 'GATEWAY_WEB_SEARCH_OK'),
    ));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('无法获取本地 smoke server 端口。');
  }

  const transport = new AiSdkOpenResponsesTransport();
  const config = {
    transportKind: 'open-responses' as const,
    apiKey: 'test-key',
    model: 'openai/gpt-5.4',
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}/v1`,
    llmVendor: 'vercel-ai-gateway' as const,
    store: false,
  };

  const state = startOpenAiToolAgentState(
    [],
    'Reply with exactly GATEWAY_WEB_SEARCH_OK.',
    process.cwd(),
    [],
    [],
    [],
    config.model,
  );
  const round = await transport.startToolAgentRound(config, state, []);
  server.close();

  printSmokeSection('ai-sdk gateway web_search injection smoke', round);
  if (round.kind !== 'success' || round.result.step.kind !== 'final-response-ready') {
    throw new Error('gateway web_search injection smoke 未进入 final-response-ready。');
  }

  if (!requestIncludesGatewayWebSearchTool(capturedBody)) {
    throw new Error('gateway web_search injection smoke 请求体缺少 gateway.perplexity_search 工具。');
  }

  const assistantText = extractLastOpenAiAssistantText(round.result.state)?.trim();
  if (assistantText !== 'GATEWAY_WEB_SEARCH_OK') {
    throw new Error(`gateway web_search injection smoke 未拿到预期文本: ${assistantText ?? '<empty>'}`);
  }

  const trace = round.result.requestTrace[0];
  if (!isJsonObject(trace) || trace.kind !== 'open_responses_sdk_responses') {
    throw new Error('gateway web_search injection smoke 未写入 open_responses_sdk_responses trace。');
  }

  const traceTools = trace.tools as JsonValue[] | undefined;
  if (
    !traceTools?.some(
      (tool) =>
        isJsonObject(tool)
        && tool.id === 'gateway.perplexity_search'
        && tool.name === 'web_search',
    )
  ) {
    throw new Error('gateway web_search injection smoke trace 缺少 web_search provider tool。');
  }
}

async function runGatewayWebSearchInvocationSmoke(): Promise<void> {
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || !request.url?.includes('/responses')) {
      response.statusCode = 404;
      response.end('not found');
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
    if (!requestIncludesGatewayWebSearchTool(body)) {
      response.statusCode = 400;
      response.end('missing gateway web_search tool');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(buildOpenResponsesWebSearchCallBody('gpt-5.4')));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('无法获取本地 smoke server 端口。');
  }

  const transport = new AiSdkOpenResponsesTransport();
  const config = {
    transportKind: 'open-responses' as const,
    apiKey: 'test-key',
    model: 'openai/gpt-5.4',
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}/v1`,
    llmVendor: 'vercel-ai-gateway' as const,
    store: false,
  };

  const state = startOpenAiToolAgentState(
    [],
    'Search the web for the latest AI Gateway web search pricing.',
    process.cwd(),
    [],
    [],
    [],
    config.model,
  );
  const round = await transport.startToolAgentRound(config, state, []);
  server.close();

  printSmokeSection('ai-sdk gateway web_search invocation smoke', round);
  if (round.kind !== 'success') {
    throw new Error('gateway web_search invocation smoke 未成功完成。');
  }

  // Provider-executed web search may finish inside the Responses round without host tool-calls.
  if (
    round.result.step.kind !== 'final-response-ready'
    && round.result.step.kind !== 'tool-calls'
  ) {
    throw new Error('gateway web_search invocation smoke 未进入可完成步骤。');
  }
}

async function runGatewayWebSearchStreamingSmoke(): Promise<void> {
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || !request.url?.includes('/responses')) {
      response.statusCode = 404;
      response.end('not found');
      return;
    }

    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });

    const chunks = [
      sseEvent({
        type: 'response.web_search_call.in_progress',
        item_id: 'wsc_stream_1',
      }),
      sseEvent({
        type: 'response.output_item.added',
        item: {
          type: 'web_search_call',
          id: 'wsc_stream_1',
          call_id: 'call_web_search_stream_1',
          status: 'in_progress',
          action: {
            type: 'search',
            query: 'AI Gateway web search pricing',
          },
        },
      }),
      sseEvent({
        type: 'response.output_item.done',
        item: {
          type: 'web_search_call',
          id: 'wsc_stream_1',
          call_id: 'call_web_search_stream_1',
          status: 'completed',
          action: {
            type: 'search',
            query: 'AI Gateway web search pricing',
            sources: [
              {
                title: 'Vercel AI Gateway',
                url: 'https://vercel.com/docs/ai-gateway/capabilities/web-search',
              },
            ],
          },
        },
      }),
      sseEvent({
        type: 'response.completed',
        response: {
          id: 'resp-web-search-stream',
          status: 'completed',
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        },
      }),
    ];

    for (const chunk of chunks) {
      response.write(chunk);
    }
    response.end();
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('无法获取本地 smoke server 端口。');
  }

  const transport = new AiSdkOpenResponsesTransport();
  const state = startOpenAiToolAgentState(
    [],
    'Search the web for AI Gateway web search pricing.',
    process.cwd(),
    [],
    [],
    [],
    'openai/gpt-5.4',
  );
  const started = await transport.startToolAgentRoundStreaming(
    {
      transportKind: 'open-responses',
      apiKey: 'test-key',
      model: 'openai/gpt-5.4',
      baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}/v1`,
      llmVendor: 'vercel-ai-gateway',
      store: false,
    },
    state,
    [],
  );

  const events = await collectEvents(started.eventStream);
  const completion = await started.completion;
  server.close();

  printSmokeSection('ai-sdk gateway web_search streaming smoke events', events);
  printSmokeSection('ai-sdk gateway web_search streaming smoke completion', completion);

  const previewEvents = events.filter(
    (event) => isJsonObject(event) && event.kind === 'streaming-tool-preview',
  );
  if (
    !previewEvents.some(
      (event) => isJsonObject(event) && event.toolName === 'web_search',
    )
  ) {
    throw new Error('gateway web_search streaming smoke 未收到 web_search 预览事件。');
  }

  if (completion.kind !== 'success') {
    throw new Error('gateway web_search streaming smoke 未完成。');
  }
}

function sseEvent(payload: JsonValue): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function collectEvents(
  stream: AsyncIterable<{ kind: string } & Record<string, unknown>>,
): Promise<JsonValue[]> {
  const events: JsonValue[] = [];
  for await (const event of stream) {
    events.push(event as unknown as JsonValue);
  }
  return events;
}

function requestIncludesGatewayWebSearchTool(body: Record<string, unknown> | undefined): boolean {
  const tools = body?.tools;
  if (!Array.isArray(tools)) {
    return false;
  }

  return tools.some((tool) => {
    if (!isJsonObject(tool as JsonValue)) {
      return false;
    }

    const record = tool as Record<string, unknown>;
    return record.id === 'gateway.perplexity_search'
      || record.type === 'web_search'
      || (record.type === 'provider' && record.id === 'gateway.perplexity_search');
  });
}

function isJsonObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ai-sdk gateway web_search smoke failed: ${message}`);
  process.exitCode = 1;
});
