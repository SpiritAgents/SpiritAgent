import { LOOP_CHIP_CLASS } from "@/lib/loop-chip-styles";
import { ChipIconSvg, ChipShell } from "@/components/composer-lexical/chips/chip-shell";

type LoopChipProps = {
  label?: string;
};

export function LoopChip({ label = "Loop" }: LoopChipProps) {
  return (
    <ChipShell data-chip-kind="loop" className={LOOP_CHIP_CLASS} aria-label={label}>
      <ChipIconSvg>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </ChipIconSvg>
      {label}
    </ChipShell>
  );
}
