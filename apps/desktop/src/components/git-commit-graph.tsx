import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Copy, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GitCommitGraphRow, GitHistorySnapshot } from "@/types";

const ROW_HEIGHT_PX = 32;
const LANE_WIDTH_PX = 12;
const GUTTER_LEADING_PX = 4;
const NODE_RADIUS_PX = 4;
/** Gap between the rightmost graph element and commit subject text. */
const TEXT_GAP_PX = 4;

function laneCenterX(lane: number): number {
  return GUTTER_LEADING_PX + lane * LANE_WIDTH_PX + LANE_WIDTH_PX / 2;
}

function activeLanesForRow(row: GitCommitGraphRow): number[] {
  const set = new Set<number>([row.lane, ...row.passingLanes, ...row.mergeLanes]);
  return [...set].sort((a, b) => a - b);
}

/** Left padding for commit text: immediately after this row's rightmost lane/dot. */
function rowTextInsetPx(row: GitCommitGraphRow): number {
  const maxLane = activeLanesForRow(row).reduce((max, lane) => Math.max(max, lane), row.lane);
  return Math.ceil(laneCenterX(maxLane) + NODE_RADIUS_PX + TEXT_GAP_PX);
}

/** SVG width: must cover all lanes drawn anywhere in the graph. */
function computeGraphWidth(rows: readonly GitCommitGraphRow[]): number {
  return rows.reduce((max, row) => Math.max(max, rowTextInsetPx(row)), 0);
}

export type GitCommitGraphProps = {
  history: GitHistorySnapshot | null;
  loading: boolean;
  error?: string;
  className?: string;
};

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
  graphWidth,
}: {
  rows: GitCommitGraphRow[];
  graphWidth: number;
}) {
  const height = rows.length * ROW_HEIGHT_PX;

  return (
    <svg
      width={graphWidth}
      height={height}
      className="pointer-events-none absolute left-0 top-0 shrink-0 text-muted-foreground/70"
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
              const x = laneCenterX(lane);
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
              const xFrom = laneCenterX(mergeLane);
              const xTo = laneCenterX(row.lane);
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
              cx={laneCenterX(row.lane)}
              cy={yCenter}
              r={NODE_RADIUS_PX}
              className="fill-foreground stroke-background"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CommitGraphRow({ row }: { row: GitCommitGraphRow }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shortOid = row.commit.oid.slice(0, 7);
  const textInset = rowTextInsetPx(row);

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
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className="relative min-w-0 border-b border-border/20 last:border-b-0"
        style={{ minHeight: ROW_HEIGHT_PX, paddingLeft: textInset }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full min-w-0 items-start py-1 pr-2 text-left hover:bg-muted/30"
          >
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
        </PopoverTrigger>
      </div>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="w-72 p-3"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium leading-snug text-foreground">{row.commit.subject}</p>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-foreground/80">{row.commit.author}</span>
            {" · "}
            <span>{row.commit.authoredAt}</span>
          </p>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
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
      </PopoverContent>
    </Popover>
  );
}

export function GitCommitGraph({ history, loading, error, className }: GitCommitGraphProps) {
  const { t } = useTranslation();

  const rows = history?.rows ?? [];
  const graphWidth = useMemo(() => computeGraphWidth(rows), [rows]);

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
      <div className="relative min-w-0 pr-1">
        <CommitGraphGutter rows={rows} graphWidth={graphWidth} />
        <div className="relative">
          {rows.map((row) => (
            <CommitGraphRow key={row.commit.oid} row={row} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
