import {
  resolveToolAutoReviewGate,
  resolveToolInputSchema,
  type SessionApprovalLevel,
  type ToolAutoReviewInput,
  type ToolAutoReviewer,
} from '../auto-approval/index.js';
import type { JsonValue } from '../ports.js';
import type { ToolApprovalGate } from '../hooks/tool-hooks.js';

export interface ResolvedToolApprovalGate<TrustTarget = string>
  extends ToolApprovalGate<TrustTarget> {
  autoReviewBlockReason?: string;
}

export function buildToolAutoReviewInput(input: {
  toolName: string;
  argumentsJson: string;
  hostApprovalContext: string;
  toolDefinitions: JsonValue;
  targetMcpToolSchema?: JsonValue;
}): ToolAutoReviewInput {
  return {
    toolName: input.toolName,
    argumentsJson: input.argumentsJson,
    inputSchema: resolveToolInputSchema(input.toolDefinitions, input.toolName),
    ...(input.targetMcpToolSchema !== undefined
      ? { targetMcpToolSchema: input.targetMcpToolSchema }
      : {}),
    hostApprovalContext: input.hostApprovalContext,
  };
}

export async function applyAutoReviewToApprovalGate<TrustTarget>(
  approvalLevel: SessionApprovalLevel | undefined,
  reviewToolApproval: ToolAutoReviewer | undefined,
  toolDefinitions: JsonValue,
  call: { name: string; argumentsJson: string },
  gate: ToolApprovalGate<TrustTarget>,
): Promise<ResolvedToolApprovalGate<TrustTarget> | null> {
  if (!reviewToolApproval || approvalLevel !== 'auto-approval') {
    return gate;
  }

  const outcome = await resolveToolAutoReviewGate(
    approvalLevel,
    reviewToolApproval,
    buildToolAutoReviewInput({
      toolName: call.name,
      argumentsJson: call.argumentsJson,
      hostApprovalContext: gate.prompt,
      toolDefinitions,
    }),
  );

  if (outcome.kind === 'allowed') {
    return null;
  }
  if (outcome.kind === 'blocked') {
    return {
      ...gate,
      autoReviewBlockReason: outcome.reason,
    };
  }
  return gate;
}
