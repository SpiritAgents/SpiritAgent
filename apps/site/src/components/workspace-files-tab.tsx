import { WorkspaceFilesPanel } from "@/components/workspace-files-panel";
import { WorkspacePlanPreviewTab } from "@/components/workspace-plan-preview-tab";
import type { PlanSnapshot, WorkspaceExplorerListResult } from "@/types/spirit-desktop";

export type WorkspaceFilesTabProps = {
  workspaceRoot: string;
  listExplorerChildren: (relativePath: string) => Promise<WorkspaceExplorerListResult>;
  plan?: PlanSnapshot;
  planPreviewContent?: string;
  autoRevealPlanNonce?: number;
  hideFileTree?: boolean;
};

export function WorkspaceFilesTab({
  workspaceRoot,
  listExplorerChildren,
  plan,
  planPreviewContent = "",
  autoRevealPlanNonce = 0,
  hideFileTree = false,
}: WorkspaceFilesTabProps) {
  if (plan) {
    return (
      <WorkspacePlanPreviewTab
        workspaceRoot={workspaceRoot}
        listExplorerChildren={listExplorerChildren}
        plan={plan}
        planPreviewContent={planPreviewContent}
        autoRevealPlanNonce={autoRevealPlanNonce}
        hideFileTree={hideFileTree}
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <WorkspaceFilesPanel
        workspaceRoot={workspaceRoot}
        listExplorerChildren={listExplorerChildren}
        selectedRelativePath={null}
      />
    </div>
  );
}
