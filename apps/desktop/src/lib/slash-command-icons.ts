import type { LucideIcon } from 'lucide-react'
import {
  Bug,
  CircleHelp,
  ClipboardList,
  FoldVertical,
  GitFork,
  MessageSquare,
  Repeat,
  ScrollText,
  Sparkles,
} from 'lucide-react'

import type { SkillSlashSuggestionKind } from '@/lib/skill-slash'

export const SLASH_SUGGESTION_ICONS: Record<SkillSlashSuggestionKind, LucideIcon> = {
  'log-session': ScrollText,
  compact: FoldVertical,
  fork: GitFork,
  'side-chat': MessageSquare,
  loop: Repeat,
  plan: ClipboardList,
  ask: CircleHelp,
  debug: Bug,
  skill: Sparkles,
}
