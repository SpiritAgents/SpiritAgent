import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { GitChangesSection } from "@/components/git-changes-section";
import { GitCommitGraph } from "@/components/git-commit-graph";
import { cn } from "@/lib/utils";
import type {
  DesktopGitSnapshot,
  GitHistorySnapshot,
  GitWorkingTreeSnapshot,
  ReadGitHistoryRequest,
} from "@/types";

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export type WorkspaceGitTabProps = {
  gitSnapshot?: DesktopGitSnapshot;
  isActive: boolean;
  refreshNonce?: number;
  readGitWorkingTree: () => Promise<GitWorkingTreeSnapshot>;
  readGitHistory: (request?: ReadGitHistoryRequest) => Promise<GitHistorySnapshot>;
  className?: string;
};

export function WorkspaceGitTab({
  gitSnapshot,
  isActive,
  refreshNonce = 0,
  readGitWorkingTree,
  readGitHistory,
  className,
}: WorkspaceGitTabProps) {
  const { t } = useTranslation();
  const [workingTree, setWorkingTree] = useState<GitWorkingTreeSnapshot | null>(null);
  const [history, setHistory] = useState<GitHistorySnapshot | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [historyError, setHistoryError] = useState("");

  const loadWorkingTree = useCallback(async () => {
    setLoadingTree(true);
    setTreeError("");
    try {
      const next = await readGitWorkingTree();
      setWorkingTree(next);
    } catch (loadError) {
      setTreeError(describeError(loadError));
      setWorkingTree(null);
    } finally {
      setLoadingTree(false);
    }
  }, [readGitWorkingTree]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const next = await readGitHistory();
      setHistory(next);
    } catch (loadError) {
      setHistoryError(describeError(loadError));
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  }, [readGitHistory]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadWorkingTree();
    void loadHistory();
  }, [isActive, loadWorkingTree, loadHistory, refreshNonce, gitSnapshot?.hasChanges, gitSnapshot?.branch]);

  const reloadAll = useCallback(() => {
    void loadWorkingTree();
    void loadHistory();
  }, [loadWorkingTree, loadHistory]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    if (refreshNonce > 0) {
      reloadAll();
    }
  }, [isActive, refreshNonce, reloadAll]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <GitChangesSection
        className="max-h-[45%] shrink-0 border-b border-border/40"
        gitSnapshot={gitSnapshot}
        workingTree={workingTree}
        loading={loadingTree}
        error={treeError}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border/40 px-2 py-1.5">
          <h3 className="text-xs font-medium text-foreground">{t("workspace.git.history")}</h3>
        </div>
        <GitCommitGraph
          className="flex-1"
          history={history}
          loading={loadingHistory}
          error={historyError}
        />
      </div>
    </div>
  );
}
