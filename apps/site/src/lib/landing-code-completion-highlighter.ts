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
  // 双主题输出 --shiki-light/--shiki-dark 变量，由 index.css 按 html.dark 切换
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
