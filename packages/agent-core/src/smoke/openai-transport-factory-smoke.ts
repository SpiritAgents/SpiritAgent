import {
  AiSdkOpenAiTransport,
  createOpenAiCompatibleTransport,
  createOpenAiJsonSchemaTransport,
  OpenAiTransport,
  resolveOpenAiTransportImplementation,
} from '../openai/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  const defaultTransport = createOpenAiCompatibleTransport();
  assert(
    defaultTransport instanceof AiSdkOpenAiTransport,
    '缺省 transport 应切到 AiSdkOpenAiTransport。',
  );

  const defaultJsonSchemaTransport = createOpenAiJsonSchemaTransport();
  assert(
    defaultJsonSchemaTransport instanceof AiSdkOpenAiTransport,
    '缺省 JSON schema transport 应切到 AiSdkOpenAiTransport。',
  );

  const explicitLegacyTransport = createOpenAiCompatibleTransport({
    transportImplementation: 'openai-node',
  });
  assert(
    explicitLegacyTransport instanceof OpenAiTransport,
    '显式 openai-node transport 应返回 legacy OpenAiTransport。',
  );

  const explicitLegacyJsonSchemaTransport = createOpenAiJsonSchemaTransport({
    transportImplementation: 'openai-node',
  });
  assert(
    explicitLegacyJsonSchemaTransport instanceof OpenAiTransport,
    '显式 openai-node JSON schema transport 应返回 legacy OpenAiTransport。',
  );

  const aiSdkTransport = createOpenAiCompatibleTransport({
    transportImplementation: 'ai-sdk',
  });
  assert(
    aiSdkTransport instanceof AiSdkOpenAiTransport,
    '显式 ai-sdk transport 应返回 AiSdkOpenAiTransport。',
  );

  assert(
    resolveOpenAiTransportImplementation() === 'ai-sdk',
    '缺省 transportImplementation 应解析为 ai-sdk。',
  );
  assert(
    resolveOpenAiTransportImplementation({ transportImplementation: 'ai-sdk' }) === 'ai-sdk',
    '显式 ai-sdk transportImplementation 应解析为 ai-sdk。',
  );
  assert(
    resolveOpenAiTransportImplementation({ transportImplementation: 'openai-node' }) ===
      'openai-node',
    '显式 openai-node transportImplementation 应解析为 openai-node。',
  );

  console.log('openai transport factory smoke passed');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`openai transport factory smoke failed: ${message}`);
  process.exitCode = 1;
}