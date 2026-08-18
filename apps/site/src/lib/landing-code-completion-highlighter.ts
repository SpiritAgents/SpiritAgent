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
        { default: themeGithubLight },
      ] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
        import("@shikijs/langs/typescript"),
        import("@shikijs/themes/github-dark"),
        import("@shikijs/themes/github-light"),
      ]);

      return createHighlighterCore({
        themes: [themeGithubDark, themeGithubLight],
        langs: [langTypescript],
        engine: createJavaScriptRegexEngine(),
      });
    })();
  }

  return highlighterPromise;
}

export async function highlightLandingTypeScript(code: string): Promise<string> {
  const highlighter = await getHighlighter();
  // Dual-theme output emits --shiki-light/--shiki-dark variables, switched by html.dark in index.css
  return highlighter.codeToHtml(code, {
    lang: "typescript",
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
  });
}

export function preloadLandingCodeHighlighter(): void {
  void getHighlighter();
}
