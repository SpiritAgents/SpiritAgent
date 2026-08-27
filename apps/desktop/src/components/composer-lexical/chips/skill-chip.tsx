import { SKILL_CHIP_CLASS } from "@/lib/skill-chip-styles";
import { ChipLeadingSpacer, ChipShell } from "@/components/composer-lexical/chips/chip-shell";
import { NavigableChipLabel } from "@/contexts/composer-chip-navigate-context";

type SkillChipProps = {
  alias: string;
};

export function SkillChip({ alias }: SkillChipProps) {
  return (
    <ChipShell data-chip-kind="skill" className={SKILL_CHIP_CLASS} aria-label={alias}>
      <ChipLeadingSpacer />
      <NavigableChipLabel target={{ kind: "skill", alias }}>{alias}</NavigableChipLabel>
    </ChipShell>
  );
}
