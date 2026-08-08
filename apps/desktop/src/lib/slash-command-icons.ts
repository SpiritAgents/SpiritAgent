import type { LucideIcon } from "lucide-react";
import {
  Bug,
  ClipboardList,
  FoldVertical,
  GitFork,
  MessageCircleQuestionMark,
  MessageSquare,
  Repeat,
  ScrollText,
  Sparkles,
} from "lucide-react";

import type { SkillSlashSuggestionKind } from "@/lib/skill-slash";

export const SLASH_SUGGESTION_ICONS: Record<SkillSlashSuggestionKind, LucideIcon> = {
  "export-session": ScrollText,
  compact: FoldVertical,
  fork: GitFork,
  "side-chat": MessageSquare,
  loop: Repeat,
  plan: ClipboardList,
  ask: MessageCircleQuestionMark,
  debug: Bug,
  skill: Sparkles,
};
