import type { AuthorizationDecision } from '../ports.js';
import { TOOL_CALL_TOOL_NAME, TOOL_DESCRIBE_TOOL_NAME } from './definitions.js';
import { parseLazyToolGatewayArguments } from './parse.js';
import { LAZY_TOOL_PROVIDER_BUILT_IN, LAZY_TOOL_PROVIDER_MCP } from './types.js';
import type { LazyToolCallRequest, LazyToolGatewayToolRequest } from './types.js';

export type LazyToolGatewayApprovalLevel = 'default' | 'auto-approval' | 'full-approval';

export function authorizeLazyToolGatewayRequest(
  request: LazyToolGatewayToolRequest,
  approvalLevel: LazyToolGatewayApprovalLevel,
): AuthorizationDecision<string> {
  if (request.name === TOOL_DESCRIBE_TOOL_NAME) {
    return { kind: 'allowed' };
  }

  if (request.name !== TOOL_CALL_TOOL_NAME) {
    return { kind: 'allowed' };
  }

  if (approvalLevel === 'full-approval') {
    return { kind: 'allowed' };
  }

  const parsed = parseLazyToolGatewayArguments(request.name, request.argumentsJson) as LazyToolCallRequest;
  return {
    kind: 'need-approval',
    prompt: buildLazyToolCallApprovalPrompt(parsed),
    trustTarget: lazyToolCallTrustTarget(parsed),
  };
}

function lazyToolCallTrustTarget(request: LazyToolCallRequest): string {
  if (request.provider === LAZY_TOOL_PROVIDER_BUILT_IN) {
    return `built-in:${request.server}:${request.tool}`;
  }
  return `mcp:${request.server}:${request.tool}`;
}

function buildLazyToolCallApprovalPrompt(request: LazyToolCallRequest): string {
  const argsText =
    request.arguments === undefined
      ? '(none)'
      : JSON.stringify(request.arguments, null, 2);
  if (request.provider === LAZY_TOOL_PROVIDER_BUILT_IN) {
    return (
      `高风险工具调用: built-in tool_call\n` +
      `服务器: ${request.server}\n` +
      `工具: ${request.tool}\n` +
      `参数:\n${argsText}`
    );
  }
  if (request.provider !== LAZY_TOOL_PROVIDER_MCP) {
    return (
      `高风险工具调用: tool_call\n` +
      `provider: ${request.provider}\n` +
      `服务器: ${request.server}\n` +
      `工具: ${request.tool}\n` +
      `参数:\n${argsText}`
    );
  }
  return (
    `高风险工具调用: MCP tool_call\n` +
    `服务器: ${request.server}\n` +
    `工具: ${request.tool}\n` +
    `参数:\n${argsText}`
  );
}
