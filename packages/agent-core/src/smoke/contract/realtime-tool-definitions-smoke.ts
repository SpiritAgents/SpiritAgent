import { demoLookupToolDefinition } from '../shared/demo-tool.js';
import { toRealtimeToolDefinitions } from '../../realtime/tool-definitions.js';
import { printSmokeSection } from '../shared/print.js';

async function main(): Promise<void> {
  const converted = toRealtimeToolDefinitions(demoLookupToolDefinition());

  printSmokeSection('realtime tool definitions smoke', {
    toolCount: converted.length,
    tools: converted,
  });

  if (converted.length !== 1) {
    throw new Error('realtime tool definitions smoke 未转换出预期数量的工具。');
  }

  const tool = converted[0]!;
  if (tool.type !== 'function' || tool.name !== 'demo_lookup') {
    throw new Error('realtime tool definitions smoke 工具名称不符合预期。');
  }

  const parameters = tool.parameters;
  if (parameters.type !== 'object' || !('query' in (parameters.properties as Record<string, unknown> ?? {}))) {
    throw new Error('realtime tool definitions smoke 工具参数 schema 不符合预期。');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime tool definitions smoke failed: ${message}`);
  process.exitCode = 1;
});
