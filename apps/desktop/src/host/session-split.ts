import path from 'node:path';

import type {
  BeginSplitPaneSessionRequest,
  CloseSplitPaneSessionRequest,
  DesktopSnapshot,
  SetVisiblePaneSessionsRequest,
} from '../types.js';
import type { SessionActivationContext } from './session-activation.js';
import { isProvisionalSessionPath, isSplitProvisionalSessionPath, splitPaneSessionPath } from './storage.js';
import type { SessionBundle } from './session-bundle.js';

export interface SessionSplitHostContext extends SessionActivationContext {
  visiblePaneSessionPaths(): readonly string[];
  setVisiblePaneSessionPaths(paths: readonly string[]): void;
  resolveTodoSessionKeyForBundle(bundle: SessionBundle): string;
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
    const normalized = [...new Set(request.sessionPaths.map((entry) => path.resolve(entry)))];
    ctx.setVisiblePaneSessionPaths(normalized);
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
      ctx.setVisiblePaneSessionPaths(
        ctx.visiblePaneSessionPaths().filter((entry) => path.resolve(entry) !== sessionPath),
      );
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

    ctx.setVisiblePaneSessionPaths(
      ctx.visiblePaneSessionPaths().filter((entry) => path.resolve(entry) !== sessionPath),
    );
    return ctx.buildSnapshot();
  });
}
