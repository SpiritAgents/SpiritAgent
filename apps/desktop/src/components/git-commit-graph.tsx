import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChevronDown, ChevronRight, Copy, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GitCommitGraphRow, GitHistorySnapshot } from "@/types";

const ROW_HEIGHT_PX = 32;
const GRAPH_GUTTER_MIN_PX = 56;

export type GitCommitGraphProps = {
  history: GitHistorySnapshot | null;
  loading: boolean;
  error?: string;
  className?: string;
};

function laneCenterX(lane: number, laneCount: number, gutterWidth: number): number {
  const laneWidth = gutterWidth / Math.max(laneCount, 1);
  return lane * laneWidth + laneWidth / 2;
}

function activeLanesForRow(row: GitCommitGraphRow): number[] {
  const set = new Set<number>([row.lane, ...row.passingLanes, ...row.mergeLanes]);
  return [...set].sort((a, b) => a - b);
}

function lanesActiveOnNextRow(current: GitCommitGraphRow, next?: GitCommitGraphRow): number[] {
  if (!next) {
    return [];
  }
  const set = new Set<number>([next.lane, ...next.passingLanes, ...next.mergeLanes]);
  for (const lane of activeLanesForRow(current)) {
    set.add(lane);
  }
  return [...set].sort((a, b) => a - b);
}

function CommitGraphGutter({
  rows,
  gutterWidth,
}: {
  rows: GitCommitGraphRow[];
  gutterWidth: number;
}) {
  const height = rows.length * ROW_HEIGHT_PX;

  return (
    <svg
      width={gutterWidth}
      height={height}
      className="shrink-0 text-muted-foreground/70"
      aria-hidden
    >
      {rows.map((row, rowIndex) => {
        const yTop = rowIndex * ROW_HEIGHT_PX;
        const yCenter = yTop + ROW_HEIGHT_PX / 2;
        const yBottom = yTop + ROW_HEIGHT_PX;
        const nextRow = rows[rowIndex + 1];
        const continueLanes = lanesActiveOnNextRow(row, nextRow);

        return (
          <g key={row.commit.oid}>
            {activeLanesForRow(row).map((lane) => {
              const x = laneCenterX(lane, row.laneCount, gutterWidth);
              const continues = continueLanes.includes(lane) || lane === row.lane;
              if (!continues && lane !== row.lane) {
                return null;
              }
              return (
                <line
                  key={`${row.commit.oid}-lane-${lane}`}
                  x1={x}
                  y1={yTop}
                  x2={x}
                  y2={continues ? yBottom : yCenter}
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
              );
            })}
            {row.mergeLanes.map((mergeLane) => {
              const xFrom = laneCenterX(mergeLane, row.laneCount, gutterWidth);
              const xTo = laneCenterX(row.lane, row.laneCount, gutterWidth);
              if (xFrom === xTo) {
                return null;
              }
              const midY = yCenter;
              return (
                <path
                  key={`${row.commit.oid}-merge-${mergeLane}`}
                  d={`M ${xFrom} ${yTop} L ${xFrom} ${midY} L ${xTo} ${midY} L ${xTo} ${yCenter}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
              );
            })}
            <circle
              cx={laneCenterX(row.lane, row.laneCount, gutterWidth)}
              cy={yCenter}
              r={4}
              className="fill-foreground stroke-background"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CommitGraphRow({
  row,
  expanded,
  onToggle,
}: {
  row: GitCommitGraphRow;
  expanded: boolean;
  onToggle(): void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const shortOid = row.commit.oid.slice(0, 7);

  const copySha = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(row.commit.oid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [row.commit.oid]);

  return (
    <div className="border-b border-border/20 last:border-b-0">
      <button
        type="button"
        className="flex w-full min-w-0 items-start gap-1 py-1 pr-2 text-left hover:bg-muted/30"
        style={{ minHeight: ROW_HEIGHT_PX }}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="mt-1 shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-xs leading-snug text-foreground">{row.commit.subject}</span>
          {row.commit.refs.length > 0 ? (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {row.commit.refs.map((ref) => (
                <span
                  key={`${row.commit.oid}:${ref}`}
                  className="rounded bg-primary/15 px-1 py-0 font-mono text-[10px] text-primary"
                >
                  {ref}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="space-y-1.5 pb-2 pl-6 pr-2 text-[11px] text-muted-foreground">
          <p>
            <span className="text-foreground/70">{row.commit.author}</span>
            {" · "}
            <span>{row.commit.authoredAt}</span>
          </p>
          <div className="flex items-center gap-2 font-mono">
            <span className="truncate" title={row.commit.oid}>
              {shortOid}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => void copySha()}
              aria-label={t("workspace.git.copySha")}
            >
              <Copy className="size-3" aria-hidden />
            </Button>
            {copied ? <span className="text-[10px] text-foreground">{t("workspace.git.copiedSha")}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GitCommitGraph({ history, loading, error, className }: GitCommitGraphProps) {
  const { t } = useTranslation();
  const [expandedOids, setExpandedOids] = useState<Record<string, boolean>>({});

  const rows = history?.rows ?? [];
  const gutterWidth = useMemo(() => {
    const maxLanes = rows.reduce((max, row) => Math.max(max, row.laneCount), 1);
    return Math.max(GRAPH_GUTTER_MIN_PX, maxLanes * 16 + 12);
  }, [rows]);

  const toggleExpanded = useCallback((oid: string) => {
    setExpandedOids((current) => ({
      ...current,
      [oid]: !current[oid],
    }));
  }, []);

  if (loading) {
    return (
      <div className={cn("flex flex-1 items-center justify-center gap-2 p-4 text-xs text-muted-foreground", className)}>
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        {t("workspace.git.loadingHistory")}
      </div>
    );
  }

  if (history && !history.isRepository) {
    return (
      <p className={cn("p-3 text-xs text-muted-foreground", className)}>{t("workspace.git.noRepo")}</p>
    );
  }

  if (error) {
    return <p className={cn("p-3 text-xs text-destructive", className)}>{error}</p>;
  }

  if (rows.length === 0) {
    return <p className={cn("p-3 text-xs text-muted-foreground", className)}>{t("workspace.git.noHistory")}</p>;
  }

  return (
    <ScrollArea className={cn("min-h-0 flex-1", className)}>
      <div className="flex min-w-0">
        <CommitGraphGutter rows={rows} gutterWidth={gutterWidth} />
        <div className="min-w-0 flex-1">
          {rows.map((row) => (
            <CommitGraphRow
              key={row.commit.oid}
              row={row}
              expanded={expandedOids[row.commit.oid] === true}
              onToggle={() => toggleExpanded(row.commit.oid)}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
