import type { ModelProviderId } from "../model-provider-presets.js";

export const KEYRING_SERVICE = "Spirit";
export const KEYRING_GLOBAL_ACCOUNT = "openai_api_key";

/**
 * Canonical (Desktop/CLI) account scheme: keys are scoped by provider *group*
 * id from config.json. The `provider::{id}` scheme is the acp-server legacy;
 * readers check group first, then provider.
 */
export function groupKeyAccount(groupId: string): string {
  return `group::${groupId}`;
}

export function groupAccessKeyIdAccount(groupId: string): string {
  return `group::${groupId}::access-key-id`;
}

export function groupSecretAccessKeyAccount(groupId: string): string {
  return `group::${groupId}::secret-access-key`;
}

export function groupVertexClientEmailAccount(groupId: string): string {
  return `group::${groupId}::client-email`;
}

export function groupVertexPrivateKeyAccount(groupId: string): string {
  return `group::${groupId}::private-key`;
}

export function providerKeyAccount(providerId: string): string {
  return `provider::${providerId}`;
}

export function providerAccessKeyIdAccount(providerId: string): string {
  return `provider::${providerId}::access-key-id`;
}

export function providerSecretAccessKeyAccount(providerId: string): string {
  return `provider::${providerId}::secret-access-key`;
}

export function providerVertexClientEmailAccount(providerId: string): string {
  return `provider::${providerId}::client-email`;
}

export function providerVertexPrivateKeyAccount(providerId: string): string {
  return `provider::${providerId}::private-key`;
}

export function modelKeyAccount(modelName: string): string {
  return `model::${modelName}`;
}

/** Config profiles without `provider` use custom-scoped keys. */
export function modelProviderKeyScope(provider?: ModelProviderId): ModelProviderId {
  return provider ?? "custom";
}
