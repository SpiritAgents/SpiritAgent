import { ChevronDown } from "lucide-react";

import { workspaceExplorerIcon } from "@/lib/workspace-explorer-icon";
import type { LandingEditorTreeNode } from "@/lib/landing-code-completion-demo-script";
import { cn } from "@/lib/utils";

type LandingEditorFileTreeProps = {
  root: LandingEditorTreeNode;
  className?: string;
};

function TreeNode({ node, depth }: { node: LandingEditorTreeNode; depth: number }) {
  const Icon = workspaceExplorerIcon(node.name, node.kind);
  const isDir = node.kind === "dir";
  const paddingLeft = 6 + depth * 9;

  return (
    <>
      <div
        className={cn(
          "flex min-w-0 items-center gap-1 py-0.5 pr-2 text-[10px] leading-tight",
          node.selected ? "bg-white/10 text-white" : "text-white/72",
        )}
        style={{ paddingLeft }}
      >
        {isDir ? (
          <ChevronDown className="size-2.5 shrink-0 text-white/45" aria-hidden />
        ) : (
          <span className="size-2.5 shrink-0" aria-hidden />
        )}
        <Icon className="size-3 shrink-0 text-white/55" aria-hidden />
        <span className="truncate">{node.name}</span>
      </div>
      {node.children?.map((child) => (
        <TreeNode key={`${depth}-${child.name}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function LandingEditorFileTree({ root, className }: LandingEditorFileTreeProps) {
  return (
    <div
      className={cn(
        "h-full min-h-0 w-[7rem] shrink-0 overflow-hidden border-r border-white/8 bg-[#000000] py-1.5",
        className,
      )}
    >
      <TreeNode node={root} depth={0} />
    </div>
  );
}
