import type { ModelRef, ProviderGroupV2 } from '@spiritagent/host-internal';

export function v2ConfigFixture(input: {
  groups: ProviderGroupV2[];
  activeModel: ModelRef;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    providerGroups: input.groups,
    activeModel: input.activeModel,
    ...input.extra,
  };
}

export function openAiGroup(models: ProviderGroupV2['models']): ProviderGroupV2 {
  return {
    id: 'openai',
    provider: 'openai',
    apiBase: 'https://api.openai.com/v1',
    models,
  };
}
