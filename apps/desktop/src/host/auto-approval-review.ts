import {
  buildSpiritAgentCoreHostPrompt,
  createJsonSchemaTransport,
  runAutoApprovalReview,
  type ToolAutoReviewInput,
  type ToolAutoReviewResult,
} from '@spiritagent/agent-core';

import { resolveLightweightChatModelProfile } from './lightweight-chat-model.js';
import { buildPrimaryTransportConfig } from './model-config.js';
import { currentApiBase } from './service-utils.js';
import type { DesktopConfigFile } from './storage.js';
import { resolveApiKeyForConfigModel } from './storage.js';

export function createDesktopAutoApprovalReviewer(input: {
  config: DesktopConfigFile;
  workspaceRoot: string;
}): (reviewInput: ToolAutoReviewInput) => Promise<ToolAutoReviewResult | undefined> {
  return async (reviewInput) => {
    const resolved = resolveLightweightChatModelProfile(input.config);
    if (!resolved) {
      return undefined;
    }

    const apiKey = await resolveApiKeyForConfigModel(input.config, resolved.profile.ref);
    if (!apiKey) {
      return undefined;
    }

    const transportConfig = buildPrimaryTransportConfig({
      apiKey,
      model: resolved.name,
      baseUrl: resolved.profile.apiBase ?? currentApiBase(input.config),
      workspaceRoot: input.workspaceRoot,
      profile: resolved.profile,
    });
    const transport = createJsonSchemaTransport(transportConfig);
    return runAutoApprovalReview(transport, transportConfig, reviewInput, {
      systemSections: [buildSpiritAgentCoreHostPrompt(resolved.name)],
    });
  };
}
