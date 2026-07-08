import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { LexicalEditor } from "lexical";

import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import type { PrDiffAttachment } from "@/lib/pr-diff-attachment";
import type { GitCommitAttachment } from "@/lib/git-commit-attachment";
import type { FileSnippetAttachment } from "@/lib/file-snippet-attachment";
import type { TerminalSnippetAttachment } from "@/lib/terminal-snippet-attachment";
import { hasInlineAttachmentChipSegments } from "@/lib/composer-inline-chip-dom";
import type { DesktopAgentMode } from "@/lib/agent-mode";
import {
  caretAtEnd,
  caretToPlainTextOffset,
  replaceSkillSlashQueryInSegments,
  replaceWorkspaceFileReferenceInSegments,
  normalizeWorkspaceFilePath,
  type ActiveSkillSlashQuery,
  type ActiveWorkspaceFileReferenceQuery,
} from "@/lib/composer-segment-model";
import {
  applyAgentModeChipPolicy,
  buildSegmentsAfterSend,
  composerShowsAgentModeChipPlaceholder,
  composerShowsPlaceholder,
  shouldPinAgentModeChip,
  type AgentModeChipPolicy,
} from "@/lib/composer-agent-mode-policy";
import type { AgentModeChipKind } from "@/lib/composer-agent-mode-segments";
import {
  emptySegments,
  caretAfterAgentModeChip,
  ensureLoopChipTypingTail,
  ensureLoopPinned,
  hasAgentModeSegment,
  hasLoopSegment,
  hasSkillSegment,
  insertAgentModeSegment,
  insertLoopSegment,
  insertSegmentAtCaret,
  isAgentModeChipKind,
  isCaretAtAgentModeRemovalPoint,
  isCaretAtInlineChipRemovalPoint,
  isCaretAtLoopRemovalPoint,
  isComposerPlainEmpty,
  mergeAdjacentTextSegments,
  normalizeCaretForComposer,
  normalizeComposerPlain,
  removeInlineChipAtRemovalPoint,
  removeAgentModeSegment,
  removeLoopSegment,
  segmentsEqual,
  segmentsToAttachments,
  segmentsToPlainText,
  syncSegmentsFromExternalValue,
  type RichSegment,
  type SegmentCaret,
} from "@/lib/composer-segments";
import { COMPOSER_LEXICAL_NODES } from "@/lib/composer-lexical/composer-lexical-config";
import { ComposerChipLabelsProvider } from "@/lib/composer-lexical/chip-labels-context";
import {
  editorStateToRichSegments,
  richSegmentsToEditorState,
} from "@/lib/composer-lexical/bridge";
import {
  focusComposerAtEnd,
  lexicalSelectionToSegmentCaret,
  segmentCaretToLexicalSelection,
} from "@/lib/composer-lexical/caret";
import { ComposerOnChangePlugin } from "@/lib/composer-lexical/plugins/composer-on-change-plugin";
import { ComposerSegmentsHydratePlugin } from "@/lib/composer-lexical/plugins/composer-segments-hydrate-plugin";
import { cn } from "@/lib/utils";

export type { ActiveWorkspaceFileReferenceQuery } from "@/lib/composer-segment-model";
export type { RichSegment } from "@/lib/composer-segment-model";
export {
  segmentsToAttachments,
  segmentsToMessageText,
  segmentsToPlainText,
} from "@/lib/composer-segment-model";

const COMPOSER_PLACEHOLDER_CLASS =
  "pointer-events-none absolute top-2.5 text-sm leading-relaxed text-muted-foreground select-none";

const AGENT_MODE_CHIP_SELECTOR =
  "[data-chip-kind='plan'],[data-chip-kind='ask'],[data-chip-kind='debug']";

const ELEMENT_MIME = "application/x-spirit-elements";

type Props = {
  value: string;
  elementAttachments?: readonly BrowserElementAttachment[];
  /** One-shot hydrate (e.g. message rewind); ignored after first apply per mount. */
  initialSegments?: readonly RichSegment[] | null;
  placeholder?: string;
  agentModeChipPlaceholder?: string;
  readOnly?: boolean;
  className?: string;
  loopEnabled?: boolean;
  loopChipLabel?: string;
  agentMode?: DesktopAgentMode;
  planChipLabel?: string;
  askChipLabel?: string;
  onTextChange(text: string): void;
  onElementAttachmentsChange(attachments: BrowserElementAttachment[]): void;
  /** Rich segments committed locally; plain text / cursor may be unchanged. */
  onSegmentsCommit?(): void;
  onLoopEnabledChange?(enabled: boolean): void;
  onAgentModeChange?(mode: DesktopAgentMode): void;
  onKeyDown?(e: KeyboardEvent<HTMLDivElement>): void;
  onPaste?(e: ClipboardEvent<HTMLDivElement>): void;
  /** UTF-16 offset in plain composer text (`segmentsToPlainText`), for @-file suggestions. */
  onSelectionChange?(selectionStart: number | null): void;
  /** Agent 正在输出时，阻止父级滞后 value 覆盖本地 segments（poll 重渲染）。 */
  conversationBusy?: boolean;
  /** Session 级：用户 Backspace 去掉 Plan/Ask chip 后，poll 不得再通过 DOM 钉回。 */
  agentModeChipDismissed?: boolean;
  onAgentModeChipDismissChange?(dismissed: boolean): void;
};

export type InsertLoopChipOptions = {
  /** Drop existing composer text; use after /loop or post-send reset. */
  clearText?: boolean;
};

export type InsertAgentModeChipOptions = InsertLoopChipOptions;

export type InsertSkillChipOptions = {
  /** Drop existing composer text; use when prefilling from settings or similar. */
  clearText?: boolean;
  /** Append a trailing space after the chip for natural-language follow-up. */
  appendTrailingSpace?: boolean;
};

export type ComposerRichInputHandle = {
  focus(): void;
  focusAtEnd(): void;
  insertAttachment(a: BrowserElementAttachment): void;
  insertPrDiffAttachment(attachment: PrDiffAttachment): void;
  insertGitCommitAttachment(attachment: GitCommitAttachment): void;
  insertTerminalSnippet(attachment: TerminalSnippetAttachment): void;
  insertFileSnippet(attachment: FileSnippetAttachment): void;
  insertWorkspaceFileReference(
    path: string,
    query: ActiveWorkspaceFileReferenceQuery,
    finalize?: boolean,
  ): void;
  insertWorkspaceFileAtCaret(path: string): void;
  insertLoopChip(options?: InsertLoopChipOptions): void;
  removeLoopChip(): void;
  insertPlanChip(options?: InsertAgentModeChipOptions): void;
  insertAskChip(options?: InsertAgentModeChipOptions): void;
  insertDebugChip(options?: InsertAgentModeChipOptions): void;
  removeAgentModeChip(): void;
  insertSkillChip(alias: string, options?: InsertSkillChipOptions): void;
  replaceSkillSlashQuery(
    query: ActiveSkillSlashQuery,
    replacement: string,
    finalize?: boolean,
  ): void;
  removeSkillSlashQuery(query: ActiveSkillSlashQuery): void;
  insertPlainTextAtCaret(text: string): void;
  /** 发送成功后由宿主调用：恢复 chip（若仍为 plan/ask）并将光标置于 chip 后。 */
  resetAfterSend(agentMode: DesktopAgentMode): void;
  getSegments(): RichSegment[];
  setSegments(segments: RichSegment[]): void;
  getPlainTextCaretClientRect(plainTextOffset: number): DOMRect | null;
};

type ComposerLexicalInputCoreProps = Props & {
  editorRef: React.RefObject<LexicalEditor | null>;
  skipEditorSyncRef: React.RefObject<boolean>;
  mountHydratedRef: React.RefObject<boolean>;
};

const ComposerLexicalInputCore = forwardRef<ComposerRichInputHandle, ComposerLexicalInputCoreProps>(
  function ComposerLexicalInputCore(props, ref) {
    const {
      value,
      elementAttachments,
      initialSegments,
      placeholder,
      agentModeChipPlaceholder,
      readOnly,
      className,
      loopEnabled = false,
      loopChipLabel = "Loop",
      agentMode = "agent",
      planChipLabel = "Plan",
      askChipLabel = "Ask",
      onTextChange,
      onElementAttachmentsChange,
      onSegmentsCommit,
      onLoopEnabledChange,
      onAgentModeChange,
      onKeyDown,
      onPaste,
      onSelectionChange,
      conversationBusy = false,
      agentModeChipDismissed = false,
      onAgentModeChipDismissChange,
      editorRef,
      skipEditorSyncRef,
      mountHydratedRef,
    } = props;

    const [editor] = useLexicalComposerContext();
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const shellRef = useRef<HTMLDivElement>(null);
    const [segments, setSegments] = useState<RichSegment[]>(() => {
      const base = initialSegments?.length
        ? ensureLoopPinned(mergeAdjacentTextSegments([...initialSegments]))
        : loopEnabled
          ? insertLoopSegment(emptySegments()).segments
          : emptySegments();
      return applyAgentModeChipPolicy(base, { hostMode: agentMode, dismissed: false });
    });
    const segmentsRef = useRef(segments);
    segmentsRef.current = segments;
    const isComposingRef = useRef(false);
    const [isComposing, setIsComposing] = useState(false);
    const [agentModeChipPlaceholderLeft, setAgentModeChipPlaceholderLeft] = useState<number | null>(
      null,
    );
    const pendingCaretRef = useRef<SegmentCaret | null>(null);
    const skipExternalValueSyncRef = useRef(Boolean(initialSegments?.length));
    const lastSyncedToParentPlainRef = useRef<string | null>(null);
    const conversationBusyRef = useRef(conversationBusy);
    const initialSegmentsHydratedRef = useRef(Boolean(initialSegments?.length));
    const onElementAttachmentsChangeRef = useRef(onElementAttachmentsChange);
    const onLoopEnabledChangeRef = useRef(onLoopEnabledChange);
    const onAgentModeChangeRef = useRef(onAgentModeChange);
    const onSegmentsCommitRef = useRef(onSegmentsCommit);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const loopEnabledRef = useRef(loopEnabled);
    const agentModeRef = useRef(agentMode);
    const prevLoopEnabledRef = useRef(false);
    const prevAgentModeRef = useRef(agentMode);
    const hadLoopRef = useRef(hasLoopSegment(segments));
    const hadAgentModeRef = useRef(isAgentModeChipKind(agentMode));
    const agentModeChipDismissedRef = useRef(agentModeChipDismissed);
    const onAgentModeChipDismissChangeRef = useRef(onAgentModeChipDismissChange);

    useEffect(() => {
      agentModeChipDismissedRef.current = agentModeChipDismissed;
    }, [agentModeChipDismissed]);

    useEffect(() => {
      onAgentModeChipDismissChangeRef.current = onAgentModeChipDismissChange;
    }, [onAgentModeChipDismissChange]);

    useEffect(() => {
      loopEnabledRef.current = loopEnabled;
    }, [loopEnabled]);

    useEffect(() => {
      agentModeRef.current = agentMode;
    }, [agentMode]);

    useEffect(() => {
      conversationBusyRef.current = conversationBusy;
    }, [conversationBusy]);

    useEffect(() => {
      onLoopEnabledChangeRef.current = onLoopEnabledChange;
    }, [onLoopEnabledChange]);

    useEffect(() => {
      onAgentModeChangeRef.current = onAgentModeChange;
    }, [onAgentModeChange]);

    useEffect(() => {
      onSegmentsCommitRef.current = onSegmentsCommit;
    }, [onSegmentsCommit]);

    useEffect(() => {
      editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    const syncLoopEnabledFromSegments = useCallback((next: RichSegment[]) => {
      const hasLoop = hasLoopSegment(next);
      if (hasLoop === hadLoopRef.current) {
        return;
      }
      if (!hasLoop && loopEnabledRef.current) {
        return;
      }
      hadLoopRef.current = hasLoop;
      onLoopEnabledChangeRef.current?.(hasLoop);
    }, []);

    const syncAgentModeFromSegments = useCallback((next: RichSegment[]) => {
      const mode = agentModeRef.current;
      const hasChip = hasAgentModeSegment(next);
      if (isAgentModeChipKind(mode)) {
        if (hasChip) {
          hadAgentModeRef.current = true;
          return;
        }
        hadAgentModeRef.current = false;
        onAgentModeChangeRef.current?.("agent");
        return;
      }
      if (!hasChip && hadAgentModeRef.current) {
        hadAgentModeRef.current = false;
        onAgentModeChangeRef.current?.("agent");
      }
    }, []);

    const chipPolicy = useCallback((): AgentModeChipPolicy => {
      return {
        hostMode: agentModeRef.current,
        dismissed: agentModeChipDismissedRef.current,
      };
    }, []);

    const applyComposerPolicy = useCallback(
      (next: RichSegment[]): RichSegment[] =>
        applyAgentModeChipPolicy(
          ensureLoopChipTypingTail(ensureLoopPinned(mergeAdjacentTextSegments(next))),
          chipPolicy(),
        ),
      [chipPolicy],
    );

    const pushSegmentsToEditor = useCallback(
      (next: RichSegment[], caret: SegmentCaret | null) => {
        skipEditorSyncRef.current = true;
        richSegmentsToEditorState(next, editor);
        if (caret) {
          segmentCaretToLexicalSelection(
            editor,
            normalizeCaretForComposer(next, caret),
          );
        }
        skipEditorSyncRef.current = false;
      },
      [editor, skipEditorSyncRef],
    );

    const reportSelectionChange = useCallback(() => {
      const report = onSelectionChangeRef.current;
      if (!report) {
        return;
      }
      const caret = lexicalSelectionToSegmentCaret(editor);
      if (!caret) {
        report(null);
        return;
      }
      report(caretToPlainTextOffset(segmentsRef.current, caret));
    }, [editor]);

    useEffect(() => {
      const root = contentEditableRef.current;
      if (!root || !onSelectionChange) {
        return;
      }
      const report = () => reportSelectionChange();
      const onDocumentSelectionChange = () => {
        const selection = window.getSelection();
        if (
          !selection
          || selection.rangeCount === 0
          || !root.contains(selection.getRangeAt(0).commonAncestorContainer)
        ) {
          return;
        }
        report();
      };
      root.addEventListener("mouseup", report);
      root.addEventListener("keyup", report);
      document.addEventListener("selectionchange", onDocumentSelectionChange);
      return () => {
        root.removeEventListener("mouseup", report);
        root.removeEventListener("keyup", report);
        document.removeEventListener("selectionchange", onDocumentSelectionChange);
      };
    }, [editor, onSelectionChange, reportSelectionChange]);

    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    useEffect(() => {
      onElementAttachmentsChangeRef.current = onElementAttachmentsChange;
    });

    const notifyParents = useCallback(
      (next: RichSegment[]) => {
        const plain = normalizeComposerPlain(segmentsToPlainText(next));
        lastSyncedToParentPlainRef.current = plain;
        skipExternalValueSyncRef.current = true;
        onTextChange(plain);
        onElementAttachmentsChange(segmentsToAttachments(next));
      },
      [onTextChange, onElementAttachmentsChange],
    );

    const commitSegments = useCallback(
      (
        next: RichSegment[],
        caret?: SegmentCaret | null,
        options?: {
          notifyParent?: boolean;
          syncLoop?: boolean;
          syncAgentMode?: boolean;
          pushEditor?: boolean;
        },
      ) => {
        const merged = applyComposerPolicy(next);
        let resolvedCaret = caret ?? null;
        if (
          hasLoopSegment(merged)
          || (shouldPinAgentModeChip(chipPolicy()) && hasAgentModeSegment(merged))
        ) {
          resolvedCaret = normalizeCaretForComposer(merged, resolvedCaret);
        }
        segmentsRef.current = merged;
        pendingCaretRef.current = resolvedCaret;
        setSegments(merged);
        onSegmentsCommitRef.current?.();
        if (options?.syncLoop !== false && !loopEnabledRef.current) {
          syncLoopEnabledFromSegments(merged);
        }
        if (options?.syncAgentMode !== false && !isAgentModeChipKind(agentModeRef.current)) {
          syncAgentModeFromSegments(merged);
        }
        if (options?.notifyParent !== false) {
          notifyParents(merged);
        }
        if (options?.pushEditor !== false) {
          pushSegmentsToEditor(merged, resolvedCaret);
          pendingCaretRef.current = null;
          reportSelectionChange();
        }
      },
      [
        applyComposerPolicy,
        chipPolicy,
        notifyParents,
        pushSegmentsToEditor,
        reportSelectionChange,
        syncAgentModeFromSegments,
        syncLoopEnabledFromSegments,
      ],
    );

    const getSegments = useCallback((): RichSegment[] => segmentsRef.current, []);

    const caretOrEnd = useCallback((): SegmentCaret => {
      return lexicalSelectionToSegmentCaret(editor) ?? caretAtEnd(segmentsRef.current);
    }, [editor]);

    const insertAttachment = useCallback(
      (a: BrowserElementAttachment) => {
        editor.focus();
        const current = segmentsRef.current;
        const caret = caretOrEnd();
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(current, caret, {
          kind: "element",
          attachment: a,
        });
        commitSegments(next, nextCaret);
      },
      [caretOrEnd, commitSegments, editor],
    );

    const insertPrDiffAttachment = useCallback(
      (attachment: PrDiffAttachment) => {
        editor.focus();
        const current = segmentsRef.current;
        const caret = caretOrEnd();
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(current, caret, {
          kind: "prDiff",
          attachment,
        });
        commitSegments(next, nextCaret);
      },
      [caretOrEnd, commitSegments, editor],
    );

    const insertGitCommitAttachment = useCallback(
      (attachment: GitCommitAttachment) => {
        editor.focus();
        const current = segmentsRef.current;
        const caret = caretOrEnd();
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(current, caret, {
          kind: "gitCommit",
          attachment,
        });
        commitSegments(next, nextCaret);
      },
      [caretOrEnd, commitSegments, editor],
    );

    const insertTerminalSnippet = useCallback(
      (attachment: TerminalSnippetAttachment) => {
        editor.focus();
        const current = segmentsRef.current;
        const caret = caretOrEnd();
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(current, caret, {
          kind: "terminalSnippet",
          attachment,
        });
        commitSegments(next, nextCaret);
      },
      [caretOrEnd, commitSegments, editor],
    );

    const insertFileSnippet = useCallback(
      (attachment: FileSnippetAttachment) => {
        editor.focus();
        const current = segmentsRef.current;
        const caret = caretOrEnd();
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(current, caret, {
          kind: "fileSnippet",
          attachment,
        });
        commitSegments(next, nextCaret);
      },
      [caretOrEnd, commitSegments, editor],
    );

    const insertWorkspaceFileReference = useCallback(
      (path: string, query: ActiveWorkspaceFileReferenceQuery, finalize = true) => {
        editor.focus();
        const { segments: next, caret } = replaceWorkspaceFileReferenceInSegments(
          segmentsRef.current,
          query,
          path,
          finalize,
        );
        commitSegments(next, caret);
      },
      [commitSegments, editor],
    );

    const insertWorkspaceFileAtCaret = useCallback(
      (path: string) => {
        editor.focus();
        const current = segmentsRef.current;
        const caret = caretOrEnd();
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(current, caret, {
          kind: "workspaceFile",
          path: normalizeWorkspaceFilePath(path),
        });
        commitSegments(next, nextCaret);
      },
      [caretOrEnd, commitSegments, editor],
    );

    const replaceSkillSlashQuery = useCallback(
      (query: ActiveSkillSlashQuery, replacement: string, finalize = false) => {
        editor.focus();
        const { segments: next, caret } = replaceSkillSlashQueryInSegments(
          segmentsRef.current,
          query,
          replacement,
          finalize,
        );
        commitSegments(next, caret);
      },
      [commitSegments, editor],
    );

    const removeSkillSlashQuery = useCallback(
      (query: ActiveSkillSlashQuery) => {
        replaceSkillSlashQuery(query, "", false);
      },
      [replaceSkillSlashQuery],
    );

    const applySegments = useCallback(
      (next: RichSegment[], caret?: SegmentCaret | null, notifyParent = true) => {
        commitSegments(next, caret ?? caretAtEnd(mergeAdjacentTextSegments(next)), {
          notifyParent,
        });
      },
      [commitSegments],
    );

    const insertLoopChip = useCallback(
      (options?: InsertLoopChipOptions) => {
        editor.focus();
        const base = options?.clearText ? emptySegments() : segmentsRef.current;
        if (!options?.clearText && hasLoopSegment(base)) {
          return;
        }
        const { segments: next, caret } = insertLoopSegment(base);
        if (options?.clearText) {
          loopEnabledRef.current = true;
        }
        hadLoopRef.current = true;
        commitSegments(next, caret, { syncLoop: false });
      },
      [commitSegments, editor],
    );

    const removeLoopChip = useCallback(() => {
      if (!hasLoopSegment(segmentsRef.current)) {
        return;
      }
      const next = applyComposerPolicy(removeLoopSegment(segmentsRef.current));
      loopEnabledRef.current = false;
      hadLoopRef.current = false;
      commitSegments(next, { segmentIndex: 0, offset: 0 }, { syncLoop: false });
      onLoopEnabledChangeRef.current?.(false);
    }, [applyComposerPolicy, commitSegments]);

    const insertAgentModeChip = useCallback(
      (mode: AgentModeChipKind, options?: InsertAgentModeChipOptions) => {
        editor.focus();
        const base = options?.clearText ? emptySegments() : segmentsRef.current;
        agentModeChipDismissedRef.current = false;
        onAgentModeChipDismissChangeRef.current?.(false);
        const { segments: next, caret } = insertAgentModeSegment(base, mode);
        agentModeRef.current = mode;
        hadAgentModeRef.current = true;
        commitSegments(next, caret, { syncAgentMode: false });
      },
      [commitSegments, editor],
    );

    const insertPlanChip = useCallback(
      (options?: InsertAgentModeChipOptions) => insertAgentModeChip("plan", options),
      [insertAgentModeChip],
    );

    const insertAskChip = useCallback(
      (options?: InsertAgentModeChipOptions) => insertAgentModeChip("ask", options),
      [insertAgentModeChip],
    );

    const insertDebugChip = useCallback(
      (options?: InsertAgentModeChipOptions) => insertAgentModeChip("debug", options),
      [insertAgentModeChip],
    );

    const insertPlainTextAtCaret = useCallback(
      (text: string) => {
        if (!text) {
          return;
        }
        editor.focus();
        const current = mergeAdjacentTextSegments(segmentsRef.current);
        const caret = lexicalSelectionToSegmentCaret(editor) ?? caretAtEnd(current);
        const seg = current[caret.segmentIndex];
        if (seg?.kind === "text") {
          const before = seg.value.slice(0, caret.offset);
          const after = seg.value.slice(caret.offset);
          const next = mergeAdjacentTextSegments([
            ...current.slice(0, caret.segmentIndex),
            { kind: "text" as const, value: `${before}${text}${after}` },
            ...current.slice(caret.segmentIndex + 1),
          ]);
          commitSegments(next, {
            segmentIndex: caret.segmentIndex,
            offset: caret.offset + text.length,
          });
          return;
        }
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(current, caret, {
          kind: "text",
          value: text,
        });
        commitSegments(next, nextCaret);
      },
      [commitSegments, editor],
    );

    const insertSkillChip = useCallback(
      (alias: string, options?: InsertSkillChipOptions) => {
        editor.focus();
        const base = options?.clearText
          ? emptySegments()
          : mergeAdjacentTextSegments(segmentsRef.current);
        const caret = options?.clearText
          ? caretAtEnd(base)
          : (lexicalSelectionToSegmentCaret(editor) ?? caretAtEnd(base));
        let { segments: next, caret: nextCaret } = insertSegmentAtCaret(base, caret, {
          kind: "skill",
          alias,
        });
        if (options?.appendTrailingSpace) {
          const trailing = next[nextCaret.segmentIndex];
          const chipTailAlreadySpaced =
            trailing?.kind === "text"
            && isComposerPlainEmpty(trailing.value)
            && nextCaret.offset > 0;
          if (!chipTailAlreadySpaced) {
            ({ segments: next, caret: nextCaret } = insertSegmentAtCaret(next, nextCaret, {
              kind: "text",
              value: " ",
            }));
          }
        }
        commitSegments(next, nextCaret);
      },
      [commitSegments, editor],
    );

    const removeAgentModeChip = useCallback(() => {
      if (!hasAgentModeSegment(segmentsRef.current)) {
        return;
      }
      agentModeChipDismissedRef.current = true;
      onAgentModeChipDismissChangeRef.current?.(true);
      const next = applyAgentModeChipPolicy(removeAgentModeSegment(segmentsRef.current), {
        hostMode: agentModeRef.current,
        dismissed: true,
      });
      hadAgentModeRef.current = false;
      commitSegments(next, { segmentIndex: 0, offset: 0 }, { syncAgentMode: false });
      if (isAgentModeChipKind(agentModeRef.current)) {
        onAgentModeChangeRef.current?.("agent");
      }
    }, [commitSegments]);

    const resetAfterSend = useCallback(
      (mode: DesktopAgentMode) => {
        agentModeChipDismissedRef.current = false;
        onAgentModeChipDismissChangeRef.current?.(false);
        let next = buildSegmentsAfterSend(mode);
        if (loopEnabledRef.current) {
          next = insertLoopSegment(next).segments;
        }
        const caret = hasAgentModeSegment(next)
          ? caretAfterAgentModeChip(next)
          : caretAtEnd(next);
        skipExternalValueSyncRef.current = true;
        commitSegments(next, caret, { syncLoop: false, syncAgentMode: false });
      },
      [commitSegments],
    );

    const focusAtEnd = useCallback(() => {
      focusComposerAtEnd(editor, segmentsRef.current);
      reportSelectionChange();
    }, [editor, reportSelectionChange]);

    const getPlainTextCaretClientRect = useCallback((plainTextOffset: number): DOMRect | null => {
      const root = contentEditableRef.current;
      if (!root) {
        return null;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        return null;
      }

      const caret = lexicalSelectionToSegmentCaret(editor);
      if (!caret || caretToPlainTextOffset(segmentsRef.current, caret) !== plainTextOffset) {
        return null;
      }
      return range.cloneRange().getBoundingClientRect();
    }, [editor]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editor.focus(),
        focusAtEnd,
        insertAttachment,
        insertPrDiffAttachment,
        insertGitCommitAttachment,
        insertTerminalSnippet,
        insertFileSnippet,
        insertWorkspaceFileReference,
        insertWorkspaceFileAtCaret,
        insertLoopChip,
        removeLoopChip,
        insertPlanChip,
        insertAskChip,
        insertDebugChip,
        removeAgentModeChip,
        insertSkillChip,
        replaceSkillSlashQuery,
        removeSkillSlashQuery,
        insertPlainTextAtCaret,
        resetAfterSend,
        getSegments,
        setSegments: (next: RichSegment[]) => applySegments(next),
        getPlainTextCaretClientRect,
      }),
      [
        editor,
        insertAttachment,
        insertPrDiffAttachment,
        insertGitCommitAttachment,
        insertTerminalSnippet,
        insertFileSnippet,
        insertWorkspaceFileReference,
        insertWorkspaceFileAtCaret,
        replaceSkillSlashQuery,
        removeSkillSlashQuery,
        insertPlainTextAtCaret,
        insertLoopChip,
        removeLoopChip,
        insertPlanChip,
        insertAskChip,
        insertDebugChip,
        removeAgentModeChip,
        insertSkillChip,
        resetAfterSend,
        focusAtEnd,
        getSegments,
        getPlainTextCaretClientRect,
        applySegments,
      ],
    );

    useEffect(() => {
      const prev = prevLoopEnabledRef.current;
      prevLoopEnabledRef.current = loopEnabled;
      if (!loopEnabled) {
        if (prev && hasLoopSegment(segmentsRef.current)) {
          removeLoopChip();
        }
        return;
      }
      if (!prev && !hasLoopSegment(segmentsRef.current)) {
        insertLoopChip();
      }
    }, [loopEnabled, insertLoopChip, removeLoopChip]);

    useEffect(() => {
      const prev = prevAgentModeRef.current;
      prevAgentModeRef.current = agentMode;
      if (!isAgentModeChipKind(agentMode)) {
        if (isAgentModeChipKind(prev) && hasAgentModeSegment(segmentsRef.current)) {
          removeAgentModeChip();
        }
        return;
      }
      if (prev !== agentMode && !agentModeChipDismissedRef.current) {
        insertAgentModeChip(agentMode, { clearText: false });
      }
    }, [agentMode, insertAgentModeChip, removeAgentModeChip]);

    useLayoutEffect(() => {
      if (!initialSegments?.length || initialSegmentsHydratedRef.current) {
        return;
      }
      initialSegmentsHydratedRef.current = true;
      const merged = mergeAdjacentTextSegments([...initialSegments]);
      if (!segmentsEqual(merged, segmentsRef.current)) {
        skipExternalValueSyncRef.current = true;
        applySegments(merged, caretAtEnd(merged), false);
      }
    }, [initialSegments, applySegments]);

    useEffect(() => {
      const current = segmentsRef.current;
      const plain = segmentsToPlainText(current);
      const localPlain = normalizeComposerPlain(plain);
      const externalPlain = normalizeComposerPlain(value);
      if (skipExternalValueSyncRef.current) {
        const expected = lastSyncedToParentPlainRef.current;
        if (expected !== null && externalPlain !== expected) {
          skipExternalValueSyncRef.current = true;
          return;
        }
        skipExternalValueSyncRef.current = false;
        return;
      }

      const hasElements = current.some((s) => s.kind === "element");
      const attachmentCount = elementAttachments?.length ?? 0;

      if (
        attachmentCount > 0
        && !hasElements
        && initialSegments?.some((s) => s.kind === "element")
      ) {
        skipExternalValueSyncRef.current = true;
        const merged = mergeAdjacentTextSegments([...initialSegments]);
        applySegments(merged, caretAtEnd(merged), false);
        return;
      }

      if (
        !value
        && attachmentCount === 0
        && (plain || hasElements || hasLoopSegment(current) || hasAgentModeSegment(current))
      ) {
        if (hasLoopSegment(current) && isComposerPlainEmpty(plain) && !hasElements) {
          return;
        }
        if ((loopEnabled || loopEnabledRef.current) && !hasLoopSegment(current)) {
          const { segments: next, caret } = insertLoopSegment(emptySegments());
          commitSegments(applyComposerPolicy(next), caret, {
            syncLoop: false,
            syncAgentMode: false,
          });
          return;
        }
        const policy = chipPolicy();
        if (
          shouldPinAgentModeChip(policy)
          && hasAgentModeSegment(current)
          && isComposerPlainEmpty(plain)
          && !hasElements
        ) {
          return;
        }
        if (agentModeChipDismissedRef.current && !hasAgentModeSegment(current)) {
          return;
        }
        if (hasSkillSegment(current) && isComposerPlainEmpty(plain)) {
          return;
        }
        if (hasInlineAttachmentChipSegments(current) && isComposerPlainEmpty(plain)) {
          return;
        }
        commitSegments(emptySegments(), { segmentIndex: 0, offset: 0 });
        return;
      }

      if (localPlain === externalPlain) {
        return;
      }

      if (
        conversationBusyRef.current
        && lastSyncedToParentPlainRef.current === localPlain
        && externalPlain !== localPlain
      ) {
        return;
      }

      let next = syncSegmentsFromExternalValue(current, value);
      next = applyComposerPolicy(next);
      if (agentModeChipDismissedRef.current && hasAgentModeSegment(next)) {
        next = removeAgentModeSegment(next);
      }
      if (!segmentsEqual(next, current)) {
        const nextCaret = normalizeCaretForComposer(next, caretAtEnd(next));
        commitSegments(next, nextCaret, {
          notifyParent: false,
          syncLoop: false,
          syncAgentMode: false,
        });
      }
    }, [
      value,
      elementAttachments?.length,
      initialSegments,
      applyComposerPolicy,
      applySegments,
      commitSegments,
      loopEnabled,
      agentMode,
      agentModeChipDismissed,
      conversationBusy,
      chipPolicy,
    ]);

    const handleEditorChange = useCallback(
      (changedEditor: LexicalEditor) => {
        if (skipEditorSyncRef.current || isComposingRef.current) {
          return;
        }
        const raw = editorStateToRichSegments(changedEditor);
        const caret = lexicalSelectionToSegmentCaret(changedEditor);
        const policyApplied = applyComposerPolicy(raw);
        const needsEditorPush = !segmentsEqual(policyApplied, raw);
        commitSegments(policyApplied, caret, { pushEditor: needsEditorPush });
      },
      [applyComposerPolicy, commitSegments, skipEditorSyncRef],
    );

    const restoreNormalizedCaret = useCallback(() => {
      const raw = lexicalSelectionToSegmentCaret(editor);
      if (!raw) {
        return;
      }
      const caret = normalizeCaretForComposer(segmentsRef.current, raw);
      if (caret.segmentIndex === raw.segmentIndex && caret.offset === raw.offset) {
        return;
      }
      segmentCaretToLexicalSelection(editor, caret);
      reportSelectionChange();
    }, [editor, reportSelectionChange]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Backspace" && !e.defaultPrevented) {
          const rawCaret = lexicalSelectionToSegmentCaret(editor);
          const caret = rawCaret
            ? normalizeCaretForComposer(segmentsRef.current, rawCaret)
            : null;
          if (caret && isCaretAtLoopRemovalPoint(segmentsRef.current, caret)) {
            e.preventDefault();
            removeLoopChip();
            return;
          }
          if (caret && isCaretAtAgentModeRemovalPoint(segmentsRef.current, caret)) {
            e.preventDefault();
            removeAgentModeChip();
            return;
          }
          if (caret && isCaretAtInlineChipRemovalPoint(segmentsRef.current, caret)) {
            const removed = removeInlineChipAtRemovalPoint(segmentsRef.current, caret);
            if (removed) {
              e.preventDefault();
              commitSegments(removed.segments, removed.caret);
              return;
            }
          }
        }
        onKeyDown?.(e);
      },
      [commitSegments, editor, onKeyDown, removeLoopChip, removeAgentModeChip],
    );

    const handleKeyUp = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          restoreNormalizedCaret();
        }
      },
      [restoreNormalizedCaret],
    );

    const handleCompositionStart = useCallback(() => {
      isComposingRef.current = true;
      setIsComposing(true);
    }, []);

    const handleCompositionEnd = useCallback(() => {
      isComposingRef.current = false;
      setIsComposing(false);
      handleEditorChange(editor);
    }, [editor, handleEditorChange]);

    const handleCopy = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
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
      if (Object.keys(chips).length === 0) return;
      e.preventDefault();
      const textDiv = document.createElement("div");
      textDiv.appendChild(frag.cloneNode(true));
      e.nativeEvent.clipboardData?.setData("text/plain", textDiv.innerText);
      e.nativeEvent.clipboardData?.setData(ELEMENT_MIME, JSON.stringify(chips));
      e.nativeEvent.clipboardData?.setData("text/html", textDiv.innerHTML);
    }, []);

    const handlePaste = useCallback(
      (e: ClipboardEvent<HTMLDivElement>) => {
        onPaste?.(e);
        if (e.defaultPrevented) return;
        const raw = e.nativeEvent.clipboardData?.getData(ELEMENT_MIME);
        if (raw) {
          e.preventDefault();
          try {
            const chips: Record<string, BrowserElementAttachment> = JSON.parse(raw);
            const html = e.nativeEvent.clipboardData?.getData("text/html") ?? "";
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
            let nextCaret = caret;
            for (const seg of pasteSegs) {
              const result = insertSegmentAtCaret(next, nextCaret, seg);
              next = result.segments;
              nextCaret = result.caret;
            }
            commitSegments(next, nextCaret);
          } catch {
            // fall through to plain-text paste below
          }
          return;
        }

        const plain = e.nativeEvent.clipboardData?.getData("text/plain");
        if (!plain) return;
        e.preventDefault();
        const caret = lexicalSelectionToSegmentCaret(editor) ?? caretAtEnd(segmentsRef.current);
        const { segments: next, caret: nextCaret } = insertSegmentAtCaret(
          segmentsRef.current,
          caret,
          { kind: "text", value: plain },
        );
        commitSegments(next, nextCaret);
      },
      [commitSegments, editor, onPaste],
    );

    const isEmpty = composerShowsPlaceholder(segments, {
      composing: isComposing,
      attachmentCount: elementAttachments?.length ?? 0,
    });

    const showAgentModeChipPlaceholder =
      composerShowsAgentModeChipPlaceholder(segments, {
        composing: isComposing,
        attachmentCount: elementAttachments?.length ?? 0,
      }) && Boolean(agentModeChipPlaceholder);

    useLayoutEffect(() => {
      if (!showAgentModeChipPlaceholder) {
        setAgentModeChipPlaceholderLeft(null);
        return;
      }

      const shell = shellRef.current;
      const editorEl = contentEditableRef.current;
      if (!shell || !editorEl) {
        setAgentModeChipPlaceholderLeft(null);
        return;
      }

      const measure = () => {
        const chip = editorEl.querySelector(AGENT_MODE_CHIP_SELECTOR);
        if (!(chip instanceof HTMLElement)) {
          setAgentModeChipPlaceholderLeft(null);
          return;
        }
        const shellRect = shell.getBoundingClientRect();
        const editorRect = editorEl.getBoundingClientRect();
        const editorPaddingLeft = parseFloat(getComputedStyle(editorEl).paddingLeft) || 0;
        const defaultPlaceholderLeft = editorPaddingLeft + (editorRect.left - shellRect.left);

        const selection = window.getSelection();
        let caretLeftInShell: number | null = null;
        if (
          selection
          && selection.rangeCount > 0
          && editorEl.contains(selection.anchorNode)
        ) {
          const caretRect = selection.getRangeAt(0).cloneRange().getBoundingClientRect();
          caretLeftInShell = caretRect.left - shellRect.left;
        } else {
          const chipRect = chip.getBoundingClientRect();
          if (chipRect.width > 0 || chipRect.height > 0) {
            caretLeftInShell = chipRect.right - shellRect.left;
          }
        }

        setAgentModeChipPlaceholderLeft(caretLeftInShell ?? defaultPlaceholderLeft);
      };

      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(editorEl);
      observer.observe(shell);
      window.addEventListener("resize", measure);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", measure);
      };
    }, [showAgentModeChipPlaceholder, segments]);

    return (
      <div ref={shellRef} className="relative">
        {isEmpty && placeholder && (
          <span
            aria-hidden
            className={cn(COMPOSER_PLACEHOLDER_CLASS, "left-3")}
          >
            {placeholder}
          </span>
        )}
        {showAgentModeChipPlaceholder
          && agentModeChipPlaceholderLeft !== null
          && agentModeChipPlaceholder ? (
          <span
            aria-hidden
            className={COMPOSER_PLACEHOLDER_CLASS}
            style={{ left: agentModeChipPlaceholderLeft }}
          >
            {agentModeChipPlaceholder}
          </span>
        ) : null}
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              ref={contentEditableRef}
              aria-multiline="true"
              aria-label={placeholder}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onCopy={handleCopy}
              onPaste={handlePaste}
              className={cn(
                "spirit-scroll block max-h-[12rem] min-h-[3rem] w-full overflow-y-auto rounded-none border-0 bg-transparent px-3 pt-2.5 pb-1.5 text-sm leading-relaxed outline-none md:min-h-[3.5rem]",
                "whitespace-pre-wrap break-words",
                className,
              )}
            />
          }
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ComposerOnChangePlugin
          skipEditorSyncRef={skipEditorSyncRef}
          onEditorChange={handleEditorChange}
        />
        <ComposerSegmentsHydratePlugin
          editorRef={editorRef}
          segmentsRef={segmentsRef}
          skipEditorSyncRef={skipEditorSyncRef}
          mountHydratedRef={mountHydratedRef}
        />
      </div>
    );
  },
);

export const ComposerLexicalInput = forwardRef<ComposerRichInputHandle, Props>(
  function ComposerLexicalInput(props, ref) {
    const {
      readOnly,
      loopChipLabel = "Loop",
      planChipLabel = "Plan",
      askChipLabel = "Ask",
    } = props;

    const editorRef = useRef<LexicalEditor | null>(null);
    const skipEditorSyncRef = useRef(false);
    const mountHydratedRef = useRef(false);

    const initialConfig = useMemo(
      () => ({
        namespace: "spirit-composer",
        nodes: [...COMPOSER_LEXICAL_NODES],
        editable: !readOnly,
        onError(error: Error) {
          throw error;
        },
      }),
      [readOnly],
    );

    return (
      <ComposerChipLabelsProvider
        labels={{
          planLabel: planChipLabel,
          askLabel: askChipLabel,
          loopLabel: loopChipLabel,
        }}
      >
        <LexicalComposer initialConfig={initialConfig}>
          <ComposerLexicalInputCore
            ref={ref}
            {...props}
            editorRef={editorRef}
            skipEditorSyncRef={skipEditorSyncRef}
            mountHydratedRef={mountHydratedRef}
          />
        </LexicalComposer>
      </ComposerChipLabelsProvider>
    );
  },
);

function mergeTextIntoPaste(segs: RichSegment[], chunk: string): void {
  const last = segs[segs.length - 1];
  if (last?.kind === "text") {
    last.value += chunk;
  } else {
    segs.push({ kind: "text", value: chunk });
  }
}
