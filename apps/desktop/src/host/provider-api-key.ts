import type { DesktopModelProvider } from '../types.js';

/** Keyring account for a provider-scoped API key (`SpiritAgent` / `provider::{id}`). */
export function providerKeyAccount(providerId: string): string {
  return `provider::${providerId}`;
}

/** Config profiles without `provider` are treated as custom-scoped keys. */
export function modelProviderKeyScope(provider?: DesktopModelProvider): DesktopModelProvider {
  return provider ?? 'custom';
}

export interface ModelKeyPresenceProfile {
  name: string;
  provider?: DesktopModelProvider;
}

/**
 * Per-model keyring presence: provider-level entry OR legacy per-model entry.
 * Does not include env vars or global fallback (snapshot `keyConfigured` semantics).
 */
export function buildModelSecretKeyPresence(
  profiles: ModelKeyPresenceProfile[],
  hasProviderKey: (providerId: string) => boolean,
  hasModelKey: (modelName: string) => boolean,
): Record<string, boolean> {
  const providerCache = new Map<string, boolean>();
  const out: Record<string, boolean> = {};
  for (const { name, provider } of profiles) {
    const scope = modelProviderKeyScope(provider);
    let providerPresent = providerCache.get(scope);
    if (providerPresent === undefined) {
      providerPresent = hasProviderKey(scope);
      providerCache.set(scope, providerPresent);
    }
    out[name] = providerPresent ? true : hasModelKey(name);
  }
  return out;
}
