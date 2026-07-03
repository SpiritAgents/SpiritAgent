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
import type { DesktopSnapshot } from "@/types";
import {
  countVisiblePaneSessions,
  type ConversationAbortShortcutTargetRef,
} from "@/lib/conversation-abort-shortcut";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;
type SubagentViewer = ReturnType<typeof useSubagentViewer>;
type CompactionDemo = ReturnType<typeof useCompactionUiDemo>;
type LongConversationListDemo = ReturnType<typeof useLongConversationListDemo>;

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
  const messages = subagentViewActive
    ? (snapshot?.subagentViewer?.messages ?? [])
    : longConversationListDemo.active
      ? longConversationListDemo.messages
      : compactionDemo.active
        ? compactionDemo.messages
        : sessionMessages;
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
  const processGroupManualOpenKey = (groupId: string) => `${conversationViewKey}:${groupId}`;
  const conversationPendingAuxState = subagentViewActive
    ? snapshot?.subagentViewer?.pendingAuxState
    : compactionDemo.active
      ? compactionDemo.pendingAuxState
      : snapshot?.conversation.pendingAuxState;

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

  // 空会话（居中 hero composer）与有内容会话（底部 dock）布局切换时 pre-paint 重测，
  // 避免换页首帧滚动床 padding 沿用旧布局高度。
  const { ref: composerDockRef, heightPx: composerDockHeightPx } =
    useElementBoxHeight<HTMLDivElement>(sessionMessages.length === 0);
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
