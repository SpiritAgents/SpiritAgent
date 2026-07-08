import { readFile } from 'node:fs/promises';
import path from 'node:path';

import i18n from '../lib/i18n-host.js';
import type { DesktopSnapshot } from '../types.js';
import { deleteSessionRewindData } from './rewind.js';
import {
  ensureStoredSessionBundleRegistered,
  finishSessionActivationCommand,
  type SessionActivationContext,
} from './session-activation.js';
import type { SessionBundle } from './session-bundle.js';
import { sameSessionPath } from './session-path.js';
import type { SessionSplitHostContext } from './session-split.js';
import { isEphemeralDebugSessionPath } from './sessions.js';
import {
  deleteStoredSession,
  isSplitProvisionalSessionPath,
  spiritAgentDataDir,
} from './storage.js';

export interface SessionDeleteContext
  extends SessionActivationContext,
    Pick<SessionSplitHostContext, 'visiblePaneSessionPaths' | 'setVisiblePaneSessionPaths'> {
  removeEphemeralSession(filePath: string): void;
  bundleRuntimeIsBusy(sessionPath: string): boolean;
  clearSessionTitleGeneration(sessionPath: string): void;
}

/** 会话文件删除前读取 rewind sessionId，用于联动清理 rewind sidecar 目录。 */
async function readRewindSessionIdFromDisk(filePath: string): Promise<string | undefined> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { rewind?: { sessionId?: unknown } };
    const sessionId = parsed.rewind?.sessionId;
    return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : undefined;
  } catch {
    return undefined;
  }
}

export async function deleteSessionCommand(
  ctx: SessionDeleteContext,
  filePath: string,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });

    const trimmed = filePath.trim();
    if (!trimmed) {
      throw new Error(i18n.t('error.invalidSessionPath'));
    }

    const resolvedPath = path.resolve(trimmed);
    if (ctx.bundleRuntimeIsBusy(resolvedPath)) {
      throw new Error(i18n.t('error.cannotDeleteBusySession'));
    }

    const state = ctx.requireState();
    const registry = ctx.sessionRegistry();
    const activeId = registry.activeSessionId();
    const wasActive = activeId !== undefined && sameSessionPath(activeId, resolvedPath);
    const closingBundle = wasActive ? registry.getActive() : undefined;

    if (closingBundle) {
      await ctx.runSessionEndForBundle?.(closingBundle, 'close');
    }

    const visiblePaths = ctx.visiblePaneSessionPaths();
    const deletedFromMultiPane =
      visiblePaths.length > 1
      && visiblePaths.some((entry) => sameSessionPath(entry, resolvedPath));
    const nextVisible = deletedFromMultiPane
      ? visiblePaths.filter((entry) => !sameSessionPath(entry, resolvedPath))
      : visiblePaths;
    const needsSuccessor = wasActive || !registry.hasActive();

    // 预加载继任者：在旧 bundle 移除前完成磁盘加载，
    // 使后面「移除旧 bundle → 确立新 active」可同步原子完成，
    // 避免 activeId 悬空跨 await（节流快照定时器在 await 间隙触发会 requireActive 崩溃）。
    let successor: SessionBundle | undefined;
    if (needsSuccessor && deletedFromMultiPane) {
      for (const sessionPath of nextVisible) {
        let candidate = registry.findBySessionPath(sessionPath);
        if (!candidate && !isSplitProvisionalSessionPath(sessionPath)) {
          try {
            candidate = (await ensureStoredSessionBundleRegistered(ctx, sessionPath)) ?? undefined;
          } catch {
            // 持久化布局可能引用已删除的会话文件
          }
        }
        if (candidate) {
          successor = candidate;
          break;
        }
      }
    }

    // —— 原子段开始：移除旧 bundle 并同步确立新 active，期间不得有 await ——
    const removedBundle = registry.removeBySessionPath(resolvedPath);
    if (deletedFromMultiPane) {
      ctx.setVisiblePaneSessionPaths(nextVisible);
    }
    let newActive: SessionBundle | undefined;
    let newActiveIsFreshDraft = false;
    if (needsSuccessor) {
      ctx.clearSubagentViewerTarget();
      if (deletedFromMultiPane && successor) {
        newActive = registry.activateExisting(successor);
      } else if (deletedFromMultiPane) {
        newActive = registry.ensureDraft(state.workspaceRoot);
      } else {
        newActive = registry.beginNewActive(state.workspaceRoot);
        newActiveIsFreshDraft = true;
      }
      ctx.syncActiveRuntimePointer();
    }
    // —— 原子段结束：activeId 已恢复有效，可安全跨 await ——

    if (newActive) {
      if (newActiveIsFreshDraft) {
        await ctx.finalizeTodoScopeForNewActiveBundle(newActive, state.workspaceRoot);
        ctx.resetStreamingPlacementState(true, newActive);
      }
      await finishSessionActivationCommand(ctx, newActive);
    }

    let rewindSessionId = removedBundle?.rewind.sessionId;
    if (isEphemeralDebugSessionPath(resolvedPath)) {
      ctx.removeEphemeralSession(resolvedPath);
    } else {
      if (!rewindSessionId) {
        rewindSessionId = await readRewindSessionIdFromDisk(resolvedPath);
      }
      await deleteStoredSession(resolvedPath);
    }
    if (rewindSessionId) {
      await deleteSessionRewindData(spiritAgentDataDir(), rewindSessionId);
    }
    ctx.clearSessionTitleGeneration(resolvedPath);

    ctx.setLastRuntimeError('');
    return ctx.buildSnapshot();
  });
}
