import {
  runSessionEndHook,
  runSessionStartHookAndApply,
  type HookRunner,
  type HookSessionContext,
  type SessionEndHookInput,
  type SessionStartHookInput,
} from '@spiritagent/agent-core';
import {
  createHookRunner,
  type RequestWorkspaceCapabilityTrust,
} from '@spiritagent/host-internal';

import type { SessionBundle } from './session-bundle.js';
import type { DesktopRuntime } from './runtime.js';
import { spiritAgentDataDir } from './storage.js';

export function createDesktopHookRunner(
  workspaceRoot: string,
  options?: {
    requestWorkspaceCapabilityTrust?: RequestWorkspaceCapabilityTrust;
  },
): HookRunner {
  return createHookRunner({
    spiritDataDir: spiritAgentDataDir(),
    workspaceRoot,
    ...(options?.requestWorkspaceCapabilityTrust
      ? { requestWorkspaceCapabilityTrust: options.requestWorkspaceCapabilityTrust }
      : {}),
  });
}

export function buildDesktopHookSessionContext(
  bundle: SessionBundle,
  model: string | undefined,
): HookSessionContext {
  return {
    sessionId: bundle.id,
    conversationPath: bundle.activeSession?.filePath ?? null,
    workspaceRoot: bundle.workspaceRoot,
    model,
  };
}

export async function runDesktopSessionStartHook(
  runtime: DesktopRuntime | undefined,
  hookRunner: HookRunner | undefined,
  context: HookSessionContext,
  source: SessionStartHookInput['source'],
): Promise<void> {
  await runSessionStartHookAndApply(
    hookRunner,
    runtime ? (role, content) => runtime.recordContextMessage(role, content) : undefined,
    context,
    source,
  );
}

export async function runDesktopSessionEndHook(
  hookRunner: HookRunner | undefined,
  context: HookSessionContext,
  reason: SessionEndHookInput['reason'],
): Promise<void> {
  await runSessionEndHook(hookRunner, context, reason);
}
