import path from 'node:path';

import type {
  BeginSplitPaneSessionRequest,
  CloseSplitPaneSessionRequest,
  DesktopSnapshot,
  FocusPaneSessionRequest,
  SyncSplitPaneSessionsRequest,
  SetVisiblePaneSessionsRequest,
} from '../types.js';
import {
  ensureStoredSessionBundleRegistered,
  finishSessionActivationCommand,
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
): Promise<{ sessionPath: string; snapshot?: DesktopSnapshot }> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const paneId = request.paneId.trim();
    if (!paneId) {
      throw new Error('Split pane id is required.');
    }

    const state = ctx.requireState();
    const sessionPath = path.resolve(splitPaneSessionPath(paneId));
    const registry = ctx.sessionRegistry();

    if (request.deferSnapshot) {
      registry.beginSplitPaneSession(state.workspaceRoot, paneId);
      await ctx.finalizeTodoScopeForNewActiveBundle(
        registry.findBySessionPath(sessionPath)!,
        state.workspaceRoot,
      );
      return { sessionPath };
    }

    const visible = new Set(ctx.visiblePaneSessionPaths());
    visible.add(sessionPath);
    ctx.setVisiblePaneSessionPaths([...visible]);

    registry.beginSplitPaneSession(state.workspaceRoot, paneId);
    await ctx.finalizeTodoScopeForNewActiveBundle(
      ctx.sessionRegistry().findBySessionPath(sessionPath)!,
      state.workspaceRoot,
    );

    return {
      sessionPath,
      snapshot: ctx.buildSnapshot(),
    };
  });
}

async function registerVisiblePaneSessions(
  ctx: SessionSplitHostContext,
  normalized: readonly string[],
): Promise<void> {
  const state = ctx.requireState();
  const registry = ctx.sessionRegistry();

  ctx.setVisiblePaneSessionPaths(normalized);

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
  }

  for (const sessionPath of normalized) {
    try {
      await ensureStoredSessionBundleRegistered(ctx, sessionPath);
    } catch {
      // Persisted layout may reference a deleted session file.
    }
  }

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
  }
}

export async function setVisiblePaneSessionsCommand(
  ctx: SessionSplitHostContext,
  request: SetVisiblePaneSessionsRequest,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const normalized = [...new Set(request.sessionPaths.map((entry) => path.resolve(entry)))];
    const registry = ctx.sessionRegistry();
    const activeBefore = registry.getActive();
    const activeIdBefore = registry.activeSessionId();

    await registerVisiblePaneSessions(ctx, normalized);

    if (
      activeBefore
      && activeIdBefore
      && registry.activeSessionId() !== activeIdBefore
    ) {
      registry.activateExisting(activeBefore);
    }

    await ensureActiveFromVisiblePanePaths(ctx, normalized);
    return ctx.buildSnapshot();
  });
}

/** Register visible pane bundles, optionally focus one path, return a single snapshot. */
export async function syncSplitPaneSessionsCommand(
  ctx: SessionSplitHostContext,
  request: SyncSplitPaneSessionsRequest,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const normalized = [...new Set(request.sessionPaths.map((entry) => path.resolve(entry)))];
    const registry = ctx.sessionRegistry();

    await registerVisiblePaneSessions(ctx, normalized);

    const focusSessionPath = request.focusSessionPath?.trim();
    if (focusSessionPath) {
      const resolved = path.resolve(focusSessionPath);
      const bundle = registry.findBySessionPath(resolved);
      if (!bundle) {
        throw new Error('Session not found.');
      }
      ctx.clearSubagentViewerTarget();
      if (registry.getActive() !== bundle) {
        registry.activateExisting(bundle);
        await finishSessionActivationCommand(ctx, bundle);
      }
    } else {
      await ensureActiveFromVisiblePanePaths(ctx, normalized);
    }

    return ctx.buildSnapshot();
  });
}

/** Switch foreground bundle within an existing split group without full session navigation. */
export async function focusPaneSessionCommand(
  ctx: SessionSplitHostContext,
  request: FocusPaneSessionRequest,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const sessionPath = path.resolve(request.sessionPath.trim());
    if (!sessionPath) {
      throw new Error('Split pane session path is required.');
    }
    const registry = ctx.sessionRegistry();
    const bundle = registry.findBySessionPath(sessionPath);
    if (!bundle) {
      throw new Error('Session not found.');
    }
    ctx.clearSubagentViewerTarget();
    if (registry.getActive() !== bundle) {
      registry.activateExisting(bundle);
      await finishSessionActivationCommand(ctx, bundle);
    }
    return ctx.buildSnapshot();
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
