/** Re-export agent-core Cloudflare AI Gateway helpers for renderer-safe host-internal consumers. */

export {
  CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID_PLACEHOLDER,
  CLOUDFLARE_AI_GATEWAY_PRESET_API_BASE,
  cloudflareAiGatewayApiBaseFromAccountId,
  extractCloudflareAccountIdFromApiBase,
  isValidCloudflareAccountId,
  isValidCloudflareGatewayId,
  normalizeCloudflareAccountId,
  normalizeCloudflareGatewayId,
  validateCloudflareAccountId,
  validateCloudflareGatewayId,
} from '@spiritagent/agent-core/cloudflare-ai-gateway-resource';
