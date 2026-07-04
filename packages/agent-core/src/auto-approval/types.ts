import type { JsonValue } from '../ports.js';

export type SessionApprovalLevel = 'default' | 'auto-approval' | 'full-approval';

export interface ToolAutoReviewInput {
  toolName: string;
  argumentsJson: string;
  inputSchema?: JsonValue;
  targetMcpToolSchema?: JsonValue;
  hostApprovalContext: string;
}

export interface ToolAutoReviewResult {
  allow: boolean;
  reason: string;
}

export type ToolAutoReviewer = (input: ToolAutoReviewInput) => Promise<ToolAutoReviewResult | undefined>;

export type ToolAutoReviewGateOutcome =
  | { kind: 'manual' }
  | { kind: 'allowed' }
  | { kind: 'blocked'; reason: string };
