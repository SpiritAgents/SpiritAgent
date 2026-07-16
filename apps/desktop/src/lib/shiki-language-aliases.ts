const LANGUAGE_ALIASES: Record<string, string> = {
  jsonc: 'json',
  md: 'markdown',
  mdx: 'markdown',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  yml: 'yaml',
  shell: 'shell',
  sh: 'shell',
  ps1: 'powershell',
  toml: 'ini',
  plaintext: '',
};

/** monacoLanguageId → Shiki 语法别名（不含 supportsLanguage 校验）。 */
export function resolveShikiLanguageAlias(languageId: string): string | undefined {
  const normalized = languageId.trim().toLowerCase();
  if (!normalized || normalized === 'plaintext') {
    return undefined;
  }

  const aliased = LANGUAGE_ALIASES[normalized] ?? normalized;
  return aliased || undefined;
}
