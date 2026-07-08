import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChipShellProps = {
  className?: string;
  title?: string;
  "aria-label"?: string;
  "data-chip-kind"?: string;
  "data-element-chip"?: string;
  "data-element-id"?: string;
  "data-element-tag"?: string;
  "data-element-html"?: string;
  "data-element-url"?: string;
  children: ReactNode;
};

export function ChipShell({
  className,
  title,
  "aria-label": ariaLabel,
  "data-chip-kind": chipKind,
  "data-element-chip": elementChip,
  "data-element-id": elementId,
  "data-element-tag": elementTag,
  "data-element-html": elementHtml,
  "data-element-url": elementUrl,
  children,
}: ChipShellProps) {
  return (
    <span
      contentEditable={false}
      data-spirit-chip="true"
      data-chip-kind={chipKind}
      data-element-chip={elementChip}
      data-element-id={elementId}
      data-element-tag={elementTag}
      data-element-html={elementHtml}
      data-element-url={elementUrl}
      className={cn("select-none", className)}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}

export function ChipIconSvg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}
