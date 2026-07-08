import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TFunction } from "i18next";

import {
  pickEmptySessionGreetingVariant,
  resolveEmptySessionGreeting,
  type EmptySessionGreetingVariantId,
} from "@/lib/empty-session-greeting";
import { resolveWorkspaceDisplayLabel } from "@/lib/workspace-display-label";
import { resolveConversationListScopeKey } from "@/lib/conversation-list-scope";
import { buildConversationRenderItems } from "@/lib/conversation-process-groups";
import { resolveTurnContinuePresentation } from "@/lib/conversation-continue-ui";
import { useProcessSealAnimationGate } from "@/lib/process-seal-animation";
import { resolveEffectiveEmptySession } from "@/lib/conversation-surface-stale";
import { useElementBoxHeight } from "@/hooks/use-element-box-height";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import type { useSubagentViewer } from "@/hooks/useSubagentViewer";
import type { useCompactionUiDemo } from "@/hooks/useCompactionUiDemo";
import type { useLongConversationListDemo } from "@/hooks/useLongConversationListDemo";
import { isRunSubagentToolCallPending } from "@/lib/subagent-viewer-pending";
import {
  CONVERSATION_COMPOSER_SCROLL_BED_FALLBACK_PX,
  CONVERSATION_SCROLL_BED_EXTRA_PX,
} from "@/lib/conversation-layout-constants";
import { normalizePaneSessionPathKey } from "@/lib/pane-desktop-snapshot";
import {
  resolvePaneCanInterrupt,
  resolvePaneCanSend,
  resolvePaneComposerBusy,
} from "@/lib/pane-conversation-controls";
import type {
  ConversationMessageSnapshot,
  DesktopSnapshot,
  PendingAssistantAux,
} from "@/types";
import {
  countVisiblePaneSessions,
  type ConversationAbortShortcutTargetRef,
} from "@/lib/conversation-abort-shortcut";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;
type SubagentViewer = ReturnType<typeof useSubagentViewer>;
type CompactionDemo = ReturnType<typeof useCompactionUiDemo>;
type LongConversationListDemo = ReturnType<typeof useLongConversationListDemo>;

/** IPC 快照数据均为 JSON 派生（无 function / Date / 循环引用），undefined 字段视作缺省 */
export function jsonLikeEquals(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) {
    return false;
  }
  if (aIsArray) {
    const arrayA = a as readonly unknown[];
    const arrayB = b as readonly unknown[];
    if (arrayA.length !== arrayB.length) {
      return false;
    }
    for (let index = 0; index < arrayA.length; index += 1) {
      if (!jsonLikeEquals(arrayA[index], arrayB[index])) {
        return false;
      }
    }
    return true;
  }
  const recordA = a as Record<string, unknown>;
  const recordB = b as Record<string, unknown>;
  const keysA = Object.keys(recordA).filter((key) => recordA[key] !== undefined);
  const keysB = Object.keys(recordB).filter((key) => recordB[key] !== undefined);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (!jsonLikeEquals(recordA[key], recordB[key])) {
      return false;
    }
  }
  return true;
}

/**
 * 快照经 IPC 到达时所有消息对象都是新引用；按位复用上一次深度相等的消息对象
 * （全部未变时复用整个数组），使下游按引用比较的 memo（MessageCard 等）在流式
 * delta 时只重渲实际变化的行。
 */
export function stabilizeConversationMessages(
  previous: readonly ConversationMessageSnapshot[],
  next: readonly ConversationMessageSnapshot[],
): readonly ConversationMessageSnapshot[] {
  if (previous === next) {
    return next;
  }
  let allReused = previous.length === next.length;
  const merged: ConversationMessageSnapshot[] = new Array(next.length);
  for (let index = 0; index < next.length; index += 1) {
    const prevMessage = previous[index];
    const nextMessage = next[index]!;
    if (prevMessage && jsonLikeEquals(prevMessage, nextMessage)) {
      merged[index] = prevMessage;
    } else {
      merged[index] = nextMessage;
      allReused = false;
    }
  }
  return allReused ? previous : merged;
}

export type UseConversationViewStateOptions = {
  runtime: DesktopRuntime;
  snapshot: DesktopSnapshot | null;
  subagentViewActive: boolean;
  subagentViewer: SubagentViewer;
  compactionDemo: CompactionDemo;
  longConversationListDemo: LongConversationListDemo;
  t: TFunction;
  language: string;
  /** When true, composer interrupt/send state follows this pane snapshot, not global runtime. */
  useIsolatedPane?: boolean;
  conversationAbortShortcutTargetRef?: ConversationAbortShortcutTargetRef;
};

export function useConversationViewState({
  runtime,
  snapshot,
  subagentViewActive,
  subagentViewer,
  compactionDemo,
  longConversationListDemo,
  t,
  language,
  useIsolatedPane = false,
  conversationAbortShortcutTargetRef,
}: UseConversationViewStateOptions) {
  const models = snapshot?.config.models ?? [];
  const composerSessionKey = snapshot?.composerSessionKey ?? "";
  const emptySessionGreetingCacheRef = useRef(new Map<string, EmptySessionGreetingVariantId>());
  const workspaceDisplayLabel = useMemo(
    () =>
      resolveWorkspaceDisplayLabel(
        snapshot?.workspaceRoot ?? "",
        snapshot?.workspaceBinding ?? "project",
        snapshot?.availableWorkspaces ?? [],
      ),
    [
      snapshot?.availableWorkspaces,
      snapshot?.workspaceBinding,
      snapshot?.workspaceRoot,
      language,
    ],
  );
  const includeWorkspaceGreetingVariants = workspaceDisplayLabel !== null;
  const emptySessionGreeting = useMemo(() => {
    const sessionKey = composerSessionKey.trim() || "__no-session__";
    let variantId = emptySessionGreetingCacheRef.current.get(sessionKey);
    if (!variantId) {
      variantId = pickEmptySessionGreetingVariant({
        includeWorkspaceVariants: includeWorkspaceGreetingVariants,
      });
      emptySessionGreetingCacheRef.current.set(sessionKey, variantId);
    }
    return resolveEmptySessionGreeting(t, variantId, workspaceDisplayLabel);
  }, [
    composerSessionKey,
    includeWorkspaceGreetingVariants,
    workspaceDisplayLabel,
    t,
    language,
  ]);

  const sessionMessages = snapshot?.conversation.messages ?? [];
  const rawMessages = subagentViewActive
    ? (snapshot?.subagentViewer?.messages ?? [])
    : longConversationListDemo.active
      ? longConversationListDemo.messages
      : compactionDemo.active
        ? compactionDemo.messages
        : sessionMessages;
  // 每次 poll 快照全量重建对象；结构共享让「未变消息 / 未变数组」保持引用稳定
  const stableMessagesRef = useRef<readonly ConversationMessageSnapshot[]>([]);
  const messages = useMemo(() => {
    const stabilized = stabilizeConversationMessages(stableMessagesRef.current, rawMessages);
    stableMessagesRef.current = stabilized;
    return stabilized;
  }, [rawMessages]);
  const conversationListScopeKey = resolveConversationListScopeKey({
    subagentViewActive,
    subagentToolCallId: subagentViewer.toolCallId,
    compactionDemoActive: compactionDemo.active,
    longConversationListDemoActive: longConversationListDemo.active,
  });
  const conversationRenderItems = useMemo(
    () => buildConversationRenderItems(messages, conversationListScopeKey),
    [conversationListScopeKey, messages],
  );
  const conversationViewKey = `${composerSessionKey.trim() || "__no-session__"}:${conversationListScopeKey}`;
  const processGroupManualOpenKey = useCallback(
    (groupId: string) => `${conversationViewKey}:${groupId}`,
    [conversationViewKey],
  );
  const rawPendingAuxState = subagentViewActive
    ? snapshot?.subagentViewer?.pendingAuxState
    : compactionDemo.active
      ? compactionDemo.pendingAuxState
      : snapshot?.conversation.pendingAuxState;
  const stablePendingAuxRef = useRef<PendingAssistantAux | undefined>(undefined);
  const conversationPendingAuxState = useMemo(() => {
    const previous = stablePendingAuxRef.current;
    const stabilized =
      previous && rawPendingAuxState && jsonLikeEquals(previous, rawPendingAuxState)
        ? previous
        : rawPendingAuxState;
    stablePendingAuxRef.current = stabilized;
    return stabilized;
  }, [rawPendingAuxState]);

  const [conversationListRemountEpoch, setConversationListRemountEpoch] = useState(0);
  const prevSessionMessageCountRef = useRef(sessionMessages.length);

  useEffect(() => {
    const count = sessionMessages.length;
    if (count < prevSessionMessageCountRef.current) {
      setConversationListRemountEpoch((epoch) => epoch + 1);
    }
    prevSessionMessageCountRef.current = count;
  }, [sessionMessages.length]);

  const shouldPlayProcessSealAnimation = useProcessSealAnimationGate({
    conversationViewKey,
    renderItems: conversationRenderItems,
    subagentViewActive,
    compactionDemoActive: compactionDemo.active,
    longConversationListDemoActive: longConversationListDemo.active,
    isBusy: snapshot?.conversation.isBusy,
    busyAction: useIsolatedPane
      ? (snapshot?.conversation.isBusy ? "send" : "")
      : runtime.busyAction,
    pendingAuxState: conversationPendingAuxState,
    sessionMessages,
    planResetKey: conversationListRemountEpoch,
  });

  const [processGroupManualOpen, setProcessGroupManualOpen] = useState<Record<string, boolean>>({});
  const turnContinue = useMemo(
    () =>
      compactionDemo.active || longConversationListDemo.active || subagentViewActive
        ? undefined
        : resolveTurnContinuePresentation(messages),
    [compactionDemo.active, longConversationListDemo.active, messages, subagentViewActive],
  );

  const rewindWarnings = snapshot?.conversation.rewindWarnings ?? [];
  const pendingApproval = snapshot?.conversation.pendingToolApproval;
  const showPendingApprovalInComposer = Boolean(
    pendingApproval
    && (
      !subagentViewActive
      || pendingApproval.subagentSessionId === snapshot?.subagentViewer?.sessionId
    ),
  );

  // hero ↔ 底部 dock 布局切换时 pre-paint 重测；demo 注入消息但 session 仍为空时也算非 hero。
  const composerLayoutHero = resolveEffectiveEmptySession({
    sessionMessageCount: sessionMessages.length,
    subagentViewActive,
    compactionDemoActive: compactionDemo.active,
    longConversationListDemoActive: longConversationListDemo.active,
    newSessionBusy: false,
  });
  const { ref: composerDockRef, heightPx: composerDockHeightPx } =
    useElementBoxHeight<HTMLDivElement>(composerLayoutHero);
  const conversationScrollBedPaddingPx =
    composerDockHeightPx > 0
      ? Math.max(
          CONVERSATION_COMPOSER_SCROLL_BED_FALLBACK_PX,
          composerDockHeightPx + CONVERSATION_SCROLL_BED_EXTRA_PX,
        )
      : CONVERSATION_COMPOSER_SCROLL_BED_FALLBACK_PX;

  const panePendingQuestions = snapshot?.conversation.pendingQuestions ?? null;
  const pendingQuestions = useIsolatedPane
    ? panePendingQuestions
    : runtime.pendingQuestions;
  const showPendingQuestionsInComposer = useIsolatedPane
    ? Boolean(panePendingQuestions)
    : Boolean(pendingQuestions);

  const activeSessionReadOnly = snapshot?.activeSession?.readOnly === true;
  const paneSessionPathKey = normalizePaneSessionPathKey(
    snapshot?.activeSession?.filePath ?? composerSessionKey,
  );
  const paneSendBusy = useIsolatedPane
    && Boolean(paneSessionPathKey)
    && runtime.paneSendBusySessionPath === paneSessionPathKey;
  const conversationInterruptible = useIsolatedPane
    ? resolvePaneCanInterrupt(snapshot)
    : runtime.summary.canInterrupt && !runtime.busyAction;
  const continueBusy = useIsolatedPane
    ? resolvePaneComposerBusy(snapshot, paneSendBusy)
    : Boolean(runtime.busyAction) || snapshot?.conversation.isBusy === true;
  const conversationAbortShortcutEligible =
    conversationInterruptible && !activeSessionReadOnly;
  const conversationAbortShortcutEligibleRef = useRef(false);
  conversationAbortShortcutEligibleRef.current = conversationAbortShortcutEligible;

  useEffect(() => {
    if (!conversationAbortShortcutTargetRef) {
      return;
    }
    if (countVisiblePaneSessions(snapshot) > 1) {
      return;
    }
    conversationAbortShortcutTargetRef.current = {
      eligible: conversationAbortShortcutEligible,
    };
  }, [
    conversationAbortShortcutEligible,
    conversationAbortShortcutTargetRef,
    snapshot,
  ]);

  const startImplementingDisabled =
    !snapshot?.runtimeReady ||
    activeSessionReadOnly ||
    runtime.busyAction === "session" ||
    Boolean(pendingApproval) ||
    Boolean(pendingQuestions) ||
    (useIsolatedPane
      ? snapshot?.conversation.isBusy === true && !conversationInterruptible
      : runtime.busyAction === "send" && !conversationInterruptible);

  const previousComposerSessionKeyRef = useRef(composerSessionKey);

  useEffect(() => {
    if (previousComposerSessionKeyRef.current !== composerSessionKey) {
      previousComposerSessionKeyRef.current = composerSessionKey;
      if (subagentViewer.active) {
        void subagentViewer.close();
      }
    }
  }, [composerSessionKey, subagentViewer]);

  useEffect(() => {
    if (subagentViewer.active && !snapshot?.subagentViewer) {
      const toolCallId = subagentViewer.toolCallId;
      const stillStarting = toolCallId
        ? isRunSubagentToolCallPending(snapshot?.conversation.messages ?? [], toolCallId)
        : false;
      if (stillStarting) {
        return;
      }
      void subagentViewer.close();
    }
  }, [snapshot?.conversation.messages, snapshot?.subagentViewer, subagentViewer]);

  const handleOpenSubagentViewer = useCallback(
    (toolCallId: string) => {
      compactionDemo.stop();
      longConversationListDemo.stop();
      void subagentViewer.open(toolCallId);
    },
    [compactionDemo, longConversationListDemo, subagentViewer],
  );

  return {
    models,
    composerSessionKey,
    sessionMessages,
    messages,
    conversationListScopeKey,
    conversationRenderItems,
    conversationViewKey,
    processGroupManualOpenKey,
    conversationPendingAuxState,
    conversationListRemountEpoch,
    shouldPlayProcessSealAnimation,
    processGroupManualOpen,
    setProcessGroupManualOpen,
    turnContinue,
    rewindWarnings,
    pendingApproval,
    showPendingApprovalInComposer,
    composerDockRef,
    conversationScrollBedPaddingPx,
    pendingQuestions,
    showPendingQuestionsInComposer,
    activeSessionReadOnly,
    conversationInterruptible,
    continueBusy,
    conversationAbortShortcutEligibleRef,
    startImplementingDisabled,
    emptySessionGreeting,
    handleOpenSubagentViewer,
  };
}
