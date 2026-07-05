import { McpConfigError } from '../mcp/errors.js';
import { findBuiltInLazyToolIndexEntry } from './built-in-catalog.js';
import type {
  BuiltInLazyToolGatewayBackend,
  BuiltInLazyToolIndexEntry,
  LazyToolCallRequest,
  LazyToolDescribeRequest,
} from './types.js';

export function createBuiltInLazyToolGatewayBackend(
  indexEntries: readonly BuiltInLazyToolIndexEntry[],
): BuiltInLazyToolGatewayBackend {
  return {
    describe: (request) => describeBuiltInTool(indexEntries, request),
    call: async () => {
      throw new McpConfigError('Built-in lazy tool execution must be provided by the host.');
    },
  };
}

export function createBuiltInLazyToolGatewayBackendWithCall(
  indexEntries: readonly BuiltInLazyToolIndexEntry[],
  call: BuiltInLazyToolGatewayBackend['call'],
): BuiltInLazyToolGatewayBackend {
  return {
    describe: (request) => describeBuiltInTool(indexEntries, request),
    call,
  };
}

async function describeBuiltInTool(
  indexEntries: readonly BuiltInLazyToolIndexEntry[],
  request: LazyToolDescribeRequest,
) {
  const entry = findBuiltInLazyToolIndexEntry(indexEntries, request.server, request.tool);
  if (!entry) {
    throw new McpConfigError(`Unknown built-in tool: ${request.server}/${request.tool}`);
  }

  return {
    description: entry.description,
    inputSchema: entry.inputSchema,
  };
}

export function parseBuiltInLazyToolCallArguments(
  request: LazyToolCallRequest,
): Record<string, unknown> {
  const argsValue = request.arguments;
  if (argsValue === undefined) {
    return {};
  }
  if (typeof argsValue !== 'object' || argsValue === null || Array.isArray(argsValue)) {
    throw new McpConfigError('tool_call arguments must be a JSON object when provided');
  }
  return argsValue as Record<string, unknown>;
}
