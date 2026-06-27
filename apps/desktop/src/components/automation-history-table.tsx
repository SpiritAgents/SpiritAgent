import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DESKTOP_INSTANT_HOVER_OVERLAY } from "@/lib/desktop-chrome";
import { cn } from "@/lib/utils";
import type { DesktopAutomationRun, DesktopAutomationRunStatus } from "@/types";

type AutomationHistoryTableProps = {
  runs: DesktopAutomationRun[];
  onOpenSession(sessionPath: string): void;
};

const columnHelper = createColumnHelper<DesktopAutomationRun>();

function runStatusBadgeVariant(status: DesktopAutomationRunStatus) {
  if (status === "blocked") {
    return "outline" as const;
  }
  if (status === "failed") {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function runStatusLabelKey(status: DesktopAutomationRunStatus) {
  return `automations.runStatus.${status}` as const;
}

export function AutomationHistoryTable({ runs, onOpenSession }: AutomationHistoryTableProps) {
  const { t, i18n } = useTranslation();

  const sortedRuns = useMemo(
    () => [...runs].sort((left, right) => right.startedAtUnixMs - left.startedAtUnixMs),
    [runs],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("startedAtUnixMs", {
        id: "time",
        header: () => t("automations.historyColumnTime"),
        cell: ({ getValue }) =>
          new Date(getValue()).toLocaleString(i18n.language, { hour12: false }),
      }),
      columnHelper.accessor("status", {
        id: "status",
        header: () => t("automations.historyColumnStatus"),
        cell: ({ getValue }) => (
          <Badge variant={runStatusBadgeVariant(getValue())} className="text-[11px]">
            {t(runStatusLabelKey(getValue()))}
          </Badge>
        ),
      }),
    ],
    [i18n.language, t],
  );

  const table = useReactTable({
    data: sortedRuns,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  if (sortedRuns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t("automations.noRuns")}</p>
    );
  }

  return (
    <Table>
      <TableHeader className="sr-only">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={cn(header.column.id === "status" && "text-right")}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className={cn(
              "cursor-pointer border-border/40 transition-none hover:bg-transparent",
              DESKTOP_INSTANT_HOVER_OVERLAY,
            )}
            onClick={() => onOpenSession(row.original.sessionPath)}
            title={t("automations.openSession")}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cn(cell.column.id === "status" && "text-right")}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
