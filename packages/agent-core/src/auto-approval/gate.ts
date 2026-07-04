import type {
  SessionApprovalLevel,
  ToolAutoReviewGateOutcome,
  ToolAutoReviewInput,
  ToolAutoReviewer,
} from './types.js';

export async function resolveToolAutoReviewGate(
  approvalLevel: SessionApprovalLevel | undefined,
  reviewToolApproval: ToolAutoReviewer | undefined,
  input: ToolAutoReviewInput,
): Promise<ToolAutoReviewGateOutcome> {
  if (approvalLevel !== 'auto-approval' || !reviewToolApproval) {
    return { kind: 'manual' };
  }

  const result = await reviewToolApproval(input);
  if (!result) {
    return { kind: 'manual' };
  }
  if (result.allow) {
    return { kind: 'allowed' };
  }
  return { kind: 'blocked', reason: result.reason };
}
