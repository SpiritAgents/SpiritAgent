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
import {
  INSERT_ATTACHMENT_CHIP_COMMAND,
  INSERT_PLAIN_TEXT_COMMAND,
  INSERT_SKILL_CHIP_COMMAND,
  INSERT_WORKSPACE_FILE_AT_CARET_COMMAND,
  INSERT_WORKSPACE_FILE_REFERENCE_COMMAND,
  REMOVE_SKILL_SLASH_COMMAND,
  REPLACE_SKILL_SLASH_COMMAND,
} from "@/lib/composer-lexical/commands";
import { ComposerCommandsPlugin } from "@/lib/composer-lexical/plugins/composer-commands-plugin";
import { ComposerClipboardPlugin } from "@/lib/composer-lexical/plugins/composer-clipboard-plugin";
import { SlashSelectionPlugin } from "@/lib/composer-lexical/plugins/slash-selection-plugin";
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
import { AgentModeChipPlugin } from "@/lib/composer-lexical/plugins/agent-mode-chip-plugin";
import { LoopChipPlugin } from "@/lib/composer-lexical/plugins/loop-chip-plugin";
import { normalizeComposerSegmentsPolicy } from "@/lib/composer-lexical/composer-lexical-policy";
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

type Props = {
  /** Controlled rich segments; parent is source of truth when paired with onSegmentsChange. */
  segments?: readonly RichSegment[];
  onSegmentsChange?(segments: RichSegment[]): void;
  /** Derived plain text for legacy/uncontrolled callers. */
  value?: string;
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
  onTextChange?(text: string): void;
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
      segments: controlledSegments,
      onSegmentsChange,
      value = "",
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
      const hydrateFrom = controlledSegments?.length
        ? controlledSegments
        : initialSegments?.length
          ? initialSegments
          : null;
      const base = hydrateFrom
        ? ensureLoopPinned(mergeAdjacentTextSegments([...hydrateFrom]))
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
    const skipExternalValueSyncRef = useRef(Boolean(controlledSegments?.length || initialSegments?.length));
    const lastSyncedToParentPlainRef = useRef<string | null>(null);
    const lastSyncedToParentSegmentsRef = useRef<RichSegment[] | null>(
      controlledSegments?.length ? [...controlledSegments] : null,
    );
    const skipExternalSegmentsSyncRef = useRef(Boolean(controlledSegments?.length));
    const segmentsControlled = Boolean(onSegmentsChange);
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
        normalizeComposerSegmentsPolicy(next, {
          agentMode: agentModeRef.current,
          agentModeChipDismissed: agentModeChipDismissedRef.current,
        }),
      [],
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
      onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    useEffect(() => {
      onElementAttachmentsChangeRef.current = onElementAttachmentsChange;
    });

    const notifyParents = useCallback(
      (next: RichSegment[]) => {
        if (segmentsControlled && onSegmentsChange) {
          lastSyncedToParentSegmentsRef.current = next;
          skipExternalSegmentsSyncRef.current = true;
          onSegmentsChange(next);
        } else if (onTextChange) {
          const plain = normalizeComposerPlain(segmentsToPlainText(next));
          lastSyncedToParentPlainRef.current = plain;
          skipExternalValueSyncRef.current = true;
          onTextChange(plain);
        }
        onElementAttachmentsChange(segmentsToAttachments(next));
      },
      [onElementAttachmentsChange, onSegmentsChange, onTextChange, segmentsControlled],
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

    const handleSegmentsNormalized = useCallback(
      (next: RichSegment[]) => {
        commitSegments(next, lexicalSelectionToSegmentCaret(editor), {
          pushEditor: false,
          syncLoop: false,
          syncAgentMode: false,
        });
      },
      [commitSegments, editor],
    );

    const getSegments = useCallback((): RichSegment[] => segmentsRef.current, []);

    const insertAttachment = useCallback(
      (a: BrowserElementAttachment) => {
        editor.dispatchCommand(INSERT_ATTACHMENT_CHIP_COMMAND, {
          kind: "element",
          attachment: a,
        });
      },
      [editor],
    );

    const insertPrDiffAttachment = useCallback(
      (attachment: PrDiffAttachment) => {
        editor.dispatchCommand(INSERT_ATTACHMENT_CHIP_COMMAND, {
          kind: "prDiff",
          attachment,
        });
      },
      [editor],
    );

    const insertGitCommitAttachment = useCallback(
      (attachment: GitCommitAttachment) => {
        editor.dispatchCommand(INSERT_ATTACHMENT_CHIP_COMMAND, {
          kind: "gitCommit",
          attachment,
        });
      },
      [editor],
    );

    const insertTerminalSnippet = useCallback(
      (attachment: TerminalSnippetAttachment) => {
        editor.dispatchCommand(INSERT_ATTACHMENT_CHIP_COMMAND, {
          kind: "terminalSnippet",
          attachment,
        });
      },
      [editor],
    );

    const insertFileSnippet = useCallback(
      (attachment: FileSnippetAttachment) => {
        editor.dispatchCommand(INSERT_ATTACHMENT_CHIP_COMMAND, {
          kind: "fileSnippet",
          attachment,
        });
      },
      [editor],
    );

    const insertWorkspaceFileReference = useCallback(
      (path: string, query: ActiveWorkspaceFileReferenceQuery, finalize = true) => {
        editor.dispatchCommand(INSERT_WORKSPACE_FILE_REFERENCE_COMMAND, {
          path,
          query,
          finalize,
        });
      },
      [editor],
    );

    const insertWorkspaceFileAtCaret = useCallback(
      (path: string) => {
        editor.dispatchCommand(INSERT_WORKSPACE_FILE_AT_CARET_COMMAND, { path });
      },
      [editor],
    );

    const replaceSkillSlashQuery = useCallback(
      (query: ActiveSkillSlashQuery, replacement: string, finalize = false) => {
        editor.dispatchCommand(REPLACE_SKILL_SLASH_COMMAND, {
          query,
          replacement,
          finalize,
        });
      },
      [editor],
    );

    const removeSkillSlashQuery = useCallback(
      (query: ActiveSkillSlashQuery) => {
        editor.dispatchCommand(REMOVE_SKILL_SLASH_COMMAND, { query });
      },
      [editor],
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
        editor.dispatchCommand(INSERT_PLAIN_TEXT_COMMAND, { text });
      },
      [editor],
    );

    const insertSkillChip = useCallback(
      (alias: string, options?: InsertSkillChipOptions) => {
        editor.dispatchCommand(INSERT_SKILL_CHIP_COMMAND, {
          alias,
          clearText: options?.clearText,
          appendTrailingSpace: options?.appendTrailingSpace,
        });
      },
      [editor],
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

    useLayoutEffect(() => {
      if (segmentsControlled || !initialSegments?.length || initialSegmentsHydratedRef.current) {
        return;
      }
      initialSegmentsHydratedRef.current = true;
      const merged = mergeAdjacentTextSegments([...initialSegments]);
      if (!segmentsEqual(merged, segmentsRef.current)) {
        skipExternalValueSyncRef.current = true;
        applySegments(merged, caretAtEnd(merged), false);
      }
    }, [initialSegments, applySegments, segmentsControlled]);

    useEffect(() => {
      if (!segmentsControlled || !controlledSegments) {
        return;
      }
      if (skipExternalSegmentsSyncRef.current) {
        const expected = lastSyncedToParentSegmentsRef.current;
        if (expected !== null && segmentsEqual([...controlledSegments], expected)) {
          skipExternalSegmentsSyncRef.current = false;
          return;
        }
        skipExternalSegmentsSyncRef.current = false;
      }
      const merged = mergeAdjacentTextSegments([...controlledSegments]);
      if (segmentsEqual(merged, segmentsRef.current)) {
        return;
      }
      skipExternalValueSyncRef.current = true;
      applySegments(merged, caretAtEnd(merged), false);
    }, [applySegments, controlledSegments, segmentsControlled]);

    useEffect(() => {
      if (segmentsControlled) {
        return;
      }
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
      segmentsControlled,
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
        <AgentModeChipPlugin
          agentMode={agentMode}
          agentModeChipDismissed={agentModeChipDismissed}
          skipEditorSyncRef={skipEditorSyncRef}
          onSegmentsNormalized={handleSegmentsNormalized}
          onAgentModeChipDismissChange={onAgentModeChipDismissChange}
          onAgentModeChange={onAgentModeChange}
        />
        <LoopChipPlugin
          loopEnabled={loopEnabled}
          agentMode={agentMode}
          agentModeChipDismissed={agentModeChipDismissed}
          skipEditorSyncRef={skipEditorSyncRef}
          onSegmentsNormalized={handleSegmentsNormalized}
          onLoopEnabledChange={onLoopEnabledChange}
        />
        <ComposerCommandsPlugin
          segmentsRef={segmentsRef}
          commitSegments={commitSegments}
        />
        <ComposerClipboardPlugin
          segmentsRef={segmentsRef}
          commitSegments={commitSegments}
          contentEditableRef={contentEditableRef}
          onPaste={onPaste}
        />
        <SlashSelectionPlugin
          contentEditableRef={contentEditableRef}
          reportSelectionChange={reportSelectionChange}
          enabled={Boolean(onSelectionChange)}
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
