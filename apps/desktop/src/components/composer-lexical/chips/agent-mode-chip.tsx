import { ASK_CHIP_CLASS } from "@/lib/ask-chip-styles";
import { DEBUG_CHIP_CLASS } from "@/lib/debug-chip-styles";
import { PLAN_CHIP_CLASS } from "@/lib/plan-chip-styles";
import { ChipIconSvg, ChipShell } from "@/components/composer-lexical/chips/chip-shell";

type AgentModeChipProps = {
  kind: "plan" | "ask" | "debug";
  label?: string;
};

const CLASS_BY_KIND = {
  plan: PLAN_CHIP_CLASS,
  ask: ASK_CHIP_CLASS,
  debug: DEBUG_CHIP_CLASS,
} as const;

const DEFAULT_LABEL = {
  plan: "Plan",
  ask: "Ask",
  debug: "Debug",
} as const;

function PlanIcon() {
  return (
    <ChipIconSvg>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
      <path d="M8 12h8" />
      <path d="M8 16h8" />
      <path d="M8 8h8" />
    </ChipIconSvg>
  );
}

function AskIcon() {
  return (
    <ChipIconSvg>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </ChipIconSvg>
  );
}

function DebugIcon() {
  return (
    <ChipIconSvg>
      <path d="M12 12h.01" />
      <path d="M8 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16" />
      <path d="M3 7h18" />
      <path d="M3 11h18" />
      <path d="M3 15h18" />
    </ChipIconSvg>
  );
}

const ICON_BY_KIND = {
  plan: PlanIcon,
  ask: AskIcon,
  debug: DebugIcon,
} as const;

export function AgentModeChip({ kind, label }: AgentModeChipProps) {
  const resolvedLabel = label ?? DEFAULT_LABEL[kind];
  const Icon = ICON_BY_KIND[kind];
  return (
    <ChipShell
      data-chip-kind={kind}
      className={CLASS_BY_KIND[kind]}
      aria-label={resolvedLabel}
    >
      <Icon />
      {resolvedLabel}
    </ChipShell>
  );
}
