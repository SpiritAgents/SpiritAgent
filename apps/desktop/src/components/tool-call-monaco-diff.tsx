import { useEffect, useRef } from 'react';

import * as monaco from 'monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';

import { ensureMonacoWorkers } from '@/lib/monaco-environment';
import { syncMonacoThemeFromDocument } from '@/lib/monaco-theme';

export type ToolCallMonacoDiffProps = {
  relativePath: string;
  languageId: string;
  original: string;
  modified: string;
  /** 流式写入时滚到 modified 末行 */
  followTail?: boolean;
};

export function ToolCallMonacoDiff({
  relativePath,
  languageId,
  original,
  modified,
  followTail = false,
}: ToolCallMonacoDiffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const originalModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const modifiedModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const languageRef = useRef(languageId);
  const pathRef = useRef(relativePath);

  useEffect(() => {
    ensureMonacoWorkers();
    const root = containerRef.current;
    if (!root) {
      return;
    }

    syncMonacoThemeFromDocument();
    languageRef.current = languageId;
    pathRef.current = relativePath;

    const originalModel = monaco.editor.createModel(original, languageId);
    const modifiedModel = monaco.editor.createModel(modified, languageId);
    originalModelRef.current = originalModel;
    modifiedModelRef.current = modifiedModel;

    const diffEditor = monaco.editor.createDiffEditor(root, {
      readOnly: true,
      renderSideBySide: false,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'off',
      glyphMargin: false,
      scrollBeyondLastLine: false,
      fontSize: 12,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      renderOverviewRuler: false,
      wordWrap: 'on',
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    });
    diffEditor.setModel({ original: originalModel, modified: modifiedModel });
    diffEditorRef.current = diffEditor;

    const obs = new MutationObserver(() => {
      syncMonacoThemeFromDocument();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      obs.disconnect();
      diffEditor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
      diffEditorRef.current = null;
      originalModelRef.current = null;
      modifiedModelRef.current = null;
    };
    // Mount once per expand; text updates via separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional single mount
  }, []);

  useEffect(() => {
    const originalModel = originalModelRef.current;
    const modifiedModel = modifiedModelRef.current;
    if (!originalModel || !modifiedModel) {
      return;
    }

    if (languageRef.current !== languageId) {
      languageRef.current = languageId;
      monaco.editor.setModelLanguage(originalModel, languageId);
      monaco.editor.setModelLanguage(modifiedModel, languageId);
    }

    if (originalModel.getValue() !== original) {
      originalModel.setValue(original);
    }
    if (modifiedModel.getValue() !== modified) {
      modifiedModel.setValue(modified);
    }

    if (followTail) {
      const lineCount = modifiedModel.getLineCount();
      const editor = diffEditorRef.current?.getModifiedEditor();
      if (editor && lineCount > 0) {
        editor.revealLine(lineCount, monaco.editor.ScrollType.Immediate);
      }
    }
  }, [original, modified, languageId, followTail]);

  return (
    <div
      ref={containerRef}
      className="h-[min(420px,50vh)] min-h-[120px] w-full min-w-0 overflow-hidden rounded-md border border-border/20"
      data-tool-diff-path={pathRef.current}
    />
  );
}
