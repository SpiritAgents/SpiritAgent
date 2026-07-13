import {
  STATIC_SLASH_COMMANDS,
  type SkillSlashSuggestion,
} from '@/lib/skill-slash'

export type ActionPaletteTranslate = (key: string) => string

export type NewSessionActionPaletteItem = {
  id: 'action:new-session'
  kind: 'new-session'
  labelKey: 'sidebar.newSession'
}

export type ActionPaletteItem = NewSessionActionPaletteItem | SkillSlashSuggestion

const NEW_SESSION_ITEM: NewSessionActionPaletteItem = {
  id: 'action:new-session',
  kind: 'new-session',
  labelKey: 'sidebar.newSession',
}

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase())
}

function actionPaletteSearchText(item: ActionPaletteItem, t: ActionPaletteTranslate): string {
  if (item.kind === 'new-session') {
    return t(item.labelKey)
  }

  const parts = [item.name, item.alias.slice(1)]
  if (item.descriptionKey) {
    parts.push(t(item.descriptionKey))
  }
  if (item.description) {
    parts.push(item.description)
  }
  return parts.join(' ')
}

export function buildActionPaletteItems(
  query: string,
  t: ActionPaletteTranslate,
): ActionPaletteItem[] {
  const all: ActionPaletteItem[] = [NEW_SESSION_ITEM, ...STATIC_SLASH_COMMANDS]
  const trimmed = query.trim()
  if (!trimmed) {
    return all
  }

  return all.filter((item) => matchesQuery(actionPaletteSearchText(item, t), trimmed))
}

export function isNewSessionAction(
  item: ActionPaletteItem,
): item is NewSessionActionPaletteItem {
  return item.kind === 'new-session'
}
