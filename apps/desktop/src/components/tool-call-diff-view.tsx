import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Diff,
  Hunk,
  markEdits,
  parseDiff,
  tokenize,
  type HunkTokens,
} from 'react-diff-view';
import type { HunkData } from 'react-diff-view';
import 'react-diff-view/style/index.css';

import { buildToolCallUnifiedDiff } from '@/lib/tool-call-unified-diff';
import { refractorLanguageForPath, toolDiffRefractor } from '@/lib/refractor-tool-diff';

import '@/styles/tool-call-diff-view.css';

const TOKENIZE_DEBOUNCE_MS = 32;

export type ToolCallDiffViewProps = {
  relativePath: string;
  languageId: string;
  original: string;
  modified: string;
  /** 流式写入时滚到末行 */
  followTail?: boolean;
};

function tokenizeHunks(
  hunks: HunkData[],
  original: string,
  languageId: string,
): HunkTokens | null {
  if (hunks.length === 0) {
    return null;
  }

  const enhancers = [markEdits(hunks, { type: 'block' })];
  const language = refractorLanguageForPath(languageId);

  if (language) {
    return tokenize(hunks, {
      highlight: true,
      refractor: toolDiffRefractor,
      language,
      oldSource: original,
      enhancers,
    });
  }

  return tokenize(hunks, {
    highlight: false,
    enhancers,
  });
}

export function ToolCallDiffView({
  relativePath,
  languageId,
  original,
  modified,
  followTail = false,
}: ToolCallDiffViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const parsedFile = useMemo(() => {
    const diffText = buildToolCallUnifiedDiff(relativePath, original, modified);
    const files = parseDiff(diffText, { nearbySequences: 'zip' });
    return files[0];
  }, [relativePath, original, modified]);

  const hunks = parsedFile?.hunks ?? [];
  const diffType = parsedFile?.type ?? 'modify';

  const [tokens, setTokens] = useState<HunkTokens | null>(() =>
    tokenizeHunks(hunks, original, languageId),
  );

  useEffect(() => {
    if (followTail) {
      const timer = window.setTimeout(() => {
        setTokens(tokenizeHunks(hunks, original, languageId));
      }, TOKENIZE_DEBOUNCE_MS);
      return () => window.clearTimeout(timer);
    }
    setTokens(tokenizeHunks(hunks, original, languageId));
    return undefined;
  }, [followTail, hunks, original, languageId]);

  useEffect(() => {
    if (!followTail || !scrollRef.current) {
      return;
    }
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight;
  }, [followTail, modified, tokens]);

  if (hunks.length === 0) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border/20 bg-background p-2 font-mono text-xs leading-relaxed text-muted-foreground">
        {modified || original}
      </pre>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="tool-call-diff h-[min(420px,50vh)] min-h-[120px] w-full min-w-0 overflow-auto rounded-md border border-border/20 bg-background"
      data-tool-diff-path={relativePath}
    >
      <Diff
        viewType="unified"
        diffType={diffType}
        hunks={hunks}
        tokens={tokens}
        gutterType="none"
      >
        {(renderedHunks) =>
          renderedHunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
        }
      </Diff>
    </div>
  );
}
