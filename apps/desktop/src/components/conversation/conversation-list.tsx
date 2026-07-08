import { useTranslation } from "react-i18next";

import { ProcessCardCollapsible } from "@/components/process-card-collapsible";
import { ToolCallDiffHostProvider } from "@/components/tool-call-diff-host-context";
import { ToolCallCollapsible } from "@/components/tool-call/tool-call-collapsible";
import type { ComposerLocalFileAttachmentView } from "@/components/composer-local-file-strip";
import type { ComposerRichInputHandle } from "@/components/composer-rich-input";
import { MessageCard } from "@/components/conversation/message-card";
import { MessageTurnActions } from "@/components/conversation/message-turn-actions";
import type { DesktopAgentMode } from "@/lib/agent-mode";
import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import { segmentsToAttachments, segmentsToPlainText } from "@/lib/composer-segment-model";
import { conversationMessageStableId } from "@/lib/conversation-list-scope";
import {
  shouldShowContinueToolbarOnProcessGroup,
  type TurnContinuePresentation,
} from "@/lib/conversation-continue-ui";
import {
  isMessageHiddenByProcessGroup,
  type ConversationRenderItem,
} from "@/lib/conversation-process-groups";
import {
  isAssistantReasoningLive,
  shouldCollapseThinkingDuringToolPreview,
  shouldShowAssistantThinkingCollapsible,
} from "@/lib/conversation-thinking-ui";
import {
  assistantTurnStartIndexForRenderItem,
  isMessageInActiveStreamingTurn,
  messageShowsAssistantTurnActions,
  resolveTurnActionsToolbarHostIndex,
  shouldClearAssistantTurnHover,
} from "@/lib/message-turn-actions-ui";
import {
  canCopyAssistantTurn,
  formatAssistantTurnCopyText,
} from "@/lib/message-turn-copy";
import { cn } from "@/lib/utils";
import type { EditorFileTarget } from "@/lib/workspace-editor-navigation";
import type {
  ConversationMessageSnapshot,
  DesktopSnapshot,
  MessageRewindDraftState,
  PendingAssistantAux,
} from "@/types";
import type { PointerEvent, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  CONVERSATION_GUTTER_X,
  CONVERSATION_MESSAGE_LIST_MAX_W,
} from "@/lib/conversation-layout-constants";
import {
  conversationRenderItemGapBeforePxAt,
  estimateConversationRenderItemHeight,
} from "@/lib/conversation-virtual-row-size";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;

// memo 行的 props 必须引用稳定；空数组用模块级常量而非行内字面量
const EMPTY_MODELS: DesktopSnapshot["config"]["models"] = [];
const EMPTY_REWIND_LOCAL_FILE_ATTACHMENTS: readonly ComposerLocalFileAttachmentView[] = [];
const EMPTY_REWIND_BROWSER_ELEMENT_ATTACHMENTS: readonly BrowserElementAttachment[] = [];

export type ConversationListProps = {
  messages: readonly ConversationMessageSnapshot[];
  conversationRenderItems: readonly ConversationRenderItem[];
  /** 虚拟化滚动容器（Radix ScrollArea viewport）；由 ConversationView 提供。 */
  getScrollElement: () => HTMLElement | null;
  /** 跟底时同步钉底（stream tail 持有 stick 语义）；每次 totalSize 变化的 commit 中调用 */
  pinScrollToTail: () => void;
  subagentViewActive: boolean;
  composerSessionKey: string;
  conversationListScopeKey: string;
  conversationListRemountEpoch: number;
  conversationPendingAuxState: PendingAssistantAux | undefined;
  processGroupManualOpen: Record<string, boolean>;
  processGroupManualOpenKey: (groupId: string) => string;
  onProcessGroupManualOpenChange: (groupId: string, open: boolean) => void;
  shouldPlayProcessSealAnimation: (groupId: string) => boolean;
  workspaceRoot: string;
  runtime: DesktopRuntime;
  turnContinue: TurnContinuePresentation | undefined;
  activeSessionReadOnly: boolean;
  conversationIsBusy: boolean;
  continueBusy: boolean;
  rewindDraft: MessageRewindDraftState | null;
  onRewindDraftChange: (
    updater: (current: MessageRewindDraftState | null) => MessageRewindDraftState | null,
  ) => void;
  messageRewindComposerEnabled: boolean;
  rewindRichInputRef: RefObject<ComposerRichInputHandle | null>;
  models: DesktopSnapshot["config"]["models"];
  catalogHints: DesktopSnapshot["config"]["modelCatalogHints"] | undefined;
  activeModel: string;
  agentMode: DesktopAgentMode;
  onOpenSubagentViewer: ((toolCallId: string) => void) | undefined;
  onOpenReadFile: ((target: EditorFileTarget) => void) | undefined;
  onOpenPlan: (() => void) | undefined;
  onStartMessageRewind: (message: ConversationMessageSnapshot, listIndex: number) => void;
  onSubmitMessageRewind: () => void;
  onRewindRemoveLocalFileAttachment: (path: string) => void;
  onRewindPickLocalFile: () => void;
  onRewindPaste: (event: import("react").ClipboardEvent<HTMLTextAreaElement>) => void;
  onRewindDragOver: (event: import("react").DragEvent<HTMLElement>) => void;
  onRewindDrop: (event: import("react").DragEvent<HTMLElement>) => void;
  onComposerAgentModeChange: (mode: DesktopAgentMode) => void;
  onForkMessage: (message: ConversationMessageSnapshot, listIndex: number) => void;
};

export function ConversationList({
  messages,
  conversationRenderItems,
  getScrollElement,
  pinScrollToTail,
  subagentViewActive,
  composerSessionKey,
  conversationListScopeKey,
  conversationListRemountEpoch,
  conversationPendingAuxState,
  processGroupManualOpen,
  processGroupManualOpenKey,
  onProcessGroupManualOpenChange,
  shouldPlayProcessSealAnimation,
  workspaceRoot,
  runtime,
  turnContinue,
  activeSessionReadOnly,
  conversationIsBusy,
  continueBusy,
  rewindDraft,
  onRewindDraftChange,
  messageRewindComposerEnabled,
  rewindRichInputRef,
  models,
  catalogHints,
  activeModel,
  agentMode,
  onOpenSubagentViewer,
  onOpenReadFile,
  onOpenPlan,
  onStartMessageRewind,
  onSubmitMessageRewind,
  onRewindRemoveLocalFileAttachment,
  onRewindPickLocalFile,
  onRewindPaste,
  onRewindDragOver,
  onRewindDrop,
  onComposerAgentModeChange,
  onForkMessage,
}: ConversationListProps) {
  const { t } = useTranslation();
  const [hoveredAssistantTurnStart, setHoveredAssistantTurnStart] = useState<number | null>(
    null,
  );
  const turnActionsToolbarHostIndex = useMemo(
    () => resolveTurnActionsToolbarHostIndex(messages),
    [messages],
  );

  const handleAssistantTurnPointerEnter = useCallback((turnStart: number) => {
    setHoveredAssistantTurnStart(turnStart);
  }, []);

  const handleAssistantTurnPointerLeave = useCallback(
    (event: PointerEvent, turnStart: number) => {
      if (!shouldClearAssistantTurnHover(event, turnStart)) {
        return;
      }
      setHoveredAssistantTurnStart((current) =>
        current === turnStart ? null : current,
      );
    },
    [],
  );

  useEffect(() => {
    if (!conversationIsBusy) {
      return;
    }
    setHoveredAssistantTurnStart(null);
  }, [conversationIsBusy]);

  // 流式 delta 时 MessageCard 靠 memo 短路，传入的回调必须为稳定引用；
  // runtime 对象每渲染都是新引用，须解构出 useCallback 化的方法再作依赖。
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const {
    continueAssistantCompletion,
    abortShell,
    reorderQueuedUserTurn,
    sendQueuedUserTurnNow,
    removeQueuedUserTurn,
  } = runtime;

  const handleContinueMessage = useCallback(
    (targetMessage: ConversationMessageSnapshot) => {
      void continueAssistantCompletion(targetMessage.id);
    },
    [continueAssistantCompletion],
  );
  const handleAbortShell = useCallback(
    (toolCallId: string) => {
      void abortShell(toolCallId);
    },
    [abortShell],
  );
  const handleQueueMoveUp = useCallback(
    (queueId: string) => {
      void reorderQueuedUserTurn(queueId);
    },
    [reorderQueuedUserTurn],
  );
  const handleQueueSendNow = useCallback(
    (queueId: string) => {
      void sendQueuedUserTurnNow(queueId);
    },
    [sendQueuedUserTurnNow],
  );
  const handleQueueDelete = useCallback(
    (queueId: string) => {
      void removeQueuedUserTurn(queueId);
    },
    [removeQueuedUserTurn],
  );
  const handleRewindSegmentsChange = useCallback(
    (segments: import("@/lib/composer-segment-model").RichSegment[]) => {
      onRewindDraftChange((current) =>
        current
          ? {
              ...current,
              segments,
              text: segmentsToPlainText(segments),
              browserElementAttachments: segmentsToAttachments(segments),
            }
          : current,
      );
    },
    [onRewindDraftChange],
  );
  const handleRewindElementAttachmentsChange = useCallback(
    (listIndex: number, attachments: BrowserElementAttachment[]) => {
      onRewindDraftChange((current) =>
        current && current.listIndex === listIndex
          ? { ...current, browserElementAttachments: attachments }
          : current,
      );
    },
    [onRewindDraftChange],
  );
  const handleCopyTurn = useCallback((listIndex: number) => {
    const text = formatAssistantTurnCopyText(messagesRef.current, listIndex);
    if (!text.trim()) {
      return;
    }
    void navigator.clipboard.writeText(text);
  }, []);

  // queued 前缀计数一次算好，避免 renderRow 每行 O(index) 的 slice/filter
  const queuedBeforeCounts = useMemo(() => {
    const counts = new Array<number>(messages.length);
    let queued = 0;
    for (let index = 0; index < messages.length; index += 1) {
      counts[index] = queued;
      if (messages[index]!.queued === true) {
        queued += 1;
      }
    }
    return counts;
  }, [messages]);

  const toolCallDiffHostValue = useMemo(
    () => ({
      workspaceRoot,
      readWorkspaceTextFile: runtime.readWorkspaceTextFile,
    }),
    [workspaceRoot, runtime.readWorkspaceTextFile],
  );

  const sizingRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // viewport 是父组件 ScrollArea 的 DOM，冷启动首帧 getScrollElement() 为 null，
  // 须转成 state 才能让 virtualizer 重新执行 _willUpdate 绑定 scroll 监听。
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  // 必须用 useLayoutEffect：useEffect 在 paint 后才绑定 scrollElement，导航切入会先
  // 上屏一帧空列表（virtualItems 为空），可感知为空白闪烁。layout effect 中的 setState
  // 在 paint 前同步 flush，virtual-core 注册 observeElementRect 时同步量取 rect，首帧即有行。
  // 整页 reload（如 HMR）后快照首个 commit 即就绪，本组件与祖先 ScrollArea 同一次
  // commit 挂载；子 layout effect 先于祖先 viewport ref 附加执行，此处会拿到 null。
  // 一次性绑定会让 virtualizer 永无滚动元素（列表空白），故轮询至 viewport 可用。
  useLayoutEffect(() => {
    const el = getScrollElement();
    if (el) {
      setScrollElement(el);
      return;
    }
    let rafId = 0;
    const waitForViewport = () => {
      const next = getScrollElement();
      if (!next) {
        rafId = requestAnimationFrame(waitForViewport);
        return;
      }
      setScrollElement(next);
    };
    rafId = requestAnimationFrame(waitForViewport);
    return () => cancelAnimationFrame(rafId);
  }, [getScrollElement]);

  const getItemKey = useCallback(
    (index: number) => {
      const item = conversationRenderItems[index];
      if (!item) {
        return index;
      }
      if (item.kind === "process-group") {
        return item.groupId;
      }
      const message = messages[item.messageIndex];
      if (!message) {
        return index;
      }
      return `${conversationMessageStableId(message, composerSessionKey, conversationListScopeKey)}@${item.messageIndex}`;
    },
    [conversationRenderItems, messages, composerSessionKey, conversationListScopeKey],
  );

  const estimateSize = useCallback(
    (index: number) =>
      estimateConversationRenderItemHeight(index, conversationRenderItems, messages),
    [conversationRenderItems, messages],
  );

  // 不覆盖 shouldAdjustScrollPositionOnItemSizeChange、不用 anchorTo:'end'：
  // virtual-core 3.17.x 默认策略已内建「首测补偿 / backward 重测跳过」，上次实验中
  // 覆盖它（isScrolling 一律 false）正是上滑下跳的根因；anchorTo:'end' 的 wasAtEnd
  // 路径会绕过 shouldAdjust 直接改写 scrollTop（日志见 stash 实验），一并弃用。
  //
  // directDomUpdates：容器高度与行位移在 onChange（RO 回调内）同步直写 DOM。
  // 行内折叠卡动画逐帧改行高时，React 异步重渲染会让 totalSize/translateY 晚一帧，
  // 期间钉底是空操作（scrollHeight 未变），组行底边先下冲再回弹（实测 10px 起跳 +
  // 每帧 ±1px），即「居底展开过程卡片内卡片、下方卡片上下震」。直写让行高变化、
  // 容器长高与 onChange 里的钉底同帧完成。
  //
  // onChange 的钉底必须以 totalSize 变化为门槛：onChange 对纯滚动也会触发，
  // 而用户向下滚进 48px 阈值时 stick 恰会恢复，若无门槛则下一次滚动通知立即
  // 把视口按到底（实测距底 14~17px 被强拉），即「往下滚未到底突然跳底」。
  const lastPinnedTotalSizeRef = useRef(-1);
  const virtualizer = useVirtualizer({
    count: conversationRenderItems.length,
    getScrollElement: () => scrollElement,
    getItemKey,
    estimateSize,
    overscan: 8,
    scrollMargin,
    directDomUpdates: true,
    onChange: (instance) => {
      const totalSize = instance.getTotalSize();
      if (totalSize === lastPinnedTotalSizeRef.current) {
        return;
      }
      lastPinnedTotalSizeRef.current = totalSize;
      pinScrollToTail();
    },
  });

  // scrollMargin = 列表起点相对滚动 viewport 顶部的偏移（含 shell pt-6/7），
  // 否则 translateY 与 scrollToIndex 会整体偏移。
  useLayoutEffect(() => {
    const viewport = scrollElement;
    const listEl = sizingRef.current;
    if (!viewport || !listEl) {
      return;
    }
    const measure = () => {
      const listRect = listEl.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const next = listRect.top - viewportRect.top + viewport.scrollTop;
      setScrollMargin((current) => (Math.abs(current - next) > 0.5 ? next : current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(listEl);
    return () => observer.disconnect();
  }, [
    scrollElement,
    composerSessionKey,
    conversationListScopeKey,
    conversationListRemountEpoch,
  ]);

  const renderRow = (renderIndex: number): ReactNode => {
    const renderItem = conversationRenderItems[renderIndex];
    if (!renderItem) {
      return null;
    }
    const assistantTurnStart = assistantTurnStartIndexForRenderItem(renderItem, messages);
    const forkMenuHoverRevealed =
      assistantTurnStart !== null
      && hoveredAssistantTurnStart === assistantTurnStart;

    if (renderItem.kind === "process-group") {
      const anchorMessage = messages[renderItem.messageIndices[0]];
      if (!anchorMessage) {
        return null;
      }
      const showProcessGroupContinue = shouldShowContinueToolbarOnProcessGroup(
        renderItem.messageIndices,
        messages,
        turnContinue,
        conversationIsBusy === true,
        activeSessionReadOnly,
      );
      return (
        <div
          id={renderItem.groupId}
          data-spirit-surface="message-row"
          data-spirit-message-role="assistant"
          data-spirit-message-pending="false"
          data-spirit-fork-turn-start={assistantTurnStart ?? undefined}
          onPointerEnter={
            assistantTurnStart === null
              ? undefined
              : () => handleAssistantTurnPointerEnter(assistantTurnStart)
          }
          onPointerLeave={
            assistantTurnStart === null
              ? undefined
              : (event) => handleAssistantTurnPointerLeave(event, assistantTurnStart)
          }
          className="scroll-mt-4 flex w-full justify-start"
        >
          <div
            data-spirit-surface="message-assistant"
            className="min-w-0 w-full space-y-2"
          >
            <ProcessCardCollapsible
              groupId={renderItem.groupId}
              messageIndices={renderItem.messageIndices}
              messages={messages}
              toolCounts={renderItem.toolCounts}
              pendingAuxState={conversationPendingAuxState}
              playSealAnimation={shouldPlayProcessSealAnimation(renderItem.groupId)}
              manualOpen={processGroupManualOpen[processGroupManualOpenKey(renderItem.groupId)]}
              onManualOpenChange={(open) => {
                onProcessGroupManualOpenChange(renderItem.groupId, open);
              }}
              renderToolBlock={(message) => (
                <ToolCallCollapsible
                  tool={message.tool!}
                  workspaceRoot={workspaceRoot}
                  readLocalImagePreviewDataUrl={runtime.readLocalImagePreviewDataUrl}
                  readLocalVideoPreviewUrl={runtime.readLocalVideoPreviewUrl}
                  readManagedVideoPreviewUrl={runtime.readManagedVideoPreviewUrl}
                  saveLocalImageAs={runtime.saveLocalImageAs}
                  onOpenSubagentViewer={onOpenSubagentViewer}
                  onOpenReadFile={onOpenReadFile}
                  onOpenPlan={onOpenPlan}
                  onAbortShell={handleAbortShell}
                />
              )}
              readManagedImagePreviewDataUrl={runtime.readManagedImagePreviewDataUrl}
              readManagedVideoPreviewUrl={runtime.readManagedVideoPreviewUrl}
            />
            {showProcessGroupContinue && turnContinue ? (
              <MessageTurnActions
                showContinueButton
                continueTarget={turnContinue.continuableMessage}
                continueBusy={continueBusy}
                onContinue={handleContinueMessage}
                canShowActionsMenu={false}
                canCopy={false}
                copyEnabled={false}
                onCopy={() => {}}
                canFork={false}
                forkBusy={false}
                forkEnabled={false}
                forkMenuAlwaysVisible={false}
                onFork={() => {}}
              />
            ) : null}
          </div>
        </div>
      );
    }

    const index = renderItem.messageIndex;
    const message = messages[index];
    if (!message) {
      return null;
    }
    const queuedCanMoveUp =
      message.queued === true && (queuedBeforeCounts[index] ?? 0) > 0;
    const hiddenByProcessGroup = isMessageHiddenByProcessGroup(
      conversationRenderItems,
      index,
    );
    const rewindSelected = rewindDraft?.listIndex === index;
    // 派生布尔用完整 aux 计算（shouldShow… 会看相邻行的 live 状态）；MessageCard 的
    // pendingAuxState prop 才按 message.pending 门控——live aux 只与 pending 行自身
    // 相关，非 pending 行传 undefined 使 memo 在流式期间不被 aux 引用变化击穿。
    const pendingAuxForRow = message.pending ? conversationPendingAuxState : undefined;
    return (
      <MessageCard
        composerSessionKey={composerSessionKey}
        conversationListScopeKey={conversationListScopeKey}
        pendingAuxState={pendingAuxForRow}
        listIndex={index}
        message={message}
        hiddenByProcessGroup={hiddenByProcessGroup}
        externalRowGap
        compactAfterPrevious={false}
        tightenAfterPreviousMeta={false}
        showThinkingCollapsible={shouldShowAssistantThinkingCollapsible(
          message,
          conversationPendingAuxState,
          messages,
          index,
        )}
        thinkingReasoningLive={isAssistantReasoningLive(
          message,
          conversationPendingAuxState,
          messages,
          index,
        )}
        collapseThinkingDuringToolPreview={shouldCollapseThinkingDuringToolPreview(
          messages,
          index,
        )}
        turnActionsEligible={messageShowsAssistantTurnActions(message, messages, index)}
        inActiveStreamingTurn={isMessageInActiveStreamingTurn(
          messages,
          index,
          conversationIsBusy === true,
        )}
        canCopyTurn={canCopyAssistantTurn(messages, index)}
        onCopyTurn={handleCopyTurn}
        showContinueButton={
          turnContinue?.showContinueAtIndex === index &&
          !activeSessionReadOnly &&
          conversationIsBusy !== true
        }
        continueTarget={turnContinue?.continuableMessage}
        continueBusy={continueBusy}
        rewindSelected={rewindSelected}
        rewindSegments={rewindSelected ? rewindDraft.segments : []}
        rewindLocalFileAttachments={
          rewindSelected
            ? rewindDraft.localFileAttachments
            : EMPTY_REWIND_LOCAL_FILE_ATTACHMENTS
        }
        rewindBrowserElementAttachments={
          rewindSelected
            ? rewindDraft.browserElementAttachments
            : EMPTY_REWIND_BROWSER_ELEMENT_ATTACHMENTS
        }
        rewindRichInputRef={rewindRichInputRef}
        onRewindElementAttachmentsChange={handleRewindElementAttachmentsChange}
        rewindCanSubmit={
          messageRewindComposerEnabled &&
          rewindSelected &&
          (Boolean(rewindDraft.text.trim()) ||
            rewindDraft.browserElementAttachments.length > 0 ||
            rewindDraft.localFileAttachments.length > 0)
        }
        canPickLocalFile={runtime.hostKind === "electron"}
        rewindBusy={runtime.busyAction === "rewind"}
        models={rewindSelected ? models : EMPTY_MODELS}
        catalogHints={rewindSelected ? catalogHints : undefined}
        activeModel={activeModel}
        agentMode={agentMode}
        onContinue={handleContinueMessage}
        onRewindStart={onStartMessageRewind}
        onRewindSegmentsChange={handleRewindSegmentsChange}
        onRewindSubmit={onSubmitMessageRewind}
        onRewindRemoveLocalFileAttachment={onRewindRemoveLocalFileAttachment}
        onRewindPickLocalFile={onRewindPickLocalFile}
        onRewindPaste={onRewindPaste}
        onRewindDragOver={onRewindDragOver}
        onRewindDrop={onRewindDrop}
        onModelSelect={runtime.setActiveModel}
        onModelReasoningEffortSelect={runtime.setModelReasoningEffort}
        onModelThinkingEnabledSelect={runtime.setModelThinkingEnabled}
        onAgentModeChange={onComposerAgentModeChange}
        readManagedImagePreviewDataUrl={runtime.readManagedImagePreviewDataUrl}
        readManagedVideoPreviewUrl={runtime.readManagedVideoPreviewUrl}
        readLocalImagePreviewDataUrl={runtime.readLocalImagePreviewDataUrl}
        readLocalVideoPreviewUrl={runtime.readLocalVideoPreviewUrl}
        saveLocalImageAs={runtime.saveLocalImageAs}
        workspaceRoot={workspaceRoot}
        onOpenSubagentViewer={onOpenSubagentViewer}
        onOpenReadFile={onOpenReadFile}
        onOpenPlan={onOpenPlan}
        onAbortShell={handleAbortShell}
        queuedCanMoveUp={queuedCanMoveUp}
        queueActionBusy={runtime.busyAction === "send"}
        onQueueMoveUp={handleQueueMoveUp}
        onQueueSendNow={handleQueueSendNow}
        onQueueDelete={handleQueueDelete}
        conversationIsBusy={conversationIsBusy}
        activeSessionReadOnly={activeSessionReadOnly}
        forkBusy={runtime.busyAction === "fork"}
        forkMenuAlwaysVisible={
          !conversationIsBusy && turnActionsToolbarHostIndex === index
        }
        forkMenuHoverRevealed={forkMenuHoverRevealed}
        assistantTurnStartIndex={assistantTurnStart}
        onAssistantTurnPointerEnter={handleAssistantTurnPointerEnter}
        onAssistantTurnPointerLeave={handleAssistantTurnPointerLeave}
        onForkMessage={onForkMessage}
      />
    );
  };

  const virtualItems = virtualizer.getVirtualItems();
  const virtualTotalSize = virtualizer.getTotalSize();

  // 跟底钉底须在每次 totalSize 变化的 commit 里同步补一次：卡片高度动画每帧
  // 引发多轮布局反馈（行高变化 → 重测 → 重渲染 totalSize），浏览器 RO 有循环
  // 上限、超限通知推迟到下一帧，仅靠 stream tail 的内容 RO 钉底会让部分帧带着
  // 未钉底偏差上屏（实测 4~17px 振荡，即「居底展开过程卡片上下震」）。layout
  // effect 与本次重排同处一个 JS 任务，不受 RO 循环上限影响；非跟底时为空操作。
  useLayoutEffect(() => {
    pinScrollToTail();
  }, [virtualTotalSize, pinScrollToTail]);

  return (
    <div
      data-spirit-surface="conversation-list-shell"
      // overflow-x 必须用 clip 而非 hidden：hidden 会把 overflow-y 计算为 auto，
      // 流式时虚拟行实测先于 totalSize 提交、短暂溢出 sizing 容器，shell 即闪原生
      // 滚动条并挤窄布局；clip 不构成滚动容器，x 轴裁剪行为不变。
      className={cn(
        "mx-auto w-full overflow-x-clip pt-6 sm:pt-7",
        CONVERSATION_GUTTER_X,
        CONVERSATION_MESSAGE_LIST_MAX_W,
      )}
    >
      <ToolCallDiffHostProvider value={toolCallDiffHostValue}>
        {subagentViewActive && messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("app.subagentViewerEmpty")}
          </p>
        ) : null}
        <div
          key={`${composerSessionKey || "__no-session__"}:${conversationListScopeKey}:e${conversationListRemountEpoch}`}
          // directDomUpdates：容器高度与行 transform 由 virtualizer 直写，
          // JSX 不得再设 height / translateY（见上方 useVirtualizer 注释）。
          ref={(el) => {
            sizingRef.current = el;
            virtualizer.containerRef(el);
          }}
          data-spirit-surface="conversation-list"
          className="relative w-full"
        >
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              ref={(el) => {
                virtualizer.measureElement(el);
                // 滚动中挂载的行 virtual-core 会跳过同步实测（isScrolling 且无
                // scrollState 时仅注册 RO），实测与 scrollTop 补偿延迟到 paint 后。
                // 非滚动时 measureElement 已同步 resizeItem，勿重复调用。
                if (el && virtualizer.isScrolling) {
                  virtualizer.resizeItem(virtualItem.index, el.offsetHeight);
                }
              }}
              data-index={virtualItem.index}
              className="absolute left-0 top-0 w-full"
              style={{
                paddingTop: conversationRenderItemGapBeforePxAt(
                  virtualItem.index,
                  conversationRenderItems,
                  messages,
                ),
                // translateY（由 virtualizer 直写）使行 wrapper 自成 stacking
                // context，卡片内 z-40 无法跨出与 z-30 的 rewind 遮罩竞争；
                // rewind 行须在 wrapper 层提升 z。
                ...(rewindDraft
                && (() => {
                  const item = conversationRenderItems[virtualItem.index];
                  return item?.kind === "message" && item.messageIndex === rewindDraft.listIndex;
                })()
                  ? { zIndex: 40 }
                  : undefined),
              }}
            >
              {renderRow(virtualItem.index)}
            </div>
          ))}
        </div>
      </ToolCallDiffHostProvider>
    </div>
  );
}
