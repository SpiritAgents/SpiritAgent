import type { ComponentProps, ReactNode } from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DESKTOP_OVERLAY_LIST_ITEM } from "@/lib/desktop-chrome";
import { cn } from "@/lib/utils";

type ComposerSuggestionMenuItemProps = {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
} & Pick<
  ComponentProps<typeof DropdownMenuItem>,
  "onMouseDown" | "onMouseEnter" | "onFocus" | "title" | "onPointerMove"
> & {
  "data-skill-slash-index"?: number;
  "data-workspace-file-reference-index"?: number;
};

export function ComposerSuggestionMenuItem({
  selected = false,
  children,
  className,
  onClick,
  onPointerMove,
  ...props
}: ComposerSuggestionMenuItemProps & { className?: string }) {
  return (
    <DropdownMenuItem
      className={cn(
        "items-start",
        DESKTOP_OVERLAY_LIST_ITEM,
        "hover:bg-accent hover:text-accent-foreground",
        selected && "bg-accent text-accent-foreground",
        className,
      )}
      onSelect={(event) => {
        event.preventDefault();
        onClick?.();
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        // Radix MenuItem 在 pointermove 未 preventDefault 时会 item.focus()；建议菜单焦点须留在 Composer
        event.preventDefault();
      }}
      {...props}
    >
      {children}
    </DropdownMenuItem>
  );
}
