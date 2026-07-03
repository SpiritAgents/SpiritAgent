import { useTranslation } from "react-i18next";

import { ProcessCardCollapsible } from "@/components/process-card-collapsible";
import { ToolCallDiffHostProvider } from "@/components/tool-call-diff-host-context";
import { ToolCallCollapsible } from "@/components/tool-call/tool-call-collapsible";
import type { ComposerRichInputHandle } from "@/components/composer-rich-input";
import { MessageCard } from "@/components/conversation/message-card";
import { MessageTurnActions } from "@/components/conversation/message-turn-actions";
import type { DesktopAgentMode } from "@/lib/agent-mode";
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
  assistantTurnStartIndexForRenderItem,
  resolveTurnActionsToolbarHostIndex,
  shouldClearAssistantTurnHover,
} from "@/lib/message-turn-actions-ui";
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

export type ConversationListProps = {
  messages: readonly ConversationMessageSnapshot[];
  conversationRenderItems: readonly ConversationRenderItem[];
  /** 虚拟化滚动容器（Radix ScrollArea viewport）；由 ConversationView 提供。 */
  getScrollElement: () => HTMLElement | null;
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
  useLayoutEffect(() => {
    setScrollElement(getScrollElement());
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
  const virtualizer = useVirtualizer({
    count: conversationRenderItems.length,
    getScrollElement: () => scrollElement,
    getItemKey,
    estimateSize,
    overscan: 8,
    scrollMargin,
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
                  onAbortShell={(toolCallId) => {
                    void runtime.abortShell(toolCallId);
                  }}
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
                onContinue={(targetMessage) => {
                  void runtime.continueAssistantCompletion(targetMessage.id);
                }}
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
    const queuedBeforeCount = messages
      .slice(0, index)
      .filter((item) => item.queued === true).length;
    const queuedCanMoveUp =
      message.queued === true && queuedBeforeCount > 0;
    const hiddenByProcessGroup = isMessageHiddenByProcessGroup(
      conversationRenderItems,
      index,
    );
    return (
      <MessageCard
        composerSessionKey={composerSessionKey}
        conversationListScopeKey={conversationListScopeKey}
        messages={messages}
        pendingAuxState={conversationPendingAuxState}
        listIndex={index}
        message={message}
        hiddenByProcessGroup={hiddenByProcessGroup}
        compactAfterPrevious={false}
        tightenAfterPreviousMeta={false}
        showContinueButton={
          turnContinue?.showContinueAtIndex === index &&
          !activeSessionReadOnly &&
          conversationIsBusy !== true
        }
        continueTarget={turnContinue?.continuableMessage}
        continueBusy={continueBusy}
        rewindSelected={rewindDraft?.listIndex === index}
        rewindText={
          rewindDraft?.listIndex === index ? rewindDraft.text : ""
        }
        rewindLocalFileAttachments={
          rewindDraft?.listIndex === index
            ? rewindDraft.localFileAttachments
            : []
        }
        rewindBrowserElementAttachments={
          rewindDraft?.listIndex === index
            ? rewindDraft.browserElementAttachments
            : []
        }
        rewindRichInputRef={rewindRichInputRef}
        onRewindElementAttachmentsChange={(attachments) => {
          onRewindDraftChange((current) =>
            current && current.listIndex === index
              ? { ...current, browserElementAttachments: attachments }
              : current,
          );
        }}
        rewindCanSubmit={
          messageRewindComposerEnabled &&
          rewindDraft?.listIndex === index &&
          (Boolean(rewindDraft.text.trim()) ||
            rewindDraft.browserElementAttachments.length > 0 ||
            rewindDraft.localFileAttachments.length > 0)
        }
        canPickLocalFile={runtime.hostKind === "electron"}
        rewindBusy={runtime.busyAction === "rewind"}
        models={models}
        catalogHints={catalogHints}
        activeModel={activeModel}
        agentMode={agentMode}
        onContinue={(targetMessage) => {
          void runtime.continueAssistantCompletion(targetMessage.id);
        }}
        onRewindStart={onStartMessageRewind}
        onRewindChange={(value) => {
          onRewindDraftChange((current) =>
            current ? { ...current, text: value } : current,
          );
        }}
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
        onAbortShell={(toolCallId) => {
          void runtime.abortShell(toolCallId);
        }}
        queuedCanMoveUp={queuedCanMoveUp}
        queueActionBusy={runtime.busyAction === "send"}
        onQueueMoveUp={(queueId) => {
          void runtime.reorderQueuedUserTurn(queueId);
        }}
        onQueueSendNow={(queueId) => {
          void runtime.sendQueuedUserTurnNow(queueId);
        }}
        onQueueDelete={(queueId) => {
          void runtime.removeQueuedUserTurn(queueId);
        }}
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
          ref={sizingRef}
          data-spirit-surface="conversation-list"
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              className="absolute left-0 top-0 w-full"
              style={{
                paddingTop: conversationRenderItemGapBeforePxAt(
                  virtualItem.index,
                  conversationRenderItems,
                  messages,
                ),
                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
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
