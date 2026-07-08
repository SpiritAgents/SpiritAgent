import { useEffect, type ClipboardEvent, type RefObject } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COPY_COMMAND, PASTE_COMMAND, COMMAND_PRIORITY_EDITOR } from "lexical";

import { lexicalSelectionToSegmentCaret } from "@/lib/composer-lexical/caret";
import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import {
  caretAtEnd,
  insertSegmentAtCaret,
  type RichSegment,
  type SegmentCaret,
} from "@/lib/composer-segment-model";
import type { ComposerSegmentsCommitFn } from "@/lib/composer-lexical/plugins/composer-commands-plugin";

const ELEMENT_MIME = "application/x-spirit-elements";

type ComposerClipboardPluginProps = {
  segmentsRef: React.MutableRefObject<RichSegment[]>;
  commitSegments: ComposerSegmentsCommitFn;
  contentEditableRef: RefObject<HTMLDivElement | null>;
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void;
};

export function ComposerClipboardPlugin({
  segmentsRef,
  commitSegments,
  contentEditableRef,
  onPaste,
}: ComposerClipboardPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const unregisterCopy = editor.registerCommand(
      COPY_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) {
          return false;
        }
        const clipboardEvent = event;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          return false;
        }
        const range = sel.getRangeAt(0);
        const frag = range.cloneContents();
        const chips: Record<string, BrowserElementAttachment> = {};
        frag.querySelectorAll("[data-element-chip]").forEach((el) => {
          const span = el as HTMLElement;
          const id = span.dataset.elementId ?? "";
          chips[id] = {
            id,
            tagName: span.dataset.elementTag ?? "",
            outerHtml: span.dataset.elementHtml ?? "",
            screenshotDataUrl: "",
            pageUrl: span.dataset.elementUrl ?? "",
          };
        });
        if (Object.keys(chips).length === 0) {
          return false;
        }
        clipboardEvent.preventDefault();
        const textDiv = document.createElement("div");
        textDiv.appendChild(frag.cloneNode(true));
        clipboardEvent.clipboardData?.setData("text/plain", textDiv.innerText);
        clipboardEvent.clipboardData?.setData(ELEMENT_MIME, JSON.stringify(chips));
        clipboardEvent.clipboardData?.setData("text/html", textDiv.innerHTML);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterPaste = editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) {
          return false;
        }
        const clipboardEvent = event;
        if (onPaste) {
          onPaste(clipboardEvent as unknown as ClipboardEvent<HTMLDivElement>);
        }
        if (clipboardEvent.defaultPrevented) {
          return true;
        }

        const raw = clipboardEvent.clipboardData?.getData(ELEMENT_MIME);
        if (raw) {
          clipboardEvent.preventDefault();
          try {
            const chips: Record<string, BrowserElementAttachment> = JSON.parse(raw);
            const html = clipboardEvent.clipboardData?.getData("text/html") ?? "";
            const parser = new DOMParser();
            const parsed = parser.parseFromString(html, "text/html");

            const pasteSegs: RichSegment[] = [];
            parsed.body.childNodes.forEach((node) => {
              if (node.nodeType === Node.COMMENT_NODE) return;
              if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent ?? "";
                if (text) pasteSegs.push({ kind: "text", value: text });
                return;
              }
              if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.dataset?.elementChip === "true") {
                  const id = el.dataset.elementId ?? "";
                  if (chips[id]) {
                    pasteSegs.push({ kind: "element", attachment: chips[id] });
                  }
                } else if (el.tagName === "BR") {
                  mergeTextIntoPaste(pasteSegs, "\n");
                } else if (el.tagName === "DIV" || el.tagName === "P") {
                  el.childNodes.forEach((child) => {
                    if (child.nodeType === Node.TEXT_NODE && child.textContent) {
                      pasteSegs.push({ kind: "text", value: child.textContent });
                    }
                  });
                }
              }
            });

            const caret = lexicalSelectionToSegmentCaret(editor) ?? { segmentIndex: 0, offset: 0 };
            let next = segmentsRef.current;
            let nextCaret: SegmentCaret = caret;
            for (const seg of pasteSegs) {
              const result = insertSegmentAtCaret(next, nextCaret, seg);
              next = result.segments;
              nextCaret = result.caret;
            }
            commitSegments(next, nextCaret);
          } catch {
            return false;
          }
          return true;
        }

        const plain = clipboardEvent.clipboardData?.getData("text/plain");
        if (!plain) {
          return false;
        }
        clipboardEvent.preventDefault();
        const caret = lexicalSelectionToSegmentCaret(editor) ?? caretAtEnd(segmentsRef.current);
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(
          segmentsRef.current,
          caret,
          { kind: "text", value: plain },
        );
        commitSegments(next, nextCaret);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      unregisterCopy();
      unregisterPaste();
    };
  }, [commitSegments, contentEditableRef, editor, onPaste, segmentsRef]);

  return null;
}

function mergeTextIntoPaste(segs: RichSegment[], chunk: string): void {
  const last = segs[segs.length - 1];
  if (last?.kind === "text") {
    last.value += chunk;
  } else {
    segs.push({ kind: "text", value: chunk });
  }
}
