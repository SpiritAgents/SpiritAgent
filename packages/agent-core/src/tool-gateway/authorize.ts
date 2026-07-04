import type { AuthorizationDecision } from '../ports.js';
import { TOOL_CALL_TOOL_NAME, TOOL_DESCRIBE_TOOL_NAME } from './definitions.js';
import { parseLazyToolGatewayArguments } from './parse.js';
import type { LazyToolCallRequest, LazyToolGatewayToolRequest } from './types.js';

export type LazyToolGatewayApprovalLevel = 'default' | 'full-approval';

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
    trustTarget: `mcp:${parsed.server}:${parsed.tool}`,
  };
}

function buildLazyToolCallApprovalPrompt(request: LazyToolCallRequest): string {
  const argsText =
    request.arguments === undefined
      ? '(none)'
      : JSON.stringify(request.arguments, null, 2);
  return (
    `高风险工具调用: MCP tool_call\n` +
    `服务器: ${request.server}\n` +
    `工具: ${request.tool}\n` +
    `参数:\n${argsText}`
  );
}
