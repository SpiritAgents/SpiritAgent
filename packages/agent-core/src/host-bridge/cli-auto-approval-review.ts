import { runAutoApprovalReview } from "../auto-approval/run-review.js";
import type { ToolAutoReviewInput, ToolAutoReviewResult } from "../auto-approval/types.js";
import type { LlmTransportConfig } from "../provider-config.js";
import { isBedrockTransportConfig } from "../provider-config.js";
import { buildSpiritAgentCoreHostPrompt } from "../tool-agent.js";
import { createJsonSchemaTransport } from "../transport-factory.js";

function providerIdForTransportConfig(config: LlmTransportConfig): string | undefined {
  if (isBedrockTransportConfig(config)) {
    return "bedrock";
  }
  return config.llmVendor;
}

/** When the CLI has no separate lightweight config, reuse the current transport's active model. */
export function createCliAutoApprovalReviewer(
  config: LlmTransportConfig,
): (input: ToolAutoReviewInput) => Promise<ToolAutoReviewResult | undefined> {
  return async (input) => {
    if (!config.apiKey?.trim()) {
      return undefined;
    }
    const transport = createJsonSchemaTransport(config);
    return runAutoApprovalReview(transport, config, input, {
      systemSections: [
        buildSpiritAgentCoreHostPrompt(config.model, providerIdForTransportConfig(config)),
      ],
    });
  };
}
