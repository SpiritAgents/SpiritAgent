import assert from 'node:assert/strict';
import test from 'node:test';

import { toolCallPhaseShowsShimmer } from '../../src/lib/tool-call-shimmer.ts';

test('toolCallPhaseShowsShimmer is active until terminal phases', () => {
  assert.equal(toolCallPhaseShowsShimmer('preview'), true);
  assert.equal(toolCallPhaseShowsShimmer('pending-approval'), true);
  assert.equal(toolCallPhaseShowsShimmer('running'), true);
  assert.equal(toolCallPhaseShowsShimmer('succeeded'), false);
  assert.equal(toolCallPhaseShowsShimmer('failed'), false);
});
