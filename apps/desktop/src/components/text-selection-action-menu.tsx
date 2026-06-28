import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SelectionAnchorRect } from "@/hooks/use-text-selection-action-menu";
import { scaleRootFixedAnchorStyle } from "@/lib/scale-root-fixed-anchor-style";

type TextSelectionActionMenuProps = {
  open: boolean;
  anchor: SelectionAnchorRect | null;
  onOpenChange(open: boolean): void;
  children: ReactNode;
};

export function TextSelectionActionMenu({
  open,
  anchor,
  onOpenChange,
  children,
}: TextSelectionActionMenuProps) {
  if (!anchor) {
    return null;
  }

  const triggerStyle = scaleRootFixedAnchorStyle({
    left: anchor.x,
    top: anchor.y,
    width: anchor.width,
    height: anchor.height,
  });

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          style={triggerStyle}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TextSelectionActionMenuItemProps = {
  label: string;
  onSelect(): void;
};

export function TextSelectionActionMenuItem({
  label,
  onSelect,
}: TextSelectionActionMenuItemProps) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      onMouseDown={(event) => event.preventDefault()}
    >
      {label}
    </DropdownMenuItem>
  );
}
