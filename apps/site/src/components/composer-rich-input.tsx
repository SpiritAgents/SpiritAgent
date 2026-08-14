import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { Textarea } from "@/components/ui/textarea";
import { BrowserElementChip } from "@/components/browser-element-chip";
import {
  isNestedDesktopPreview,
  useDesktopPreviewDensity,
} from "@/contexts/desktop-preview-density-context";
import type { DesktopAgentMode } from "@/lib/agent-mode";
import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import { cn } from "@/lib/utils";

export type RichSegment = { kind: "text"; value: string };

export type ComposerRichInputHandle = {
  focus(): void;
};

type ComposerRichInputProps = {
  value: string;
  placeholder: string;
  readOnly?: boolean;
  className?: string;
  loopEnabled?: boolean;
  loopChipLabel?: string;
  agentMode?: DesktopAgentMode;
  planChipLabel?: string;
  askChipLabel?: string;
  elementAttachments?: readonly BrowserElementAttachment[];
  initialSegments?: readonly RichSegment[] | null;
  onTextChange(value: string): void;
  onElementAttachmentsChange?(attachments: BrowserElementAttachment[]): void;
  onLoopEnabledChange?(enabled: boolean): void;
  onAgentModeChange?(mode: DesktopAgentMode): void;
  onKeyDown?(event: ReactKeyboardEvent<HTMLTextAreaElement>): void;
  onPaste?(event: ReactClipboardEvent<HTMLTextAreaElement>): void;
  onSelectionChange?(selectionStart: number | null): void;
  conversationBusy?: boolean;
  agentModeChipDismissed?: boolean;
  onAgentModeChipDismissChange?(dismissed: boolean): void;
};

const COMPOSER_TEXTAREA_CLASS =
  "spirit-scroll block w-full resize-none overflow-y-auto rounded-none border-0 bg-transparent leading-relaxed shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none dark:bg-transparent dark:disabled:bg-transparent";

const COMPOSER_TEXTAREA_SIZE_CLASS = {
  default: "max-h-[12rem] min-h-[3rem] px-3 pt-3 pb-1.5 md:min-h-[3.5rem]",
  nested: "max-h-[5rem] min-h-[2rem] px-2.5 pt-2 pb-1 md:min-h-[2.25rem]",
} as const;

const COMPOSER_CHIP_INSET_CLASS = {
  default: "left-3 top-3",
  nested: "left-2.5 top-2",
} as const;

const COMPOSER_TEXTAREA_TEXT_CLASS = {
  default: "text-sm",
  nested: "text-xs",
} as const;

export const ComposerRichInput = forwardRef<ComposerRichInputHandle, ComposerRichInputProps>(
  function ComposerRichInput(
    {
      value,
      placeholder,
      readOnly,
      className,
      elementAttachments,
      onTextChange,
      onKeyDown,
      onPaste,
      onSelectionChange,
    },
    ref,
  ) {
    const previewDensity = useDesktopPreviewDensity();
    const nestedPreview = isNestedDesktopPreview(previewDensity);
    const chipMeasureRef = useRef<HTMLDivElement>(null);
    const [chipTextIndentPx, setChipTextIndentPx] = useState(0);
    const hasElementAttachments = Boolean(elementAttachments?.length);

    useImperativeHandle(ref, () => ({
      focus() {
        // Preview stub.
      },
    }));

    useLayoutEffect(() => {
      if (!hasElementAttachments) {
        setChipTextIndentPx(0);
        return;
      }

      const measure = () => {
        const width = chipMeasureRef.current?.offsetWidth ?? 0;
        setChipTextIndentPx(width > 0 ? width + 2 : 0);
      };

      measure();
      const chips = chipMeasureRef.current;
      if (!chips) {
        return;
      }

      const observer = new ResizeObserver(measure);
      observer.observe(chips);
      return () => observer.disconnect();
    }, [elementAttachments, hasElementAttachments, nestedPreview]);

    const insetClass = nestedPreview
      ? COMPOSER_CHIP_INSET_CLASS.nested
      : COMPOSER_CHIP_INSET_CLASS.default;

    return (
      <div className="relative">
        {hasElementAttachments ? (
          <div
            ref={chipMeasureRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-0.5",
              insetClass,
            )}
          >
            {elementAttachments?.map((attachment) => (
              <BrowserElementChip key={attachment.id} attachment={attachment} />
            ))}
          </div>
        ) : null}
        {hasElementAttachments && !value && placeholder ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-0 text-muted-foreground select-none",
              nestedPreview ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
              insetClass,
            )}
            style={{ marginLeft: chipTextIndentPx }}
          >
            {placeholder}
          </span>
        ) : null}
        <Textarea
          value={value}
          onChange={(event) => onTextChange(event.target.value)}
          disabled={readOnly}
          placeholder={hasElementAttachments ? undefined : placeholder}
          style={chipTextIndentPx > 0 ? { textIndent: chipTextIndentPx } : undefined}
          className={cn(
            COMPOSER_TEXTAREA_CLASS,
            nestedPreview
              ? COMPOSER_TEXTAREA_SIZE_CLASS.nested
              : COMPOSER_TEXTAREA_SIZE_CLASS.default,
            nestedPreview
              ? COMPOSER_TEXTAREA_TEXT_CLASS.nested
              : COMPOSER_TEXTAREA_TEXT_CLASS.default,
            className,
          )}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onSelect={(event) => onSelectionChange?.(event.currentTarget.selectionStart)}
        />
      </div>
    );
  },
);
