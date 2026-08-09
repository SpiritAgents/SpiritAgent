import {
  resolveToolAutoReviewGate,
  resolveToolInputSchema,
  type SessionApprovalLevel,
  type ToolAutoReviewGateOutcome,
  type ToolAutoReviewInput,
  type ToolAutoReviewer,
} from "../auto-approval/index.js";
import type { AuthorizationDecision, JsonValue, ToolCallRequest } from "../ports.js";
import type { PreToolUseGateResult } from "../hooks/tool-hooks.js";
import type { ToolApprovalGate } from "../hooks/tool-hooks.js";

export interface ResolvedToolApprovalGate<
  TrustTarget = string,
> extends ToolApprovalGate<TrustTarget> {
  autoReviewBlockReason?: string;
}

/** Per-tool-call auto-review outcomes shared across a turn (including recursive remaining batches). */
export type AutoReviewCache = Map<string, Promise<ToolAutoReviewGateOutcome>>;

export function buildToolAutoReviewInput(input: {
  toolName: string;
  argumentsJson: string;
  hostApprovalContext: string;
  toolDefinitions: JsonValue;
  targetMcpToolSchema?: JsonValue;
}): ToolAutoReviewInput {
  const inputSchema = resolveToolInputSchema(input.toolDefinitions, input.toolName);
  return {
    toolName: input.toolName,
    argumentsJson: input.argumentsJson,
    ...(inputSchema !== undefined ? { inputSchema } : {}),
    ...(input.targetMcpToolSchema !== undefined
      ? { targetMcpToolSchema: input.targetMcpToolSchema }
      : {}),
    hostApprovalContext: input.hostApprovalContext,
  };
}

function gateFromAutoReviewOutcome<TrustTarget>(
  gate: ToolApprovalGate<TrustTarget>,
  outcome: ToolAutoReviewGateOutcome,
): ResolvedToolApprovalGate<TrustTarget> | null {
  if (outcome.kind === "allowed") {
    return null;
  }
  if (outcome.kind === "blocked") {
    return {
      ...gate,
      autoReviewBlockReason: outcome.reason,
    };
  }
  return gate;
}

export async function applyAutoReviewToApprovalGate<TrustTarget, ToolRequest>(
  approvalLevel: SessionApprovalLevel | undefined,
  reviewToolApproval: ToolAutoReviewer | undefined,
  toolDefinitions: JsonValue,
  call: { name: string; argumentsJson: string },
  gate: ToolApprovalGate<TrustTarget>,
  preGate?: PreToolUseGateResult<ToolRequest>,
  toolCallId?: string,
  reviewCache?: AutoReviewCache,
): Promise<ResolvedToolApprovalGate<TrustTarget> | null> {
  if (!reviewToolApproval || approvalLevel !== "auto-approval") {
    return gate;
  }
  // Hook permission: ask must stay on manual approval; auto review must not bypass it.
  if (preGate?.kind === "needs-approval") {
    return gate;
  }

  let outcome: ToolAutoReviewGateOutcome;
  const cached = toolCallId && reviewCache ? reviewCache.get(toolCallId) : undefined;
  if (cached) {
    outcome = await cached;
  } else {
    const reviewPromise = resolveToolAutoReviewGate(
      approvalLevel,
      reviewToolApproval,
      buildToolAutoReviewInput({
        toolName: call.name,
        argumentsJson: call.argumentsJson,
        hostApprovalContext: gate.prompt,
        toolDefinitions,
      }),
    );
    if (toolCallId && reviewCache) {
      reviewCache.set(toolCallId, reviewPromise);
    }
    outcome = await reviewPromise;
  }

  return gateFromAutoReviewOutcome(gate, outcome);
}

/**
 * Start auto-review LLM calls for every tool in the batch that host-authorize
 * marks need-approval. Does not await reviews (pipeline); execution awaits via cache.
 * Skips PreToolUse hooks here to avoid double side effects — hook ask is still
 * honored in applyAutoReviewToApprovalGate before consuming cache.
 */
export function prefetchAutoReviewsForToolCalls<ToolRequest, TrustTarget = string>(input: {
  calls: readonly ToolCallRequest[];
  approvalLevel: SessionApprovalLevel | undefined;
  reviewToolApproval: ToolAutoReviewer | undefined;
  toolDefinitions: JsonValue;
  reviewCache: AutoReviewCache;
  requestFromFunctionCall(name: string, argumentsJson: string): Promise<ToolRequest>;
  authorize(request: ToolRequest): Promise<AuthorizationDecision<TrustTarget>>;
}): void {
  const { approvalLevel, reviewToolApproval, reviewCache } = input;
  if (!reviewToolApproval || approvalLevel !== "auto-approval") {
    return;
  }

  for (const call of input.calls) {
    if (reviewCache.has(call.id)) {
      continue;
    }

    const reviewPromise = (async (): Promise<ToolAutoReviewGateOutcome> => {
      try {
        const request = await input.requestFromFunctionCall(call.name, call.argumentsJson);
        const authorization = await input.authorize(request);
        if (authorization.kind !== "need-approval") {
          return { kind: "manual" };
        }
        return resolveToolAutoReviewGate(
          approvalLevel,
          reviewToolApproval,
          buildToolAutoReviewInput({
            toolName: call.name,
            argumentsJson: call.argumentsJson,
            hostApprovalContext: authorization.prompt,
            toolDefinitions: input.toolDefinitions,
          }),
        );
      } catch {
        return { kind: "manual" };
      }
    })();

    reviewCache.set(call.id, reviewPromise);
  }
}
