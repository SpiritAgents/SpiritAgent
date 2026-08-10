import { useEffect, type ClipboardEvent } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { PASTE_COMMAND, COMMAND_PRIORITY_HIGH } from "lexical";

import { lexicalSelectionToSegmentCaret } from "@/lib/composer-lexical/caret";
import { caretAtEnd, insertSegmentAtCaret, type RichSegment } from "@/lib/composer-segment-model";
import type { ComposerSegmentsCommitFn } from "@/lib/composer-lexical/plugins/composer-commands-plugin";

const LEXICAL_JSON_MIME = "application/x-lexical-editor";

type ComposerClipboardPluginProps = {
  segmentsRef: React.MutableRefObject<RichSegment[]>;
  commitSegments: ComposerSegmentsCommitFn;
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void;
};

/**
 * 复制不拦截：交给 Lexical 默认管线（text/plain 走 SpiritChipNode.getTextContent 的
 * canonical 文本、text/html 走 exportDOM、并附 application/x-lexical-editor JSON）。
 * 粘贴只在「带 Lexical JSON」时放行给 RichTextPlugin 原生恢复 chip 节点（payload 全量
 * 保留）；其余按纯文本走 segment 模型插入。
 */
export function ComposerClipboardPlugin({
  segmentsRef,
  commitSegments,
  onPaste,
}: ComposerClipboardPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // RichTextPlugin 同为 EDITOR 且先注册；同优先级先返回 true 会短路，宿主贴图 onPaste 永远进不去
    return editor.registerCommand(
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

        if (clipboardEvent.clipboardData?.getData(LEXICAL_JSON_MIME)) {
          return false;
        }

        const plain = clipboardEvent.clipboardData?.getData("text/plain");
        if (!plain) {
          return false;
        }
        clipboardEvent.preventDefault();
        const caret =
          lexicalSelectionToSegmentCaret(editor, segmentsRef.current) ??
          caretAtEnd(segmentsRef.current);
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(
          segmentsRef.current,
          caret,
          { kind: "text", value: plain },
        );
        commitSegments(next, nextCaret);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [commitSegments, editor, onPaste, segmentsRef]);

  return null;
}
