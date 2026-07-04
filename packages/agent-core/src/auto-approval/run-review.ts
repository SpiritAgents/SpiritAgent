import type { JsonSchemaTransport } from '../json-schema.js';
import type { LlmTransportConfig } from '../provider-config.js';

import { buildAutoApprovalReviewPrompt } from './prompt.js';
import { AUTO_APPROVAL_REVIEW_JSON_SCHEMA, AUTO_APPROVAL_REVIEW_SCHEMA_NAME } from './schema.js';
import type { ToolAutoReviewInput, ToolAutoReviewResult } from './types.js';

export function normalizeAutoApprovalReviewResult(
  value: { allow?: unknown; reason?: unknown } | undefined,
): ToolAutoReviewResult | undefined {
  if (!value || typeof value.allow !== 'boolean') {
    return undefined;
  }
  const reason = typeof value.reason === 'string' ? value.reason.trim() : '';
  if (!reason) {
    return undefined;
  }
  return { allow: value.allow, reason };
}

export async function runAutoApprovalReview(
  transport: JsonSchemaTransport,
  config: LlmTransportConfig,
  input: ToolAutoReviewInput,
  options?: { systemSections?: Array<string | undefined> },
): Promise<ToolAutoReviewResult | undefined> {
  try {
    const result = await transport.createJsonSchemaCompletion<{ allow: boolean; reason: string }>(
      config,
      {
        userPrompt: buildAutoApprovalReviewPrompt(input),
        schemaName: AUTO_APPROVAL_REVIEW_SCHEMA_NAME,
        schema: AUTO_APPROVAL_REVIEW_JSON_SCHEMA,
        includeToolAgentHostPrompt: false,
        ...(options?.systemSections ? { systemSections: options.systemSections } : {}),
      },
    );
    return normalizeAutoApprovalReviewResult(result.output);
  } catch {
    return undefined;
  }
}
