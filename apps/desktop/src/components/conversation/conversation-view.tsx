import { useCallback, useRef } from "react";
import type {
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
  ComponentRef,
  KeyboardEvent as ReactKeyboardEvent,
  Ref,
  RefObject,
} from "react";
import { useTranslation } from "react-i18next";

import { ComposerDock } from "@/components/conversation/composer-dock";
import { ConversationList } from "@/components/conversation/conversation-list";
import { DesktopLayoutChromeBar } from "@/components/layout/desktop-layout-chrome-bar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ComposerRichInputHandle } from "@/components/composer-rich-input";
import type { DesktopAgentMode } from "@/lib/agent-mode";
import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import {
  CONVERSATION_GUTTER_X,
  CONVERSATION_MAX_W,
} from "@/lib/conversation-layout-constants";
import { desktopMicaTintClass, desktopMicaTintInnerClass } from "@/lib/desktop-mica-surface";
import type { EditorFileTarget } from "@/lib/workspace-editor-navigation";
import type { ActiveWorkspaceFileReferenceQuery } from "@/lib/composer-segment-model";
import type { ActiveSkillSlashQuery, SkillSlashSuggestion } from "@/lib/skill-slash";
import type { ComposerLocalFileAttachmentView } from "@/lib/local-file-attachments";
import { cn } from "@/lib/utils";
import type {
  ConversationMessageSnapshot,
  DesktopSnapshot,
  MessageRewindDraftState,
  WorkspaceFileReferenceSuggestionsResponse,
} from "@/types";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import { useConversationSessionScrollTail } from "@/hooks/useConversationSessionScrollTail";
import { useConversationStreamScrollTail } from "@/hooks/useConversationStreamScrollTail";
import type { ConversationRenderItem } from "@/lib/conversation-process-groups";
import type { TurnContinuePresentation } from "@/lib/conversation-continue-ui";
import type { PendingAssistantAux } from "@/types";
import { useConversationSplit } from "@/contexts/conversation-split-context";
import { PANE_DROP_ZONE_ORDER, effectiveRepositionZone, paneDropZoneGridCellClass, paneDropZoneGridLayoutClass, visiblePaneDropZonesForDrag } from "@/lib/conversation-pane-drop-preview";
import type { PaneDropZone } from "@/lib/conversation-split-layout";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;

export type ConversationListSectionProps = {
  messages: readonly ConversationMessageSnapshot[];
  conversationRenderItems: readonly ConversationRenderItem[];
  composerSessionKey: string;
  conversationListScopeKey: string;
  conversationListRemountEpoch: number;
  conversationPendingAuxState: PendingAssistantAux | undefined;
  processGroupManualOpen: Record<string, boolean>;
  processGroupManualOpenKey: (groupId: string) => string;
  onProcessGroupManualOpenChange: (groupId: string, open: boolean) => void;
  shouldPlayProcessSealAnimation: (groupId: string) => boolean;
  runtime: DesktopRuntime;
  turnContinue: TurnContinuePresentation | undefined;
  activeSessionReadOnly: boolean;
  continueBusy: boolean;
  rewindDraft: MessageRewindDraftState | null;
  onRewindDraftChange: (
    updater: (current: MessageRewindDraftState | null) => MessageRewindDraftState | null,
  ) => void;
  messageRewindComposerEnabled: boolean;
  rewindRichInputRef: RefObject<ComposerRichInputHandle | null>;
  models: DesktopSnapshot["config"]["models"];
  onOpenSubagentViewer: ((toolCallId: string) => void) | undefined;
  onOpenReadFile: ((target: EditorFileTarget) => void) | undefined;
  onStartMessageRewind: (message: ConversationMessageSnapshot, listIndex: number) => void;
  onForkMessage: (message: ConversationMessageSnapshot, listIndex: number) => void;
  onSubmitMessageRewind: () => void;
  onRewindRemoveLocalFileAttachment: (path: string) => void;
  onRewindPickLocalFile: () => void;
  onRewindPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onRewindDragOver: (event: ReactDragEvent<HTMLElement>) => void;
  onRewindDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onComposerAgentModeChange: (mode: DesktopAgentMode) => void;
};

export type ComposerDockSectionProps = {
  composerDockRef: Ref<HTMLDivElement | null>;
  composerInitialSegments?: import("@/lib/composer-segment-model").RichSegment[] | null;
  emptySessionGreeting: string;
  showWorkspaceBindingControls: boolean;
  paneSessionPath?: string;
  useIsolatedPaneWorkspace?: boolean;
  composerText: string;
  onComposerTextChange: (text: string) => void;
  composerLocalFileAttachments: ComposerLocalFileAttachmentView[];
  onComposerLocalFileAttachmentsChange: (
    attachments: ComposerLocalFileAttachmentView[],
  ) => void;
  commitBusy: boolean;
  rewindWarnings: NonNullable<DesktopSnapshot["conversation"]["rewindWarnings"]>;
  showPendingApprovalInComposer: boolean;
  pendingApproval: DesktopSnapshot["conversation"]["pendingToolApproval"];
  showPendingQuestionsInComposer: boolean;
  fileReferenceSuggestions: WorkspaceFileReferenceSuggestionsResponse;
  fileReferenceSelectedIndex: number;
  onFileReferenceSelectedIndexChange: (index: number) => void;
  onApplyFileReferenceSuggestion: (path: string) => void;
  onDismissFileReferenceSuggestions: () => void;
  activeFileReferenceQuery: ActiveWorkspaceFileReferenceQuery | undefined;
  slashQuery: ActiveSkillSlashQuery | undefined;
  slashSuggestions: SkillSlashSuggestion[];
  slashSelectedIndex: number;
  onSlashSelectedIndexChange: (index: number) => void;
  onApplySlashSuggestionItem: (suggestion: SkillSlashSuggestion) => void;
  onDismissSlashSuggestions: () => void;
  composerCursorCodeUnits: number;
  composerPlaceholder: string;
  composerAgentModeChipPlaceholder?: string;
  composerCanSend: boolean;
  composerHasPayload: boolean;
  conversationInterruptible: boolean;
  composerBrowserElementAttachments: BrowserElementAttachment[];
  onComposerBrowserElementAttachmentsChange: (attachments: BrowserElementAttachment[]) => void;
  onSubmitComposerMessage: () => void;
  onComposerAgentModeChange: (mode: DesktopAgentMode) => void;
  composerRichInputRef: RefObject<ComposerRichInputHandle | null>;
  onComposerKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onComposerCursorCodeUnitsChange: (selectionStart: number) => void;
  onInsertFileReferenceTrigger: () => void;
  onPickLocalFileFromPalette: () => void;
  onInsertSkillTriggerFromPalette: () => void;
  onRemoveLocalFileAttachment: (path: string) => void;
  onComposerPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onComposerDragOver: (event: ReactDragEvent<HTMLElement>) => void;
  onComposerDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onComposerSegmentsCommit: () => void;
  models: DesktopSnapshot["config"]["models"];
  onOpenGitTab: () => void;
};

export type ConversationViewProps = {
  useMicaBackdrop: boolean;
  isEmptySession: boolean;
  hideStaleConversationMessages: boolean;
  snapshot: DesktopSnapshot | null;
  subagentViewActive: boolean;
  onExitSubagentViewer: (() => void) | undefined;
  onNewSession: (() => void) | undefined;
  newSessionBusy: boolean;
  compactionDemoActive: boolean;
  onCompactionDemoStop: () => void;
  rewindDraft: MessageRewindDraftState | null;
  onRewindDraftClear: () => void;
  conversationScrollBedPaddingPx: number;
  list: ConversationListSectionProps;
  composerDock: ComposerDockSectionProps;
  showComposerDock?: boolean;
  showSessionSidebarToggle?: boolean;
  showWorkspaceToggle?: boolean;
  showSplitMenu?: boolean;
  showClosePane?: boolean;
  onSplit?: () => void;
  onSplitVertical?: () => void;
  onClosePane?: () => void;
  paneId?: string;
  onPaneFocus?: () => void;
  onPaneDragStart?: (paneId: string) => void;
  onPaneDragEnter?: (paneId: string, zone: import("@/lib/conversation-split-layout").PaneRepositionZone) => void;
  onPaneDragLeave?: () => void;
  onPaneDrop?: (paneId: string, zone: PaneDropZone) => void;
  paneDropOverlayActive?: boolean;
  paneDragSourcePaneId?: string | null;
};

export function ConversationView({
  useMicaBackdrop,
  isEmptySession,
  hideStaleConversationMessages,
  snapshot,
  subagentViewActive,
  onExitSubagentViewer,
  onNewSession,
  newSessionBusy,
  compactionDemoActive,
  onCompactionDemoStop,
  rewindDraft,
  onRewindDraftClear,
  conversationScrollBedPaddingPx,
  list,
  composerDock,
  showComposerDock = true,
  showSessionSidebarToggle = true,
  showWorkspaceToggle = true,
  showSplitMenu = false,
  showClosePane = false,
  onSplit,
  onSplitVertical,
  onClosePane,
  paneId,
  onPaneFocus,
  onPaneDragStart,
  onPaneDragEnter,
  onPaneDragLeave,
  onPaneDrop,
  paneDropOverlayActive = false,
  paneDragSourcePaneId = null,
}: ConversationViewProps) {
  const { t } = useTranslation();
  const split = useConversationSplit();
  const conversationScrollAreaRef = useRef<ComponentRef<typeof ScrollArea>>(null);
  const conversationMessagesVisible =
    (!isEmptySession || subagentViewActive) && !hideStaleConversationMessages;
  const sessionTitleVisible = !isEmptySession && !hideStaleConversationMessages;


  useConversationSessionScrollTail({
    scrollAreaRef: conversationScrollAreaRef,
    composerSessionKey: list.composerSessionKey,
    enabled: conversationMessagesVisible,
  });

  useConversationStreamScrollTail({
    scrollAreaRef: conversationScrollAreaRef,
    messages: list.messages,
    pendingAuxState: list.conversationPendingAuxState,
    isBusy: snapshot?.conversation.isBusy === true,
    scrollBedPaddingPx: conversationScrollBedPaddingPx,
    enabled: conversationMessagesVisible,
  });

  const dropOverlayActive = Boolean(paneId && onPaneDrop && paneDropOverlayActive);
  const isDragSourcePane = Boolean(paneId && paneDragSourcePaneId === paneId);
  const showDropTargets = dropOverlayActive && !isDragSourcePane;
  const dropHostRef = useRef<HTMLDivElement | null>(null);

  const resolveVisibleDropZones = useCallback(() => {
    if (!paneId || !paneDragSourcePaneId) {
      return PANE_DROP_ZONE_ORDER;
    }
    const sourceHost = document.querySelector(
      `[data-pane-drop-host="${paneDragSourcePaneId}"]`,
    );
    return visiblePaneDropZonesForDrag({
      paneCount: split.paneCount,
      sourcePaneHost: sourceHost instanceof HTMLElement ? sourceHost : null,
      targetPaneHost: dropHostRef.current,
    });
  }, [paneDragSourcePaneId, paneId, split.paneCount]);

  const updateDropTarget = useCallback(
    (zone: PaneDropZone) => {
      if (!paneId) {
        return;
      }
      const visible = resolveVisibleDropZones();
      if (!visible.includes(zone)) {
        return;
      }
      split.setPaneDropTarget({ paneId, zone });
    },
    [paneId, resolveVisibleDropZones, split],
  );

  const clearDropTargetIfLeavingHost = useCallback(
    (event: ReactDragEvent<HTMLElement>) => {
      if (!paneId || !showDropTargets) {
        return;
      }
      const related = event.relatedTarget;
      if (related instanceof Node && dropHostRef.current?.contains(related)) {
        return;
      }
      if (related instanceof Element) {
        const relatedHostEl = related.closest("[data-pane-drop-host]");
        const otherPaneId =
          relatedHostEl instanceof HTMLElement
            ? relatedHostEl.getAttribute("data-pane-drop-host")
            : null;
        const enteringValidTargetHost =
          otherPaneId
          && otherPaneId !== paneId
          && otherPaneId !== paneDragSourcePaneId;
        if (enteringValidTargetHost) {
          return;
        }
      }
      if (split.paneDropTarget?.paneId === paneId) {
        split.setPaneDropTarget(null);
      }
    },
    [paneDragSourcePaneId, paneId, showDropTargets, split],
  );

  return (
    <div data-spirit-surface="conversation-layout" className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden min-w-0", desktopMicaTintInnerClass(useMicaBackdrop))}>
      <div
        ref={dropHostRef}
        data-spirit-surface="conversation-shell"
        {...(paneId ? { "data-pane-drop-host": paneId } : {})}
        className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col min-w-0", desktopMicaTintInnerClass(useMicaBackdrop))}
        onPointerDown={() => {
          onPaneFocus?.();
        }}
        onDragLeave={clearDropTargetIfLeavingHost}
      >
        <DesktopLayoutChromeBar
          useMicaBackdrop={useMicaBackdrop}
          showSessionSidebarToggle={showSessionSidebarToggle}
          showWorkspaceToggle={showWorkspaceToggle}
          showSplitMenu={showSplitMenu}
          showClosePane={showClosePane}
          onSplit={onSplit}
          onSplitVertical={onSplitVertical}
          onClosePane={onClosePane}
          paneId={paneId}
          onPaneDragStart={onPaneDragStart}
          onPaneDragEnter={onPaneDragEnter}
          onPaneDragLeave={onPaneDragLeave}
          onPaneDrop={onPaneDrop}
          sessionTitle={
            sessionTitleVisible
              ? snapshot?.activeSession?.displayName
              : null
          }
          subagentPromptText={
            subagentViewActive ? snapshot?.subagentViewer?.promptText : null
          }
          onExitSubagentViewer={onExitSubagentViewer}
          onNewSession={isEmptySession ? undefined : onNewSession}
          newSessionBusy={newSessionBusy}
        />
        {showDropTargets ? (() => {
          const visibleDropZones = resolveVisibleDropZones();
          return (
          <div
            className={cn(
              "absolute inset-0 z-30 grid cursor-crosshair",
              paneDropZoneGridLayoutClass(visibleDropZones),
            )}
          >
            {visibleDropZones.map((zone) => (
              <div
                key={zone}
                data-pane-drop-zone={zone}
                className={cn(
                  "pointer-events-auto",
                  paneDropZoneGridCellClass(zone, visibleDropZones),
                )}
                onDragEnter={(event) => {
                  event.preventDefault();
                  updateDropTarget(zone);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  updateDropTarget(zone);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!visibleDropZones.includes(zone)) {
                    return;
                  }
                  if (zone === "swap") {
                    onPaneDrop?.(paneId!, zone);
                    return;
                  }
                  onPaneDrop?.(paneId!, effectiveRepositionZone(zone, visibleDropZones));
                }}
              />
            ))}
          </div>
          );
        })() : null}
        <div
          data-spirit-surface="conversation-drop-host"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        >
        <div
          data-spirit-surface="conversation-stage"
          className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col text-sm", desktopMicaTintClass(useMicaBackdrop))}
        >
          {compactionDemoActive ? (
            <div
              data-spirit-surface="compaction-ui-demo-banner"
              className={cn("shrink-0", desktopMicaTintInnerClass(useMicaBackdrop))}
            >
              <div
                className={cn(
                  "mx-auto flex w-full flex-wrap items-center justify-between gap-2 py-2",
                  CONVERSATION_GUTTER_X,
                  CONVERSATION_MAX_W,
                )}
              >
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{t('app.compactionDemo')}</span>
                  <span className="hidden sm:inline">
                    {" "}
                    · {t('app.compactionDemoDescription')}
                  </span>
                </p>
                <Button type="button" variant="outline" size="sm" onClick={onCompactionDemoStop}>
                  {t('app.exitDemo')}
                </Button>
              </div>
            </div>
          ) : null}
          {rewindDraft ? (
            <button
              type="button"
              aria-label={t('app.cancelRewind')}
              className="fixed inset-0 z-30 cursor-default bg-background/35 backdrop-blur-sm"
              onClick={onRewindDraftClear}
            />
          ) : null}
          <ScrollArea
            ref={conversationScrollAreaRef}
            data-spirit-surface="conversation-scroll"
            className={cn("min-h-0 flex-1", desktopMicaTintInnerClass(useMicaBackdrop))}
            type="hover"
            scrollHideDelay={450}
          >
            {/* min-h-full：短内容仍铺满视口；pb ≥ dock 实测高度 + 留白，审批卡弹出时同步增高 */}
            <div
              data-spirit-surface="conversation-scroll-body"
              className={cn("min-h-full w-full", desktopMicaTintInnerClass(useMicaBackdrop))}
              style={
                (!isEmptySession || subagentViewActive) && !hideStaleConversationMessages
                  ? { paddingBottom: conversationScrollBedPaddingPx }
                  : undefined
              }
            >
              {(!isEmptySession || subagentViewActive) && !hideStaleConversationMessages ? (
                <ConversationList
                  messages={list.messages}
                  conversationRenderItems={list.conversationRenderItems}
                  subagentViewActive={subagentViewActive}
                  composerSessionKey={list.composerSessionKey}
                  conversationListScopeKey={list.conversationListScopeKey}
                  conversationListRemountEpoch={list.conversationListRemountEpoch}
                  conversationPendingAuxState={list.conversationPendingAuxState}
                  processGroupManualOpen={list.processGroupManualOpen}
                  processGroupManualOpenKey={list.processGroupManualOpenKey}
                  onProcessGroupManualOpenChange={list.onProcessGroupManualOpenChange}
                  shouldPlayProcessSealAnimation={list.shouldPlayProcessSealAnimation}
                  workspaceRoot={snapshot?.workspaceRoot ?? ""}
                  runtime={list.runtime}
                  turnContinue={list.turnContinue}
                  activeSessionReadOnly={list.activeSessionReadOnly}
                  conversationIsBusy={snapshot?.conversation.isBusy === true}
                  continueBusy={list.continueBusy}
                  rewindDraft={list.rewindDraft}
                  onRewindDraftChange={list.onRewindDraftChange}
                  messageRewindComposerEnabled={list.messageRewindComposerEnabled}
                  rewindRichInputRef={list.rewindRichInputRef}
                  models={list.models}
                  catalogHints={snapshot?.config.modelCatalogHints}
                  activeModel={list.runtime.settings.activeModel}
                  agentMode={list.runtime.settings.agentMode}
                  onOpenSubagentViewer={list.onOpenSubagentViewer}
                  onOpenReadFile={list.onOpenReadFile}
                  onStartMessageRewind={list.onStartMessageRewind}
                  onForkMessage={list.onForkMessage}
                  onSubmitMessageRewind={list.onSubmitMessageRewind}
                  onRewindRemoveLocalFileAttachment={list.onRewindRemoveLocalFileAttachment}
                  onRewindPickLocalFile={list.onRewindPickLocalFile}
                  onRewindPaste={list.onRewindPaste}
                  onRewindDragOver={list.onRewindDragOver}
                  onRewindDrop={list.onRewindDrop}
                  onComposerAgentModeChange={list.onComposerAgentModeChange}
                />
              ) : null}
            </div>
          </ScrollArea>

          {showComposerDock ? (
          <ComposerDock
            ref={composerDock.composerDockRef}
            isEmptySession={isEmptySession}
            emptySessionGreeting={composerDock.emptySessionGreeting}
            composerInitialSegments={composerDock.composerInitialSegments}
            showWorkspaceBindingControls={composerDock.showWorkspaceBindingControls}
            paneSessionPath={composerDock.paneSessionPath}
            useIsolatedPaneWorkspace={composerDock.useIsolatedPaneWorkspace}
            composerText={composerDock.composerText}
            onComposerTextChange={composerDock.onComposerTextChange}
            composerLocalFileAttachments={composerDock.composerLocalFileAttachments}
            onComposerLocalFileAttachmentsChange={composerDock.onComposerLocalFileAttachmentsChange}
            snapshot={snapshot}
            runtime={list.runtime}
            commitBusy={composerDock.commitBusy}
            activeSessionReadOnly={list.activeSessionReadOnly}
            rewindWarnings={composerDock.rewindWarnings}
            showPendingApprovalInComposer={composerDock.showPendingApprovalInComposer}
            pendingApproval={composerDock.pendingApproval}
            showPendingQuestionsInComposer={composerDock.showPendingQuestionsInComposer}
            fileReferenceSuggestions={composerDock.fileReferenceSuggestions}
            fileReferenceSelectedIndex={composerDock.fileReferenceSelectedIndex}
            onFileReferenceSelectedIndexChange={composerDock.onFileReferenceSelectedIndexChange}
            onApplyFileReferenceSuggestion={composerDock.onApplyFileReferenceSuggestion}
            onDismissFileReferenceSuggestions={composerDock.onDismissFileReferenceSuggestions}
            activeFileReferenceQuery={composerDock.activeFileReferenceQuery}
            slashQuery={composerDock.slashQuery}
            slashSuggestions={composerDock.slashSuggestions}
            slashSelectedIndex={composerDock.slashSelectedIndex}
            onSlashSelectedIndexChange={composerDock.onSlashSelectedIndexChange}
            onApplySlashSuggestionItem={composerDock.onApplySlashSuggestionItem}
            onDismissSlashSuggestions={composerDock.onDismissSlashSuggestions}
            composerCursorCodeUnits={composerDock.composerCursorCodeUnits}
            composerPlaceholder={composerDock.composerPlaceholder}
            composerAgentModeChipPlaceholder={composerDock.composerAgentModeChipPlaceholder}
            composerCanSend={composerDock.composerCanSend}
            composerHasPayload={composerDock.composerHasPayload}
            conversationInterruptible={composerDock.conversationInterruptible}
            continueBusy={list.continueBusy}
            composerBrowserElementAttachments={composerDock.composerBrowserElementAttachments}
            onComposerBrowserElementAttachmentsChange={composerDock.onComposerBrowserElementAttachmentsChange}
            onSubmitComposerMessage={composerDock.onSubmitComposerMessage}
            onComposerAgentModeChange={composerDock.onComposerAgentModeChange}
            composerRichInputRef={composerDock.composerRichInputRef}
            onComposerKeyDown={composerDock.onComposerKeyDown}
            onComposerCursorCodeUnitsChange={composerDock.onComposerCursorCodeUnitsChange}
            onInsertFileReferenceTrigger={composerDock.onInsertFileReferenceTrigger}
            onPickLocalFileFromPalette={composerDock.onPickLocalFileFromPalette}
            onInsertSkillTriggerFromPalette={composerDock.onInsertSkillTriggerFromPalette}
            onRemoveLocalFileAttachment={composerDock.onRemoveLocalFileAttachment}
            onComposerPaste={composerDock.onComposerPaste}
            onComposerDragOver={composerDock.onComposerDragOver}
            onComposerDrop={composerDock.onComposerDrop}
            onComposerSegmentsCommit={composerDock.onComposerSegmentsCommit}
            models={composerDock.models}
            useMicaBackdrop={useMicaBackdrop}
            onOpenGitTab={composerDock.onOpenGitTab}
          />
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
