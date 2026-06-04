import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { AiSdkOpenAiCompatibleTransport } from '../../openai/ai-sdk-transport.js';
import { AiSdkOpenResponsesTransport } from '../../open-responses/ai-sdk-transport.js';
import {
  extractLastOpenAiAssistantText,
  startOpenAiToolAgentState,
} from '../../openai/tool-agent-helpers.js';

import { printSmokeSection } from '../shared/index.js';
import { buildOpenResponsesFinalTextBody } from './open-responses-mock.js';

async function main(): Promise<void> {
  await runOpenRouterChatSmoke();
  await runOpenRouterResponsesSmoke();
}

async function runOpenRouterChatSmoke(): Promise<void> {
  let capturedBody: Record<string, unknown> | undefined;
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || !request.url?.includes('/chat/completions')) {
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
    response.end(JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'openai/gpt-4o',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'OPENROUTER_CHAT_OK' },
        finish_reason: 'stop',
      }],
    }));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('无法获取本地 smoke server 端口。');
  }

  const transport = new AiSdkOpenAiCompatibleTransport();
  const config = {
    transportKind: 'openai-compatible' as const,
    apiKey: 'test-key',
    model: 'openai/gpt-4o',
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}/v1`,
    llmVendor: 'openrouter' as const,
  };

  const state = startOpenAiToolAgentState(
    [],
    'Reply with exactly OPENROUTER_CHAT_OK.',
    process.cwd(),
    [],
    [],
    [],
    config.model,
  );
  const round = await transport.startToolAgentRound(config, state, []);
  server.close();

  printSmokeSection('openrouter chat smoke', round);
  if (round.kind !== 'success' || round.result.step.kind !== 'final-response-ready') {
    throw new Error('openrouter chat smoke 未进入 final-response-ready。');
  }

  const plugins = capturedBody?.plugins as Array<{ id?: string }> | undefined;
  if (!plugins?.some((plugin) => plugin.id === 'web')) {
    throw new Error('openrouter chat smoke 请求体未包含 plugins web。');
  }
}

async function runOpenRouterResponsesSmoke(): Promise<void> {
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
    response.end(JSON.stringify(buildOpenResponsesFinalTextBody('openai/gpt-4o', 'OPENROUTER_RESPONSES_OK')));
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
    model: 'openai/gpt-4o',
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}/v1`,
    llmVendor: 'openrouter' as const,
    responsesProvider: 'open-responses-compatible' as const,
    store: false,
  };

  const state = startOpenAiToolAgentState(
    [],
    'Reply with exactly OPENROUTER_RESPONSES_OK.',
    process.cwd(),
    [],
    [],
    [],
    config.model,
  );
  const round = await transport.startToolAgentRound(config, state, []);
  server.close();

  printSmokeSection('openrouter responses smoke', round);
  if (round.kind !== 'success' || round.result.step.kind !== 'final-response-ready') {
    throw new Error('openrouter responses smoke 未进入 final-response-ready。');
  }

  const tools = capturedBody?.tools as Array<{ type?: string; name?: string }> | undefined;
  if (!tools?.some((tool) => tool.type === 'web_search')) {
    throw new Error('openrouter responses smoke 请求体缺少 web_search。');
  }

  const assistantText = extractLastOpenAiAssistantText(round.result.state)?.trim();
  if (assistantText !== 'OPENROUTER_RESPONSES_OK') {
    throw new Error(`openrouter responses smoke 未拿到预期文本: ${assistantText ?? '<empty>'}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ai-sdk openrouter built-in tools smoke failed: ${message}`);
  process.exitCode = 1;
});
