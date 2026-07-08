import type { RichSegment } from "@/lib/composer-segment-model";

/** Non-text composer segment stored inside a Lexical SpiritChipNode. */
export type SpiritChipPayload = Exclude<RichSegment, { kind: "text" }>;

export function isSpiritChipPayload(value: RichSegment): value is SpiritChipPayload {
  return value.kind !== "text";
}
