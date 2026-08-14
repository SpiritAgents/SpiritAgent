import type { HighlighterCore } from "shiki/core";

let highlighterPromise: Promise<HighlighterCore> | null = null;

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [
        { createHighlighterCore },
        { createJavaScriptRegexEngine },
        { default: langTypescript },
        { default: themeGithubDark },
      ] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
        import("@shikijs/langs/typescript"),
        import("@shikijs/themes/github-dark"),
      ]);

      return createHighlighterCore({
        themes: [themeGithubDark],
        langs: [langTypescript],
        engine: createJavaScriptRegexEngine(),
      });
    })();
  }

  return highlighterPromise;
}

export async function highlightLandingTypeScript(code: string): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: "typescript",
    theme: "github-dark",
  });
}

export function preloadLandingCodeHighlighter(): void {
  void getHighlighter();
}
