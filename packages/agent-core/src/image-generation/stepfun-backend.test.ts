import assert from 'node:assert/strict';
import test from 'node:test';

import { mapStepfunImageSize } from './stepfun-backend.js';

test('mapStepfunImageSize swaps dimensions for step-image-edit-2', () => {
  assert.equal(mapStepfunImageSize('step-image-edit-2', '1024x768'), '768x1024');
  assert.equal(mapStepfunImageSize('step-2x-large', '1024x768'), '1024x768');
});

test('mapStepfunImageSize returns trimmed custom size when pattern does not match', () => {
  assert.equal(mapStepfunImageSize('step-2x-large', ' auto '), 'auto');
});
