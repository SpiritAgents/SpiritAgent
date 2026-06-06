import type {
  DesktopModelCatalogHint,
  DesktopModelProvider,
  DesktopSnapshot,
} from '@/types';

const CONTEXT_USAGE_PROVIDERS = new Set<DesktopModelProvider>([
  'openrouter',
  'vercel-ai-gateway',
]);

export function supportsContextUsageProvider(provider: DesktopModelProvider | undefined): boolean {
  return provider !== undefined && CONTEXT_USAGE_PROVIDERS.has(provider);
}

export function resolveModelContextLength(
  activeModel: DesktopSnapshot['config']['models'][number] | undefined,
  catalogHints: DesktopModelCatalogHint[] | undefined,
): number | undefined {
  if (!activeModel || !supportsContextUsageProvider(activeModel.provider)) {
    return undefined;
  }

  const modelName = activeModel.name.trim();
  if (!modelName) {
    return undefined;
  }

  const apiBase = activeModel.apiBase.trim();
  const transportKind = activeModel.transportKind
    ?? (activeModel.provider === 'anthropic' ? 'anthropic' : 'openai-compatible');
  const hint = catalogHints?.find((entry) => {
    if (entry.provider !== activeModel.provider) {
      return false;
    }
    if (entry.transportKind !== undefined && entry.transportKind !== transportKind) {
      return false;
    }
    return entry.apiBase.trim() === apiBase;
  });

  const catalogEntry = hint?.modelCatalog?.find((entry) => entry.id === modelName);
  const contextLength = catalogEntry?.contextLength;
  if (typeof contextLength !== 'number' || !Number.isFinite(contextLength) || contextLength <= 0) {
    return undefined;
  }

  return Math.trunc(contextLength);
}

export function buildContextUsagePercent(inputTokens: number, contextLength: number): number {
  if (contextLength <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((inputTokens / contextLength) * 100)));
}
