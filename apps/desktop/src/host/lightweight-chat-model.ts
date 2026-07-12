import type { ModelRef } from '../types.js';
import type { DesktopConfigFile } from './storage.js';
import {
  flattenProviderGroups,
  modelSupportsChat,
  resolveModelProfile,
  type ResolvedModelProfile,
} from './model-config-access.js';

export type LightweightChatModelResolveInput = Pick<
  DesktopConfigFile,
  'activeModel' | 'lightweightChatModel' | 'providerGroups'
>;

export { modelSupportsChat };

export const LIGHTWEIGHT_CHAT_MODEL_FALLBACK_PATTERNS = ['deepseek-v4-flash'] as const;

export function normalizeLightweightChatModel(
  value: ModelRef | undefined,
  config: Pick<DesktopConfigFile, 'providerGroups'>,
): ModelRef | undefined {
  const profile = resolveModelProfile(config, value);
  return profile && modelSupportsChat(profile) ? profile.ref : undefined;
}

export function resolveLightweightChatModelName(
  config: LightweightChatModelResolveInput,
): ModelRef {
  const explicit = normalizeLightweightChatModel(config.lightweightChatModel, config);
  if (explicit) {
    return explicit;
  }

  const models = flattenProviderGroups(config);
  for (const pattern of LIGHTWEIGHT_CHAT_MODEL_FALLBACK_PATTERNS) {
    const lowerPattern = pattern.toLowerCase();
    const match = models.find(
      (model) => modelSupportsChat(model) && model.name.toLowerCase().includes(lowerPattern),
    );
    if (match) {
      return match.ref;
    }
  }

  return config.activeModel;
}

export function resolveLightweightChatModelProfile(
  config: LightweightChatModelResolveInput,
): { name: string; profile: ResolvedModelProfile } | null {
  const ref = resolveLightweightChatModelName(config);
  const profile = resolveModelProfile(config, ref);
  if (!profile || !modelSupportsChat(profile)) {
    return null;
  }

  return { name: profile.name, profile };
}
