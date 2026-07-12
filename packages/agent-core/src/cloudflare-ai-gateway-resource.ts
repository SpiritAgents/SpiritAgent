/** Cloudflare AI Gateway REST API base URL helpers（无 Node 或 SDK 依赖）。 */

export const CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID_PLACEHOLDER = 'YOUR_ACCOUNT_ID';

export const CLOUDFLARE_AI_GATEWAY_PRESET_API_BASE =
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID_PLACEHOLDER}/ai/v1`;

const CLOUDFLARE_ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;

/** Gateway 名称：字母、数字、连字符与下划线，1–64 字符。 */
const CLOUDFLARE_GATEWAY_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,62}[a-zA-Z0-9])?$/;

export function normalizeCloudflareAccountId(accountId: string): string {
  return accountId.trim();
}

export function isValidCloudflareAccountId(accountId: string): boolean {
  const normalized = normalizeCloudflareAccountId(accountId);
  return CLOUDFLARE_ACCOUNT_ID_PATTERN.test(normalized);
}

export function validateCloudflareAccountId(accountId: string): string {
  const normalized = normalizeCloudflareAccountId(accountId);
  if (!isValidCloudflareAccountId(normalized)) {
    throw new Error('Cloudflare Account ID must be a 32-character hexadecimal string.');
  }
  return normalized;
}

export function normalizeCloudflareGatewayId(gatewayId: string): string {
  return gatewayId.trim();
}

export function isValidCloudflareGatewayId(gatewayId: string): boolean {
  const normalized = normalizeCloudflareGatewayId(gatewayId);
  if (normalized.length < 1 || normalized.length > 64) {
    return false;
  }
  return CLOUDFLARE_GATEWAY_ID_PATTERN.test(normalized);
}

export function validateCloudflareGatewayId(gatewayId: string): string {
  const normalized = normalizeCloudflareGatewayId(gatewayId);
  if (!isValidCloudflareGatewayId(normalized)) {
    throw new Error(
      'Cloudflare Gateway ID must be 1–64 characters and contain only letters, numbers, hyphens, and underscores; it cannot start or end with a hyphen or underscore.',
    );
  }
  return normalized;
}

export function cloudflareAiGatewayApiBaseFromAccountId(accountId: string): string {
  const normalized = normalizeCloudflareAccountId(accountId);
  if (!normalized) {
    return CLOUDFLARE_AI_GATEWAY_PRESET_API_BASE;
  }
  return `https://api.cloudflare.com/client/v4/accounts/${validateCloudflareAccountId(normalized)}/ai/v1`;
}

export function extractCloudflareAccountIdFromApiBase(baseUrl: string): string | undefined {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  const match = normalized.match(
    /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/([a-f0-9]{32})\/ai\/v1(?:\/|$)/i,
  );
  const accountId = match?.[1]?.trim();
  if (!accountId || !isValidCloudflareAccountId(accountId)) {
    return undefined;
  }
  return accountId;
}
