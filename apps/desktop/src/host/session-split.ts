import path from 'node:path';

import type {
  BeginSplitPaneSessionRequest,
  CloseSplitPaneSessionRequest,
  DesktopSnapshot,
  SetVisiblePaneSessionsRequest,
} from '../types.js';
import {
  ensureStoredSessionBundleRegistered,
  type SessionActivationContext,
} from './session-activation.js';
import { isProvisionalSessionPath, isSplitProvisionalSessionPath, parseSplitPaneIdFromSessionPath, splitPaneSessionPath } from './storage.js';
import type { SessionBundle } from './session-bundle.js';

export interface SessionSplitHostContext extends SessionActivationContext {
  visiblePaneSessionPaths(): readonly string[];
  setVisiblePaneSessionPaths(paths: readonly string[]): void;
  resolveTodoSessionKeyForBundle(bundle: SessionBundle): string;
}

/** Closing an empty split pane may remove the foreground bundle; repoint before buildSnapshot. */
async function ensureActiveFromVisiblePanePaths(
  ctx: SessionSplitHostContext,
  visiblePaths: readonly string[],
): Promise<void> {
  const registry = ctx.sessionRegistry();
  if (registry.hasActive()) {
    return;
  }

  for (const sessionPath of visiblePaths) {
    let bundle = registry.findBySessionPath(sessionPath);
    if (!bundle && !isSplitProvisionalSessionPath(sessionPath)) {
      try {
        const registered = await ensureStoredSessionBundleRegistered(ctx, sessionPath);
        if (registered) {
          bundle = registered;
        }
      } catch {
        // Persisted layout may reference a deleted session file.
      }
    }
    if (bundle) {
      registry.activateExisting(bundle);
      ctx.syncActiveRuntimePointer();
      return;
    }
  }

  registry.ensureDraft(ctx.requireState().workspaceRoot);
  ctx.syncActiveRuntimePointer();
}

export async function beginSplitPaneSessionCommand(
  ctx: SessionSplitHostContext,
  request: BeginSplitPaneSessionRequest,
): Promise<{ sessionPath: string; snapshot: DesktopSnapshot }> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const paneId = request.paneId.trim();
    if (!paneId) {
      throw new Error('Split pane id is required.');
    }

    const state = ctx.requireState();
    const sessionPath = path.resolve(splitPaneSessionPath(paneId));
    ctx.sessionRegistry().beginSplitPaneSession(state.workspaceRoot, paneId);
    await ctx.finalizeTodoScopeForNewActiveBundle(
      ctx.sessionRegistry().findBySessionPath(sessionPath)!,
      state.workspaceRoot,
    );

    const visible = new Set(ctx.visiblePaneSessionPaths());
    visible.add(sessionPath);
    ctx.setVisiblePaneSessionPaths([...visible]);

    return {
      sessionPath,
      snapshot: ctx.buildSnapshot(),
    };
  });
}

export async function setVisiblePaneSessionsCommand(
  ctx: SessionSplitHostContext,
  request: SetVisiblePaneSessionsRequest,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const state = ctx.requireState();
    const normalized = [...new Set(request.sessionPaths.map((entry) => path.resolve(entry)))];
    const registry = ctx.sessionRegistry();
    const activeBefore = registry.getActive();
    const activeIdBefore = registry.activeSessionId();
    const registeredPaths: string[] = [];

    for (const sessionPath of normalized) {
      if (!isSplitProvisionalSessionPath(sessionPath)) {
        continue;
      }
      if (registry.findBySessionPath(sessionPath)) {
        continue;
      }
      const paneId = parseSplitPaneIdFromSessionPath(sessionPath);
      if (!paneId) {
        continue;
      }
      registry.beginSplitPaneSession(state.workspaceRoot, paneId);
      registeredPaths.push(sessionPath);
    }

    for (const sessionPath of normalized) {
      try {
        const bundle = await ensureStoredSessionBundleRegistered(ctx, sessionPath);
        if (bundle) {
          registeredPaths.push(path.resolve(bundle.activeSession?.filePath ?? bundle.id));
        }
      } catch {
        // Persisted layout may reference a deleted session file.
      }
    }

    if (
      activeBefore
      && activeIdBefore
      && registry.activeSessionId() !== activeIdBefore
    ) {
      registry.activateExisting(activeBefore);
    }

    ctx.setVisiblePaneSessionPaths(normalized);
    await ensureActiveFromVisiblePanePaths(ctx, normalized);
    const snapshot = ctx.buildSnapshot();
    return snapshot;
  });
}

export async function closeSplitPaneSessionCommand(
  ctx: SessionSplitHostContext,
  request: CloseSplitPaneSessionRequest,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const sessionPath = path.resolve(request.sessionPath);
    const bundle = ctx.sessionRegistry().findBySessionPath(sessionPath);
    if (!bundle) {
      const nextVisible = ctx.visiblePaneSessionPaths().filter(
        (entry) => path.resolve(entry) !== sessionPath,
      );
      ctx.setVisiblePaneSessionPaths(nextVisible);
      await ensureActiveFromVisiblePanePaths(ctx, nextVisible);
      return ctx.buildSnapshot();
    }

    const messageCount = bundle.messageTimeline.toMessages().length;
    const isEmptySplitProvisional =
      messageCount === 0
      && bundle.activeSession
      && isSplitProvisionalSessionPath(bundle.activeSession.filePath);

    if (isEmptySplitProvisional || (messageCount === 0 && isProvisionalSessionPath(sessionPath))) {
      ctx.sessionRegistry().removeBySessionPath(sessionPath);
    }

    const nextVisible = ctx.visiblePaneSessionPaths().filter(
      (entry) => path.resolve(entry) !== sessionPath,
    );
    ctx.setVisiblePaneSessionPaths(nextVisible);
    await ensureActiveFromVisiblePanePaths(ctx, nextVisible);
    return ctx.buildSnapshot();
  });
}
