import { SPIRIT_CONFIG_SCHEMA_VERSION } from "../config-v2.js";
import type { ModelProviderId } from "../model-provider-presets.js";

import { keyringStore } from "./keyring-store.js";
import {
  KEYRING_GLOBAL_ACCOUNT,
  KEYRING_SERVICE,
  groupAccessKeyIdAccount,
  groupKeyAccount,
  groupSecretAccessKeyAccount,
  groupVertexClientEmailAccount,
  groupVertexPrivateKeyAccount,
  modelKeyAccount,
  modelProviderKeyScope,
  providerAccessKeyIdAccount,
  providerKeyAccount,
  providerSecretAccessKeyAccount,
  providerVertexClientEmailAccount,
  providerVertexPrivateKeyAccount,
} from "./provider-accounts.js";
import {
  loadActiveModelProfile,
  loadModelProfile,
  loadSpiritConfig,
  saveSpiritConfig,
} from "./spirit-config.js";
import type {
  BedrockSetupCredentials,
  GoogleVertexSetupCredentials,
  ProviderSetupResult,
  SpiritConfigFile,
  SpiritModelProfile,
} from "./types.js";

export { loadActiveModelProfile, loadModelProfile, loadSpiritConfig, saveSpiritConfig };
export type { ProviderSetupResult, SpiritConfigFile, SpiritModelProfile };

function readAccount(account: string): string | undefined {
  const value = keyringStore().getPassword(KEYRING_SERVICE, account);
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Group-scoped key first (Desktop/CLI canonical), then provider scope (acp legacy). */
function readScopedKey(groupId: string | undefined, providerId: string): string | undefined {
  if (groupId?.trim()) {
    const groupKey = readAccount(groupKeyAccount(groupId.trim()));
    if (groupKey) {
      return groupKey;
    }
  }
  return readAccount(providerKeyAccount(providerId));
}

function readScopedSubKey(
  groupId: string | undefined,
  providerId: string,
  groupAccount: (groupId: string) => string,
  providerAccount: (providerId: string) => string,
): string | undefined {
  if (groupId?.trim()) {
    const value = readAccount(groupAccount(groupId.trim()));
    if (value) {
      return value;
    }
  }
  return readAccount(providerAccount(providerId));
}

function readModelKey(modelName: string): string | undefined {
  return readAccount(modelKeyAccount(modelName));
}

function readGlobalKey(): string | undefined {
  return readAccount(KEYRING_GLOBAL_ACCOUNT);
}

export function readBedrockCredentials(
  providerId: ModelProviderId,
  groupId?: string,
): BedrockSetupCredentials {
  const credentials: BedrockSetupCredentials = {};
  const apiKey = readScopedKey(groupId, providerId);
  if (apiKey) {
    credentials.apiKey = apiKey;
  }
  const accessKeyId = readScopedSubKey(
    groupId,
    providerId,
    groupAccessKeyIdAccount,
    providerAccessKeyIdAccount,
  );
  if (accessKeyId) {
    credentials.accessKeyId = accessKeyId;
  }
  const secretAccessKey = readScopedSubKey(
    groupId,
    providerId,
    groupSecretAccessKeyAccount,
    providerSecretAccessKeyAccount,
  );
  if (secretAccessKey) {
    credentials.secretAccessKey = secretAccessKey;
  }
  return credentials;
}

export function readGoogleVertexCredentials(
  providerId: ModelProviderId,
  groupId?: string,
): GoogleVertexSetupCredentials {
  const credentials: GoogleVertexSetupCredentials = {};
  const apiKey = readScopedKey(groupId, providerId);
  if (apiKey) {
    credentials.apiKey = apiKey;
  }
  const clientEmail = readScopedSubKey(
    groupId,
    providerId,
    groupVertexClientEmailAccount,
    providerVertexClientEmailAccount,
  );
  if (clientEmail) {
    credentials.clientEmail = clientEmail;
  }
  const privateKey = readScopedSubKey(
    groupId,
    providerId,
    groupVertexPrivateKeyAccount,
    providerVertexPrivateKeyAccount,
  );
  if (privateKey) {
    credentials.privateKey = privateKey;
  }
  return credentials;
}

function hasBedrockRuntimeCredentials(credentials: BedrockSetupCredentials): boolean {
  if (credentials.apiKey?.trim()) {
    return true;
  }
  return Boolean(credentials.accessKeyId?.trim() && credentials.secretAccessKey?.trim());
}

function hasGoogleVertexRuntimeCredentials(input: {
  apiKey?: string;
  clientEmail?: string;
  privateKey?: string;
  vertexProject?: string;
  vertexLocation?: string;
}): boolean {
  if (input.apiKey?.trim()) {
    return true;
  }
  if (input.clientEmail?.trim() && input.privateKey?.trim()) {
    return Boolean(input.vertexProject?.trim() && input.vertexLocation?.trim());
  }
  return Boolean(input.vertexProject?.trim() && input.vertexLocation?.trim());
}

function hasProviderSecret(providerId: ModelProviderId, profile: SpiritModelProfile): boolean {
  if (readScopedKey(profile.groupId, providerId)) {
    return true;
  }
  if (providerId === "amazon-bedrock") {
    return hasBedrockRuntimeCredentials(readBedrockCredentials("amazon-bedrock", profile.groupId));
  }
  if (providerId === "google-vertex-ai") {
    const credentials = readGoogleVertexCredentials("google-vertex-ai", profile.groupId);
    const vertexInput: {
      apiKey?: string;
      clientEmail?: string;
      privateKey?: string;
      vertexProject?: string;
      vertexLocation?: string;
    } = {};
    if (credentials.apiKey) {
      vertexInput.apiKey = credentials.apiKey;
    }
    if (credentials.clientEmail) {
      vertexInput.clientEmail = credentials.clientEmail;
    }
    if (credentials.privateKey) {
      vertexInput.privateKey = credentials.privateKey;
    }
    if (profile.vertexProject) {
      vertexInput.vertexProject = profile.vertexProject;
    }
    if (profile.vertexLocation) {
      vertexInput.vertexLocation = profile.vertexLocation;
    }
    return hasGoogleVertexRuntimeCredentials(vertexInput);
  }
  return false;
}

export function resolveStoredApiKeyForProfile(profile: SpiritModelProfile): string | undefined {
  const scope = modelProviderKeyScope(profile.provider);
  const scopedKey = readScopedKey(profile.groupId, scope);
  if (scopedKey) {
    return scopedKey;
  }
  const modelKey = readModelKey(profile.name);
  if (modelKey) {
    return modelKey;
  }
  return readGlobalKey();
}

export function hasResolvableCredentials(spiritDataDir: string): boolean {
  const profile = loadActiveModelProfile(spiritDataDir);
  if (!profile) {
    return false;
  }
  const scope = modelProviderKeyScope(profile.provider);
  if (hasProviderSecret(scope, profile)) {
    return true;
  }
  return Boolean(resolveStoredApiKeyForProfile(profile));
}

function saveProviderApiKey(providerId: ModelProviderId, apiKey: string | undefined): void {
  const store = keyringStore();
  const account = providerKeyAccount(providerId);
  if (apiKey?.trim()) {
    store.setPassword(KEYRING_SERVICE, account, apiKey.trim());
    return;
  }
  store.deletePassword(KEYRING_SERVICE, account);
}

function saveBedrockCredentials(
  providerId: ModelProviderId,
  credentials: BedrockSetupCredentials,
): void {
  saveProviderApiKey(providerId, credentials.apiKey);
  const store = keyringStore();
  const accessKeyId = credentials.accessKeyId?.trim();
  if (accessKeyId) {
    store.setPassword(KEYRING_SERVICE, providerAccessKeyIdAccount(providerId), accessKeyId);
  } else {
    store.deletePassword(KEYRING_SERVICE, providerAccessKeyIdAccount(providerId));
  }
  const secretAccessKey = credentials.secretAccessKey?.trim();
  if (secretAccessKey) {
    store.setPassword(KEYRING_SERVICE, providerSecretAccessKeyAccount(providerId), secretAccessKey);
  } else {
    store.deletePassword(KEYRING_SERVICE, providerSecretAccessKeyAccount(providerId));
  }
}

function saveGoogleVertexCredentials(
  providerId: ModelProviderId,
  credentials: GoogleVertexSetupCredentials,
): void {
  saveProviderApiKey(providerId, credentials.apiKey);
  const store = keyringStore();
  const clientEmail = credentials.clientEmail?.trim();
  if (clientEmail) {
    store.setPassword(KEYRING_SERVICE, providerVertexClientEmailAccount(providerId), clientEmail);
  } else {
    store.deletePassword(KEYRING_SERVICE, providerVertexClientEmailAccount(providerId));
  }
  const privateKey = credentials.privateKey?.trim();
  if (privateKey) {
    store.setPassword(KEYRING_SERVICE, providerVertexPrivateKeyAccount(providerId), privateKey);
  } else {
    store.deletePassword(KEYRING_SERVICE, providerVertexPrivateKeyAccount(providerId));
  }
}

export async function saveProviderSetup(
  spiritDataDir: string,
  setup: ProviderSetupResult,
): Promise<void> {
  const scope = setup.providerScope;
  if (scope === "amazon-bedrock" && setup.bedrock) {
    saveBedrockCredentials(scope, setup.bedrock);
  } else if (scope === "google-vertex-ai" && setup.vertex) {
    saveGoogleVertexCredentials(scope, setup.vertex);
  } else if (setup.apiKey?.trim()) {
    saveProviderApiKey(scope, setup.apiKey);
  }

  const existing = loadSpiritConfig(spiritDataDir);
  const providerGroups = [...(existing?.providerGroups ?? [])];
  const groupIndex = providerGroups.findIndex((group) => group.id === setup.groupId);
  const activeModel = { groupId: setup.groupId, name: setup.model.name };

  if (groupIndex >= 0) {
    const currentGroup = providerGroups[groupIndex]!;
    const models = currentGroup.models.filter((model) => model.name !== setup.model.name);
    models.push(setup.model);
    providerGroups[groupIndex] = {
      ...currentGroup,
      ...setup.group,
      id: setup.groupId,
      models,
    };
  } else {
    providerGroups.push({
      ...setup.group,
      id: setup.groupId,
      models: [setup.model],
    });
  }

  const config: SpiritConfigFile = {
    ...existing,
    schemaVersion: SPIRIT_CONFIG_SCHEMA_VERSION,
    providerGroups,
    activeModel,
  };
  await saveSpiritConfig(spiritDataDir, config);
}
