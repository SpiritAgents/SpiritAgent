import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";

const { window } = parseHTML("<!doctype html><html><body></body></html>");
globalThis.Node = window.Node;
globalThis.HTMLElement = window.HTMLElement;
globalThis.document = window.document;
if (typeof window.getSelection === "function") {
  globalThis.getSelection = window.getSelection.bind(window);
}
if (typeof globalThis.MutationObserver === "undefined") {
  globalThis.MutationObserver = class MutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

const { createComposerLexicalEditor, richSegmentsToEditorState } =
  await import("../../src/lib/composer-lexical/bridge/index.ts");
const {
  caretAtEnd,
  caretToPlainTextOffset,
  insertSegmentAtCaret,
  segmentsToPlainText,
} = await import("../../src/lib/composer-segment-model.ts");
const {
  lexicalSelectionToPlainTextOffset,
  lexicalSelectionToSegmentCaret,
  segmentCaretToLexicalSelection,
} = await import("../../src/lib/composer-lexical/caret.ts");

const multilineSegments = [
  {
    kind: "text",
    value:
      "滚滚长江东逝水\n长江黄河还有黑龙江\n男人女人还有变性人\n这里我准备引用一句话，光标就在这里：",
  },
];

test("lexical caret roundtrips multiline plain-text offset", () => {
  const editor = createComposerLexicalEditor();
  richSegmentsToEditorState(multilineSegments, editor);
  const endCaret = caretAtEnd(multilineSegments);
  segmentCaretToLexicalSelection(editor, multilineSegments, endCaret);

  const plainOffset = lexicalSelectionToPlainTextOffset(editor);
  const caret = lexicalSelectionToSegmentCaret(editor, multilineSegments);
  assert.equal(plainOffset, segmentsToPlainText(multilineSegments).length);
  assert.equal(caretToPlainTextOffset(multilineSegments, caret), plainOffset);
});

test("insertSegmentAtCaret uses segment-model caret after multiline end selection", () => {
  const editor = createComposerLexicalEditor();
  richSegmentsToEditorState(multilineSegments, editor);
  segmentCaretToLexicalSelection(editor, multilineSegments, caretAtEnd(multilineSegments));

  const caret = lexicalSelectionToSegmentCaret(editor, multilineSegments);
  assert.ok(caret);
  const { segments } = insertSegmentAtCaret(multilineSegments, caret, {
    kind: "fileSnippet",
    attachment: {
      id: "snip-1",
      filePath: "README.md",
      lineStart: 1,
      lineEnd: 1,
      selectedText: "quote",
    },
  });
  const chipIndex = segments.findIndex((segment) => segment.kind === "fileSnippet");
  assert.ok(chipIndex >= 0);
  const textBeforeChip = segmentsToPlainText(segments.slice(0, chipIndex));
  assert.ok(textBeforeChip.endsWith("光标就在这里："));
  assert.equal(textBeforeChip.includes("长江黄河还有黑龙江\n[file:"), false);
});
