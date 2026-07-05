import { McpConfigError } from '../mcp/errors.js';
import {
  LAZY_TOOL_PROVIDER_BUILT_IN,
  LAZY_TOOL_PROVIDER_MCP,
  type BuiltInLazyToolGatewayBackend,
  type LazyToolCallRequest,
  type LazyToolDescribeRequest,
  type LazyToolGatewayBackend,
} from './types.js';

export function createCompositeLazyToolGatewayBackend(options: {
  mcp?: LazyToolGatewayBackend;
  builtIn?: BuiltInLazyToolGatewayBackend;
}): LazyToolGatewayBackend {
  return {
    describe: (request) => describeLazyTool(request, options),
    call: (request) => callLazyTool(request, options),
  };
}

async function describeLazyTool(
  request: LazyToolDescribeRequest,
  options: {
    mcp?: LazyToolGatewayBackend;
    builtIn?: BuiltInLazyToolGatewayBackend;
  },
): ReturnType<LazyToolGatewayBackend['describe']> {
  if (request.provider === LAZY_TOOL_PROVIDER_MCP) {
    if (!options.mcp) {
      throw new McpConfigError('MCP lazy tool backend is not available in this host.');
    }
    return options.mcp.describe(request);
  }

  if (request.provider === LAZY_TOOL_PROVIDER_BUILT_IN) {
    if (!options.builtIn) {
      throw new McpConfigError('Built-in lazy tool backend is not available in this host.');
    }
    return options.builtIn.describe(request);
  }

  throw new McpConfigError(`Unsupported lazy tool provider: ${request.provider}`);
}

async function callLazyTool(
  request: LazyToolCallRequest,
  options: {
    mcp?: LazyToolGatewayBackend;
    builtIn?: BuiltInLazyToolGatewayBackend;
  },
): ReturnType<LazyToolGatewayBackend['call']> {
  if (request.provider === LAZY_TOOL_PROVIDER_MCP) {
    if (!options.mcp) {
      throw new McpConfigError('MCP lazy tool backend is not available in this host.');
    }
    return options.mcp.call(request);
  }

  if (request.provider === LAZY_TOOL_PROVIDER_BUILT_IN) {
    if (!options.builtIn) {
      throw new McpConfigError('Built-in lazy tool backend is not available in this host.');
    }
    return options.builtIn.call(request);
  }

  throw new McpConfigError(`Unsupported lazy tool provider: ${request.provider}`);
}
