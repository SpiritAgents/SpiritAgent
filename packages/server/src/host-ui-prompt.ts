/** Max chars accepted for session.create hostUiPromptSection (Desktop Markdown hints). */
export const HOST_UI_PROMPT_SECTION_MAX_CHARS = 4000;

export function normalizeHostUiPromptSection(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > HOST_UI_PROMPT_SECTION_MAX_CHARS) {
    return undefined;
  }
  return trimmed;
}

export function joinHostPromptSections(
  ...sections: Array<string | undefined>
): string | undefined {
  const parts = sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section));
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}
