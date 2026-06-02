import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { GitChangesSection } from "@/components/git-changes-section";
import { cn } from "@/lib/utils";
import type {
  DesktopGitSnapshot,
  GitWorkingTreeSnapshot,
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
  className?: string;
};

export function WorkspaceGitTab({
  gitSnapshot,
  isActive,
  refreshNonce = 0,
  readGitWorkingTree,
  className,
}: WorkspaceGitTabProps) {
  const { t } = useTranslation();
  const [workingTree, setWorkingTree] = useState<GitWorkingTreeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadWorkingTree = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await readGitWorkingTree();
      setWorkingTree(next);
    } catch (loadError) {
      setError(describeError(loadError));
      setWorkingTree(null);
    } finally {
      setLoading(false);
    }
  }, [readGitWorkingTree]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadWorkingTree();
  }, [isActive, loadWorkingTree, refreshNonce, gitSnapshot?.hasChanges, gitSnapshot?.branch]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <GitChangesSection
        className="max-h-[45%] shrink-0 border-b border-border/40"
        gitSnapshot={gitSnapshot}
        workingTree={workingTree}
        loading={loading}
        error={error}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border/40 px-2 py-1.5">
          <h3 className="text-xs font-medium text-foreground">{t("workspace.git.history")}</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-xs text-muted-foreground">
          {t("workspace.git.historyLoading")}
        </div>
      </div>
    </div>
  );
}
