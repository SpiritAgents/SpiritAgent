import { useMemo, useState } from "react";

import { ChevronRight } from "lucide-react";

import {
  parseShellCommand,
  shellExpandableDetailLines,
  shellHasExpandableContent,
} from "@/lib/shell-tool-display";
import { cn } from "@/lib/utils";
import type { ToolBlockSnapshot } from "@/types";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const shellSummaryClass = "text-xs leading-relaxed text-muted-foreground";

function ShellCommandSummary({
  headline,
  command,
}: {
  headline: string;
  command: string | undefined;
}) {
  return (
    <span className={cn(shellSummaryClass, "min-w-0 break-words")}>
      {headline}
      {command ? (
        <>
          {" "}
          <span className="text-muted-foreground/45">{command}</span>
        </>
      ) : null}
    </span>
  );
}

function ShellCommandExpandedBody({
  tool,
  command,
}: {
  tool: ToolBlockSnapshot;
  command: string | undefined;
}) {
  const detailLines = shellExpandableDetailLines(tool, command);
  const showArgsExcerpt = !command && Boolean(tool.argsExcerpt?.trim());

  return (
    <div className="space-y-2">
      {tool.outputExcerpt ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border/20 bg-muted/15 p-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {tool.outputExcerpt}
        </pre>
      ) : null}
      {detailLines.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-3.5 text-xs leading-relaxed text-muted-foreground">
          {detailLines.map((line, index) => (
            <li key={`${index}:${line}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      {showArgsExcerpt ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border/20 bg-muted/15 p-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {tool.argsExcerpt}
        </pre>
      ) : null}
    </div>
  );
}

export function ShellCommandToolCard({ tool }: { tool: ToolBlockSnapshot }) {
  const command = useMemo(
    () => parseShellCommand(tool),
    [tool.argsExcerpt, tool.detailLines],
  );
  const expandable = shellHasExpandableContent(tool, command);
  const [open, setOpen] = useState(false);

  if (!expandable) {
    return (
      <p className={shellSummaryClass}>
        {tool.headline}
        {command ? (
          <>
            {" "}
            <span className="text-muted-foreground/45">{command}</span>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full min-w-0 items-center gap-1 text-left outline-none",
            "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          <ShellCommandSummary headline={tool.headline} command={command} />
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/55 transition-all duration-150",
              "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              open && "rotate-90",
            )}
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0">
        <div className="pt-1.5">
          <ShellCommandExpandedBody tool={tool} command={command} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
