import { useEffect, useMemo, useState } from 'react';
import type { TokensResult } from 'shiki';

import type { DiffDisplayLine } from '@/lib/diff-display-lines';
import { plainHighlightResult } from '@/lib/spirit-message-code-highlight';
import { spiritShikiCodePlugin } from '@/lib/spirit-shiki-code-plugin';
import { SPIRIT_SHIKI_PLUS_THEMES } from '@/lib/spirit-shiki-themes';
import { shikiLanguageForMonacoId } from '@/lib/shiki-language-for-monaco';

const DIFF_HIGHLIGHT_THEMES = [...SPIRIT_SHIKI_PLUS_THEMES] as ['light-plus', 'dark-plus'];

export type DiffLineTokens = TokensResult['tokens'][number];

function plainTokensForLine(content: string): DiffLineTokens {
  return plainHighlightResult(content).tokens[0] ?? [];
}

export function plainDiffLineTokens(lines: DiffDisplayLine[]): DiffLineTokens[] {
  return lines.map((line) => plainTokensForLine(line.content));
}

function highlightDiffLine(content: string, language: string): Promise<DiffLineTokens> {
  return new Promise((resolve) => {
    const syncResult = spiritShikiCodePlugin.highlight(
      { code: content, language, themes: DIFF_HIGHLIGHT_THEMES },
      (highlighted) => {
        resolve((highlighted as TokensResult).tokens[0] ?? plainTokensForLine(content));
      },
    );

    if (syncResult) {
      resolve((syncResult as TokensResult).tokens[0] ?? plainTokensForLine(content));
    }
  });
}

export function useDiffLineHighlight(lines: DiffDisplayLine[], languageId: string): DiffLineTokens[] {
  const plainTokens = useMemo(() => plainDiffLineTokens(lines), [lines]);
  const [highlightedTokens, setHighlightedTokens] = useState(plainTokens);
  const shikiLanguage = useMemo(() => shikiLanguageForMonacoId(languageId), [languageId]);

  useEffect(() => {
    setHighlightedTokens(plainTokens);
    if (!shikiLanguage) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      const results = await Promise.all(
        lines.map((line) => highlightDiffLine(line.content, shikiLanguage)),
      );
      if (!cancelled) {
        setHighlightedTokens(results);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lines, plainTokens, shikiLanguage]);

  return highlightedTokens;
}
