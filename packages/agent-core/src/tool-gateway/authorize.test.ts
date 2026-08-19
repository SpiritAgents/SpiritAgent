import assert from "node:assert/strict";
import test from "node:test";

import { authorizeLazyToolGatewayRequest } from "./authorize.js";
import { TOOL_CALL_TOOL_NAME, TOOL_DESCRIBE_TOOL_NAME } from "./definitions.js";
import type { LazyToolGatewayToolRequest } from "./types.js";

function lazyRequest(name: string, args: Record<string, unknown>): LazyToolGatewayToolRequest {
  return {
    kind: "lazyToolGateway",
    name,
    argumentsJson: JSON.stringify(args),
  };
}

test("authorizeLazyToolGatewayRequest allows tool_describe without approval", () => {
  const decision = authorizeLazyToolGatewayRequest(
    lazyRequest(TOOL_DESCRIBE_TOOL_NAME, { provider: "mcp", server: "github", tool: "search" }),
    "default",
  );
  assert.equal(decision.kind, "allowed");
});

test("authorizeLazyToolGatewayRequest requires approval for tool_call under default", () => {
  const decision = authorizeLazyToolGatewayRequest(
    lazyRequest(TOOL_CALL_TOOL_NAME, {
      provider: "mcp",
      server: "msftlearn",
      tool: "microsoft_docs_search",
      arguments: { query: "azure" },
    }),
    "default",
  );
  assert.equal(decision.kind, "need-approval");
  if (decision.kind === "need-approval") {
    assert.match(decision.prompt, /msftlearn/u);
    assert.match(decision.prompt, /microsoft_docs_search/u);
    // No MCP permission domain in v1: lazy-gateway approvals carry no remember target.
    assert.equal(decision.rememberTarget, undefined);
  }
});

test("authorizeLazyToolGatewayRequest requires approval for tool_call under auto-approval", () => {
  const decision = authorizeLazyToolGatewayRequest(
    lazyRequest(TOOL_CALL_TOOL_NAME, {
      provider: "mcp",
      server: "msftlearn",
      tool: "microsoft_docs_search",
    }),
    "auto-approval",
  );
  assert.equal(decision.kind, "need-approval");
});

test("authorizeLazyToolGatewayRequest requires approval for built-in tool_call under default", () => {
  const decision = authorizeLazyToolGatewayRequest(
    lazyRequest(TOOL_CALL_TOOL_NAME, {
      provider: "built-in",
      server: "desktop",
      tool: "create_automation",
      arguments: { overview: "Daily summary." },
    }),
    "default",
  );
  assert.equal(decision.kind, "need-approval");
  if (decision.kind === "need-approval") {
    assert.match(decision.prompt, /built-in tool_call/u);
    assert.match(decision.prompt, /create_automation/u);
    assert.equal(decision.rememberTarget, undefined);
  }
});

test("authorizeLazyToolGatewayRequest allows tool_call under bypass-approval", () => {
  const decision = authorizeLazyToolGatewayRequest(
    lazyRequest(TOOL_CALL_TOOL_NAME, {
      provider: "mcp",
      server: "msftlearn",
      tool: "microsoft_docs_search",
    }),
    "bypass-approval",
  );
  assert.equal(decision.kind, "allowed");
});
