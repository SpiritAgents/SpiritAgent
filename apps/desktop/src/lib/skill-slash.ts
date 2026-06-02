import type { DesktopSkillListItem } from '@/types'

export type SkillSlashSuggestionKind =
  | 'create-skill'
  | 'log-session'
  | 'compact'
  | 'loop'
  | 'skill'

export interface SkillSlashSuggestion {
  id: string
  alias: string
  name: string
  description?: string
  descriptionKey?: string
  kind: SkillSlashSuggestionKind
}

export interface SkillSlashMatch {
  skillName: string
  extraNote: string
}

export function skillSlashAlias(skillName: string): string {
  return `/${skillName}`
}

export const CREATE_SKILL_SLASH_ALIAS = '/create-skill'
export const LOG_SESSION_SLASH_ALIAS = '/log-session'
export const COMPACT_SLASH_ALIAS = '/compact'
export const LOOP_SLASH_ALIAS = '/loop'

const STATIC_SLASH_SUGGESTIONS: readonly SkillSlashSuggestion[] = [
  {
    id: 'command:create-skill',
    alias: CREATE_SKILL_SLASH_ALIAS,
    name: 'create-skill',
    descriptionKey: 'slash.createSkill',
    kind: 'create-skill',
  },
  {
    id: 'command:log-session',
    alias: LOG_SESSION_SLASH_ALIAS,
    name: 'log-session',
    descriptionKey: 'slash.logSession',
    kind: 'log-session',
  },
  {
    id: 'command:compact',
    alias: COMPACT_SLASH_ALIAS,
    name: 'compact',
    descriptionKey: 'slash.compact',
    kind: 'compact',
  },
  {
    id: 'command:loop',
    alias: LOOP_SLASH_ALIAS,
    name: 'loop',
    descriptionKey: 'slash.loop',
    kind: 'loop',
  },
] as const

export function currentSkillSlashQuery(input: string): string | undefined {
  if (!input.startsWith('/') || input.includes('\n')) {
    return undefined
  }

  const trimmedRight = input.trimEnd()
  if (!trimmedRight) {
    return undefined
  }

  return trimmedRight
}

export function buildSkillSlashSuggestions(
  query: string,
  skills: readonly DesktopSkillListItem[],
): SkillSlashSuggestion[] {
  const normalized = query.trim().toLowerCase()
  const staticMatches = STATIC_SLASH_SUGGESTIONS.filter((item) =>
    item.alias.toLowerCase().startsWith(normalized),
  )
  const skillMatches = skills
    .filter((skill) => skillSlashAlias(skill.name).toLowerCase().startsWith(normalized))
    .map(
      (skill): SkillSlashSuggestion => ({
        id: `skill:${skill.id}`,
        alias: skillSlashAlias(skill.name),
        name: skill.name,
        description: skill.description,
        kind: 'skill',
      }),
    )

  return [...staticMatches, ...skillMatches]
}

export function matchSkillSlashInput(
  input: string,
  skills: readonly DesktopSkillListItem[],
): SkillSlashMatch | undefined {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) {
    return undefined
  }

  const firstLine = trimmed.split('\n')[0]?.trim() ?? ''
  const spaceIndex = firstLine.indexOf(' ')
  const alias = spaceIndex >= 0 ? firstLine.slice(0, spaceIndex) : firstLine
  const extraNote = spaceIndex >= 0 ? firstLine.slice(spaceIndex + 1).trim() : ''

  const skill = skills.find((item) => skillSlashAlias(item.name) === alias)
  if (!skill) {
    return undefined
  }

  return {
    skillName: skill.name,
    extraNote,
  }
}

export function isCreateSkillSlashInput(input: string): boolean {
  return input.trim() === CREATE_SKILL_SLASH_ALIAS
}

export function isLogSessionSlashInput(input: string): boolean {
  return input.trim() === LOG_SESSION_SLASH_ALIAS
}

export function isCompactSlashInput(input: string): boolean {
  return input.trim() === COMPACT_SLASH_ALIAS
}

export function isLoopSlashInput(input: string): boolean {
  const trimmed = input.trim()
  return trimmed === LOOP_SLASH_ALIAS || trimmed.startsWith(`${LOOP_SLASH_ALIAS} `)
}
