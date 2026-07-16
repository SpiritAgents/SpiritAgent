import { spiritShikiCodePlugin } from '@/lib/spirit-shiki-code-plugin';
import { resolveShikiLanguageAlias } from '@/lib/shiki-language-aliases';

/** monacoLanguageId → Shiki bundled language；undefined 表示不高亮。 */
export function shikiLanguageForMonacoId(languageId: string): string | undefined {
  const aliased = resolveShikiLanguageAlias(languageId);
  if (!aliased) {
    return undefined;
  }

  return spiritShikiCodePlugin.supportsLanguage(aliased) ? aliased : undefined;
}
