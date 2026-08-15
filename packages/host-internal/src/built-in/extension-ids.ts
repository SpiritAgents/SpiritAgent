/**
 * Package ids (`package.json` `name`) for built-in extension templates under
 * `built-in/extensions/`. Keep empty until a real template is added.
 */
export const BUILT_IN_EXTENSION_IDS = [] as const;

export type BuiltInExtensionId = (typeof BUILT_IN_EXTENSION_IDS)[number];

export function isBuiltInExtensionId(extensionId: string): boolean {
  const normalized = extensionId.trim().toLowerCase();
  return (BUILT_IN_EXTENSION_IDS as readonly string[]).includes(normalized);
}
