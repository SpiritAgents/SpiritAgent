import { useTranslation } from "react-i18next";

import { LoaderCircle } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DesktopGitSnapshot, GitWorkingTreeChange, GitWorkingTreeSnapshot } from "@/types";

export type GitChangesSectionProps = {
  gitSnapshot?: DesktopGitSnapshot;
  workingTree: GitWorkingTreeSnapshot | null;
  loading: boolean;
  error?: string;
  className?: string;
};

function statusCodeClass(code: string): string {
  if (code.includes("?")) {
    return "text-muted-foreground";
  }
  if (code.includes("D")) {
    return "text-destructive";
  }
  if (code.includes("A")) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  return "text-amber-600 dark:text-amber-400";
}

function ChangeRow({ change }: { change: GitWorkingTreeChange }) {
  return (
    <li className="flex min-w-0 items-center gap-2 px-2 py-1 text-xs">
      <span
        className={cn("w-5 shrink-0 font-mono font-medium tabular-nums", statusCodeClass(change.code))}
        title={change.code}
      >
        {change.code.trim() || "·"}
      </span>
      <span className="min-w-0 truncate font-mono text-foreground/90" title={change.path}>
        {change.path}
      </span>
    </li>
  );
}

export function GitChangesSection({
  gitSnapshot,
  workingTree,
  loading,
  error,
  className,
}: GitChangesSectionProps) {
  const { t } = useTranslation();
  const isRepository = gitSnapshot?.isRepository === true && workingTree?.isRepository !== false;
  const changes = workingTree?.changes ?? [];
  const branchLabel = gitSnapshot?.branch ?? gitSnapshot?.worktreeBranch;

  return (
    <section className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-2 py-1.5">
        <h3 className="text-xs font-medium text-foreground">{t("workspace.git.changes")}</h3>
        {branchLabel ? (
          <span className="max-w-[55%] truncate rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {branchLabel}
          </span>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            {t("workspace.git.loadingChanges")}
          </div>
        ) : null}
        {!loading && !isRepository ? (
          <p className="p-3 text-xs text-muted-foreground">{t("workspace.git.noRepo")}</p>
        ) : null}
        {!loading && isRepository && error ? (
          <p className="p-3 text-xs text-destructive">{error}</p>
        ) : null}
        {!loading && isRepository && !error && changes.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">{t("workspace.git.noChanges")}</p>
        ) : null}
        {!loading && isRepository && !error && changes.length > 0 ? (
          <ScrollArea className="h-full max-h-48">
            <ul className="py-1">
              {changes.map((change) => (
                <ChangeRow key={`${change.code}:${change.path}`} change={change} />
              ))}
            </ul>
          </ScrollArea>
        ) : null}
      </div>
    </section>
  );
}
