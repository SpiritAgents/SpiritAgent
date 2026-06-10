import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeModeId, AVAILABLE_MODES } from '../src/types.js';

// --- normalizeModeId ---

test('normalizeModeId: valid modes pass through', () => {
  assert.equal(normalizeModeId('agent'), 'agent');
  assert.equal(normalizeModeId('plan'), 'plan');
  assert.equal(normalizeModeId('ask'), 'ask');
  assert.equal(normalizeModeId('debug'), 'debug');
});

test('normalizeModeId: invalid mode falls back to agent', () => {
  assert.equal(normalizeModeId('unknown'), 'agent');
  assert.equal(normalizeModeId(''), 'agent');
  assert.equal(normalizeModeId('architect'), 'agent');
});

// --- AVAILABLE_MODES ---

test('AVAILABLE_MODES has 4 modes', () => {
  assert.equal(AVAILABLE_MODES.length, 4);
});

test('AVAILABLE_MODES contains agent, plan, ask, debug', () => {
  const ids = AVAILABLE_MODES.map((m) => m.id);
  assert.ok(ids.includes('agent'));
  assert.ok(ids.includes('plan'));
  assert.ok(ids.includes('ask'));
  assert.ok(ids.includes('debug'));
});

test('AVAILABLE_MODES each mode has id, name, description', () => {
  for (const mode of AVAILABLE_MODES) {
    assert.ok(typeof mode.id === 'string');
    assert.ok(typeof mode.name === 'string');
    assert.ok(typeof mode.description === 'string');
    assert.ok(mode.id.length > 0);
    assert.ok(mode.name.length > 0);
    assert.ok(mode.description.length > 0);
  }
});
