import assert from "node:assert/strict";
import test from "node:test";

import {
  computeShimmerStopDelayMs,
  SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS,
} from "../../src/lib/spirit-glass-logo-shimmer-cycle.ts";

test("computeShimmerStopDelayMs waits for remainder of current cycle", () => {
  assert.equal(
    computeShimmerStopDelayMs(0, SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS),
    SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS,
  );
  assert.equal(
    computeShimmerStopDelayMs(1000, SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS),
    1900,
  );
  assert.equal(
    computeShimmerStopDelayMs(2800, SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS),
    100,
  );
});

test("computeShimmerStopDelayMs wraps elapsed time by cycle length", () => {
  assert.equal(
    computeShimmerStopDelayMs(SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS + 500, SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS),
    2400,
  );
});
