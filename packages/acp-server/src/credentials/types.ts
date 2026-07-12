import type {
  ModelEntryV2,
  ModelProviderId,
  ModelRef,
  ProviderGroupV2,
  ProviderModelTransportKind,
  SpiritConfigSchemaVersion,
  SpiritModelCapabilityV2,
  SpiritModelReasoningEffortV2,
} from '@spiritagent/host-internal';

export type SpiritModelCapability = SpiritModelCapabilityV2;
export type SpiritModelReasoningEffort = SpiritModelReasoningEffortV2;

/** Resolved profile for ACP transport (group connect fields + model entry). */
export interface SpiritModelProfile {
  groupId: string;
  ref: ModelRef;
  name: string;
  apiBase: string;
  reasoningEffort?: SpiritModelReasoningEffort;
  supportedReasoningEfforts?: SpiritModelReasoningEffort[];
  capabilities?: SpiritModelCapability[];
  provider?: ModelProviderId;
  transportKind?: ProviderModelTransportKind;
  providerSite?: string;
  alibabaWorkspaceId?: string;
  awsRegion?: string;
  azureResourceName?: string;
  cloudflareAccountId?: string;
  cloudflareGatewayId?: string;
  vertexProject?: string;
  vertexLocation?: string;
  contextLength?: number;
}

/** Minimal `config.json` fields read/written by ACP; other Desktop fields are preserved on merge. */
export interface SpiritConfigFile {
  schemaVersion: SpiritConfigSchemaVersion;
  providerGroups: ProviderGroupV2[];
  activeModel: ModelRef;
  imageGenerationModel?: ModelRef;
  videoGenerationModel?: ModelRef;
  lightweightChatModel?: ModelRef;
  [key: string]: unknown;
}

export type { ModelEntryV2, ModelRef, ProviderGroupV2 };

export interface BedrockSetupCredentials {
  apiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface GoogleVertexSetupCredentials {
  apiKey?: string;
  clientEmail?: string;
  privateKey?: string;
}

/** Result collected by the setup wizard before persistence. */
export interface ProviderSetupResult {
  groupId: string;
  model: ModelEntryV2;
  providerScope: ModelProviderId;
  group: Omit<ProviderGroupV2, 'models'>;
  apiKey?: string;
  bedrock?: BedrockSetupCredentials;
  vertex?: GoogleVertexSetupCredentials;
}
