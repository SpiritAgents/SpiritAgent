import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  HOOK_EVENT_NAMES,
  resolveHookCommandPath,
  type HookEventName,
  type ResolvedHookDefinition,
} from '@spiritagent/agent-core';

import type { LoadedHooksConfig } from './loader.js';

export const WORKSPACE_CAPABILITY_TRUST_FILE = 'workspace-capability-trust.json';
export const WORKSPACE_CAPABILITY_TRUST_VERSION = 1 as const;

export type WorkspaceCapabilityTrustDecision = 'allowOnce' | 'deny' | 'alwaysTrust';

export interface WorkspaceHookTrustListEntry {
  event: HookEventName;
  command: string;
  resolvedPath: string;
}

export interface WorkspaceCapabilityTrustRequest {
  workspaceRoot: string;
  contentHash: string;
  /** True when a permanent record exists for this root but hash no longer matches. */
  hashChanged: boolean;
  hooks: WorkspaceHookTrustListEntry[];
}

export interface WorkspaceCapabilityTrustRecord {
  workspaceRoot: string;
  contentHash: string;
  decision: 'allow';
  decidedAt: string;
}

export interface WorkspaceCapabilityTrustStoreFile {
  version: typeof WORKSPACE_CAPABILITY_TRUST_VERSION;
  /** Reserved for future non-hooks capabilities; hooks trust uses `hooks`. */
  hooks: WorkspaceCapabilityTrustRecord[];
}

export type RequestWorkspaceCapabilityTrust = (
  request: WorkspaceCapabilityTrustRequest,
) => Promise<WorkspaceCapabilityTrustDecision>;

const sessionAllow = new Map<string, string>();

export function workspaceCapabilityTrustPath(spiritDataDir: string): string {
  return join(spiritDataDir, WORKSPACE_CAPABILITY_TRUST_FILE);
}

export function canonicalizeWorkspaceRoot(workspaceRoot: string): string {
  const trimmed = workspaceRoot.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    return realpathSync.native(trimmed);
  } catch {
    return trimmed;
  }
}

function sessionKey(workspaceRoot: string): string {
  return canonicalizeWorkspaceRoot(workspaceRoot);
}

export function clearWorkspaceCapabilityTrustSessionForTests(): void {
  sessionAllow.clear();
}

export function listWorkspaceHookTrustEntries(
  loaded: LoadedHooksConfig,
): WorkspaceHookTrustListEntry[] {
  if (!loaded.workspaceConfigDir) {
    return [];
  }
  const entries: WorkspaceHookTrustListEntry[] = [];
  for (const event of HOOK_EVENT_NAMES) {
    for (const entry of loaded.workspace.hooks[event] ?? []) {
      let resolvedPath = entry.command;
      try {
        resolvedPath = resolveHookCommandPath({
          ...entry,
          scope: 'workspace',
          configDir: loaded.workspaceConfigDir,
          ...(entry.timeout !== undefined ? { timeout: entry.timeout } : {}),
        });
      } catch {
        // Keep command string when path escapes / cannot resolve.
      }
      entries.push({
        event,
        command: entry.command,
        resolvedPath,
      });
    }
  }
  return entries;
}

export function computeWorkspaceHooksContentHash(loaded: LoadedHooksConfig): string | undefined {
  const entries = listWorkspaceHookTrustEntries(loaded);
  if (entries.length === 0) {
    return undefined;
  }

  const hash = createHash('sha256');
  hash.update(JSON.stringify(loaded.workspace));
  for (const entry of entries) {
    hash.update('\0');
    hash.update(entry.event);
    hash.update('\0');
    hash.update(entry.command);
    hash.update('\0');
    hash.update(entry.resolvedPath);
    hash.update('\0');
    if (existsSync(entry.resolvedPath)) {
      try {
        hash.update(readFileSync(entry.resolvedPath));
      } catch {
        hash.update('<unreadable>');
      }
    } else {
      hash.update('<missing>');
    }
  }
  return hash.digest('hex');
}

export async function loadWorkspaceCapabilityTrustStore(
  spiritDataDir: string,
): Promise<WorkspaceCapabilityTrustStoreFile> {
  const filePath = workspaceCapabilityTrustPath(spiritDataDir);
  if (!existsSync(filePath)) {
    return { version: WORKSPACE_CAPABILITY_TRUST_VERSION, hooks: [] };
  }
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WorkspaceCapabilityTrustStoreFile>;
    const hooks = Array.isArray(parsed.hooks)
      ? parsed.hooks.filter(
          (entry): entry is WorkspaceCapabilityTrustRecord =>
            typeof entry?.workspaceRoot === 'string'
            && typeof entry?.contentHash === 'string'
            && entry.decision === 'allow'
            && typeof entry?.decidedAt === 'string',
        )
      : [];
    return { version: WORKSPACE_CAPABILITY_TRUST_VERSION, hooks };
  } catch {
    return { version: WORKSPACE_CAPABILITY_TRUST_VERSION, hooks: [] };
  }
}

export async function saveWorkspaceCapabilityTrustStore(
  spiritDataDir: string,
  store: WorkspaceCapabilityTrustStoreFile,
): Promise<void> {
  const filePath = workspaceCapabilityTrustPath(spiritDataDir);
  await mkdir(spiritDataDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function findPermanentWorkspaceHooksTrust(
  spiritDataDir: string,
  workspaceRoot: string,
): Promise<WorkspaceCapabilityTrustRecord | undefined> {
  const root = canonicalizeWorkspaceRoot(workspaceRoot);
  const store = await loadWorkspaceCapabilityTrustStore(spiritDataDir);
  return store.hooks.find((entry) => canonicalizeWorkspaceRoot(entry.workspaceRoot) === root);
}

export async function persistPermanentWorkspaceHooksTrust(
  spiritDataDir: string,
  workspaceRoot: string,
  contentHash: string,
): Promise<void> {
  const root = canonicalizeWorkspaceRoot(workspaceRoot);
  const store = await loadWorkspaceCapabilityTrustStore(spiritDataDir);
  const next: WorkspaceCapabilityTrustRecord = {
    workspaceRoot: root,
    contentHash,
    decision: 'allow',
    decidedAt: new Date().toISOString(),
  };
  const hooks = store.hooks.filter(
    (entry) => canonicalizeWorkspaceRoot(entry.workspaceRoot) !== root,
  );
  hooks.push(next);
  await saveWorkspaceCapabilityTrustStore(spiritDataDir, {
    version: WORKSPACE_CAPABILITY_TRUST_VERSION,
    hooks,
  });
}

export function rememberSessionWorkspaceHooksAllow(
  workspaceRoot: string,
  contentHash: string,
): void {
  sessionAllow.set(sessionKey(workspaceRoot), contentHash);
}

export function hasSessionWorkspaceHooksAllow(
  workspaceRoot: string,
  contentHash: string,
): boolean {
  return sessionAllow.get(sessionKey(workspaceRoot)) === contentHash;
}

export function rememberSessionWorkspaceHooksDeny(workspaceRoot: string): void {
  // Deny is session-scoped only in the sense of "this evaluation"; we do not
  // persist deny. Callers skip workspace hooks for the current gate result.
  void workspaceRoot;
}

export type WorkspaceHooksTrustGateResult =
  | { status: 'noWorkspaceHooks' }
  | { status: 'allow'; contentHash: string; hashChanged: boolean }
  | {
      status: 'needsPrompt';
      request: WorkspaceCapabilityTrustRequest;
    };

export async function evaluateWorkspaceHooksTrustGate(options: {
  spiritDataDir: string;
  workspaceRoot: string | undefined;
  loaded: LoadedHooksConfig;
}): Promise<WorkspaceHooksTrustGateResult> {
  const workspaceRoot = options.workspaceRoot?.trim();
  if (!workspaceRoot || !options.loaded.workspaceConfigDir) {
    return { status: 'noWorkspaceHooks' };
  }
  const contentHash = computeWorkspaceHooksContentHash(options.loaded);
  if (!contentHash) {
    return { status: 'noWorkspaceHooks' };
  }

  const hooks = listWorkspaceHookTrustEntries(options.loaded);
  const permanent = await findPermanentWorkspaceHooksTrust(
    options.spiritDataDir,
    workspaceRoot,
  );
  const hashChanged = Boolean(permanent && permanent.contentHash !== contentHash);

  if (permanent && permanent.contentHash === contentHash) {
    return { status: 'allow', contentHash, hashChanged: false };
  }
  if (hasSessionWorkspaceHooksAllow(workspaceRoot, contentHash)) {
    return { status: 'allow', contentHash, hashChanged };
  }

  return {
    status: 'needsPrompt',
    request: {
      workspaceRoot: canonicalizeWorkspaceRoot(workspaceRoot),
      contentHash,
      hashChanged,
      hooks,
    },
  };
}

export async function applyWorkspaceCapabilityTrustDecision(options: {
  spiritDataDir: string;
  workspaceRoot: string;
  contentHash: string;
  decision: WorkspaceCapabilityTrustDecision;
}): Promise<'allow' | 'deny'> {
  if (options.decision === 'deny') {
    return 'deny';
  }
  if (options.decision === 'alwaysTrust') {
    await persistPermanentWorkspaceHooksTrust(
      options.spiritDataDir,
      options.workspaceRoot,
      options.contentHash,
    );
  }
  rememberSessionWorkspaceHooksAllow(options.workspaceRoot, options.contentHash);
  return 'allow';
}

export function filterDefinitionsByWorkspaceTrust(
  definitions: ResolvedHookDefinition[],
  workspaceAllowed: boolean,
): ResolvedHookDefinition[] {
  if (workspaceAllowed) {
    return definitions;
  }
  return definitions.filter((definition) => definition.scope !== 'workspace');
}
