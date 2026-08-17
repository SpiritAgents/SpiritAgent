import type { AuthorizationDecision } from "../ports.js";
import { TOOL_CALL_TOOL_NAME, TOOL_DESCRIBE_TOOL_NAME } from "./definitions.js";
import { parseLazyToolGatewayArguments } from "./parse.js";
import { LAZY_TOOL_PROVIDER_BUILT_IN, LAZY_TOOL_PROVIDER_MCP } from "./types.js";
import type { LazyToolCallRequest, LazyToolGatewayToolRequest } from "./types.js";

export type LazyToolGatewayApprovalLevel = "default" | "auto-approval" | "bypass-approval";

export function authorizeLazyToolGatewayRequest(
  request: LazyToolGatewayToolRequest,
  approvalLevel: LazyToolGatewayApprovalLevel,
): AuthorizationDecision<string> {
  if (request.name === TOOL_DESCRIBE_TOOL_NAME) {
    return { kind: "allowed" };
  }

  if (request.name !== TOOL_CALL_TOOL_NAME) {
    return { kind: "allowed" };
  }

  if (approvalLevel === "bypass-approval") {
    return { kind: "allowed" };
  }

  const parsed = parseLazyToolGatewayArguments(
    request.name,
    request.argumentsJson,
  ) as LazyToolCallRequest;
  return {
    kind: "need-approval",
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
    request.arguments === undefined ? "(none)" : JSON.stringify(request.arguments, null, 2);
  if (request.provider === LAZY_TOOL_PROVIDER_BUILT_IN) {
    return (
      `High-risk tool call: built-in tool_call\n` +
      `Server: ${request.server}\n` +
      `Tool: ${request.tool}\n` +
      `Arguments:\n${argsText}`
    );
  }
  if (request.provider !== LAZY_TOOL_PROVIDER_MCP) {
    return (
      `High-risk tool call: tool_call\n` +
      `provider: ${request.provider}\n` +
      `Server: ${request.server}\n` +
      `Tool: ${request.tool}\n` +
      `Arguments:\n${argsText}`
    );
  }
  return (
    `High-risk tool call: MCP tool_call\n` +
    `Server: ${request.server}\n` +
    `Tool: ${request.tool}\n` +
    `Arguments:\n${argsText}`
  );
}
