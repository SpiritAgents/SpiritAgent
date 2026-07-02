import { WorkspaceToolsDock } from "@/components/workspace-tools-panel";
import type { useComposerController } from "@/hooks/useComposerController";
import type { useConversationViewState } from "@/hooks/useConversationViewState";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import type { useWorkspaceToolsController } from "@/hooks/useWorkspaceToolsController";
import type { DesktopSnapshot } from "@/types";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;
type ConversationViewState = ReturnType<typeof useConversationViewState>;
type ComposerController = ReturnType<typeof useComposerController>;
type WorkspaceToolsController = ReturnType<typeof useWorkspaceToolsController>;

export type ConversationWorkspaceToolsDockProps = {
  useMicaBackdrop: boolean;
  snapshot: DesktopSnapshot | null;
  runtime: DesktopRuntime;
  conversation: ConversationViewState;
  composer: ComposerController;
  workspaceTools: WorkspaceToolsController;
  onOpenIntegrationsSettings: () => void;
};

/** App-level workspace tools panel; spans the full conversation split area (not a single pane). */
export function ConversationWorkspaceToolsDock({
  useMicaBackdrop,
  snapshot,
  runtime,
  conversation,
  composer,
  workspaceTools,
  onOpenIntegrationsSettings,
}: ConversationWorkspaceToolsDockProps) {
  return (
    <div data-spirit-surface="workspace-dock" className="flex min-h-0 shrink-0">
      <WorkspaceToolsDock
        useMicaBackdrop={useMicaBackdrop}
        workspaceRoot={snapshot?.workspaceRoot ?? ""}
        listExplorerChildren={runtime.listWorkspaceExplorerChildren}
        readWorkspaceTextFile={runtime.readWorkspaceTextFile}
        writeWorkspaceTextFile={runtime.writeWorkspaceTextFile}
        readHostTextFile={runtime.readHostTextFile}
        writeHostTextFile={runtime.writeHostTextFile}
        readManagedImagePreviewDataUrl={runtime.readManagedImagePreviewDataUrl}
        readLocalImagePreviewDataUrl={runtime.readLocalImagePreviewDataUrl}
        plan={snapshot?.plan ?? { path: "", exists: false }}
        onStartImplementing={() => {
          composer.handleComposerAgentModeChange("agent");
          void runtime.submitStartImplementing();
        }}
        startImplementingDisabled={
          conversation.startImplementingDisabled || !snapshot?.plan?.exists
        }
        autoRevealPlanNonce={workspaceTools.workspaceFilesPlanRevealNonce}
        planRevealTabId={workspaceTools.workspaceFilesPlanRevealTargetId}
        autoRevealFileNonce={workspaceTools.workspaceFileRevealNonce}
        fileRevealTabId={workspaceTools.workspaceFileRevealTargetId}
        fileRevealPath={workspaceTools.workspaceFileRevealPath}
        fileRevealAbsolutePath={workspaceTools.workspaceFileRevealAbsolutePath}
        fileRevealScope={workspaceTools.workspaceFileRevealScope}
        fileRevealViewMode={workspaceTools.workspaceFileRevealViewMode}
        fileRevealDirectoryOnly={workspaceTools.workspaceFileRevealDirectoryOnly}
        fileRevealLine={workspaceTools.workspaceFileRevealLine}
        fileRevealColumn={workspaceTools.workspaceFileRevealColumn}
        searchWorkspaceContent={runtime.searchWorkspaceContent}
        prRevealNonce={workspaceTools.workspacePrRevealNonce}
        prRevealTabId={workspaceTools.workspacePrRevealTargetId}
        prRevealRequest={workspaceTools.workspacePrRevealRequest}
        onOpenWorkspaceFile={workspaceTools.openWorkspaceFile}
        onOpenWorkspaceFileInNewTab={workspaceTools.openWorkspaceFileInNewTab}
        tabs={workspaceTools.workspaceToolTabs}
        activeTabId={workspaceTools.activeWorkspaceToolTabId}
        onTabsChange={workspaceTools.setWorkspaceToolTabs}
        onActiveTabIdChange={workspaceTools.setActiveWorkspaceToolTabId}
        onBrowserElementPicked={composer.handleBrowserElementPicked}
        onPrDiffAddToSession={composer.handlePrDiffAddToSession}
        onTerminalAddToSession={composer.handleTerminalAddToSession}
        onFileSnippetAddToSession={composer.handleFileSnippetAddToSession}
        onWorkspaceFileAddToSession={composer.handleWorkspaceFileAddToSession}
        onGitCommitAddToSession={composer.handleGitCommitAddToSession}
        onBrowserOpenInNewTab={workspaceTools.openBrowserUrlInNewTab}
        browserTabEnabled={workspaceTools.browserTabEnabled}
        prTabEnabled={workspaceTools.prTabEnabled}
        onOpenIntegrationsSettings={onOpenIntegrationsSettings}
        getGitHubAuthStatus={runtime.getGitHubAuthStatus}
        getGitHubPullRequestForCurrentBranch={runtime.getGitHubPullRequestForCurrentBranch}
        listGitHubPullRequests={runtime.listGitHubPullRequests}
        getGitHubPullRequestTabCounts={runtime.getGitHubPullRequestTabCounts}
        getGitHubPullRequestDetail={runtime.getGitHubPullRequestDetail}
        getGitHubPullRequestConversation={runtime.getGitHubPullRequestConversation}
        getGitHubPullRequestFiles={runtime.getGitHubPullRequestFiles}
        getGitHubPullRequestCommits={runtime.getGitHubPullRequestCommits}
        getGitHubPullRequestChecks={runtime.getGitHubPullRequestChecks}
        mergeGitHubPullRequest={runtime.mergeGitHubPullRequest}
        markGitHubPullRequestReady={runtime.markGitHubPullRequestReady}
        codeCompletionEnabled={snapshot?.codeCompletion?.userEnabled !== false}
        widthPx={workspaceTools.workspaceToolsWidthPx}
        onWidthPxChange={workspaceTools.setWorkspaceToolsWidthPx}
        gitSnapshot={snapshot?.git}
        gitChipBusy={composer.gitChipBusy}
        readGitWorkingTree={runtime.readGitWorkingTree}
        readGitHistory={runtime.readGitHistory}
        readGitCommitMessage={runtime.readGitCommitMessage}
        submitGitChip={runtime.submitGitChip}
      />
    </div>
  );
}
