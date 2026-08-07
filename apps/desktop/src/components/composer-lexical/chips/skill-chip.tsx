import { SKILL_CHIP_CLASS } from "@/lib/skill-chip-styles";
import { ChipLeadingSpacer, ChipShell } from "@/components/composer-lexical/chips/chip-shell";

type SkillChipProps = {
  alias: string;
};

export function SkillChip({ alias }: SkillChipProps) {
  return (
    <ChipShell data-chip-kind="skill" className={SKILL_CHIP_CLASS} aria-label={alias}>
      <ChipLeadingSpacer />
      {alias}
    </ChipShell>
  );
}
