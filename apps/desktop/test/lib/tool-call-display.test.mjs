import assert from 'node:assert/strict';
import test from 'node:test';

import { toolHasExpandableContent } from '../../src/lib/tool-call-display.ts';
import { toolCallPhaseShowsShimmer } from '../../src/lib/tool-call-shimmer.ts';

test('file diff tools are expandable during preview with streaming args only', () => {
  assert.equal(
    toolHasExpandableContent({
      toolName: 'create_file',
      phase: 'preview',
      headline: '创建',
      detailLines: [],
      streamingArgumentsJson: '{"path":"a.ts"}',
    }),
    true,
  );
});

test('toolCallPhaseShowsShimmer is active until terminal phases', () => {
  assert.equal(toolCallPhaseShowsShimmer('preview'), true);
  assert.equal(toolCallPhaseShowsShimmer('pending-approval'), true);
  assert.equal(toolCallPhaseShowsShimmer('running'), true);
  assert.equal(toolCallPhaseShowsShimmer('succeeded'), false);
  assert.equal(toolCallPhaseShowsShimmer('failed'), false);
});
