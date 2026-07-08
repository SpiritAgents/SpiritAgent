import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_SESSION_GREETING_WORKSPACE_VARIANT,
  activeEmptySessionGreetingNavigationVariant,
  beginEmptySessionGreetingNavigation,
  cancelEmptySessionGreetingNavigation,
  commitEmptySessionGreetingNavigation,
  emptySessionGreetingPool,
  isWorkspaceGreetingVariant,
  pickEmptySessionGreetingVariant,
  resetEmptySessionGreetingStateForTests,
  resolveEmptySessionGreeting,
  resolveEmptySessionGreetingVariantForSession,
} from '../../src/lib/empty-session-greeting.ts';

test('emptySessionGreetingPool excludes workspace variant when disabled', () => {
  const pool = emptySessionGreetingPool(false);
  assert.equal(pool.length, 2);
  assert.ok(!pool.includes(EMPTY_SESSION_GREETING_WORKSPACE_VARIANT));
});

test('emptySessionGreetingPool includes workspace variant when enabled', () => {
  const pool = emptySessionGreetingPool(true);
  assert.equal(pool.length, 3);
  assert.ok(pool.includes(EMPTY_SESSION_GREETING_WORKSPACE_VARIANT));
});

test('pickEmptySessionGreetingVariant never picks workspace when disabled', () => {
  for (let i = 0; i < 20; i += 1) {
    const variant = pickEmptySessionGreetingVariant({
      includeWorkspaceVariants: false,
      random: () => i / 20,
    });
    assert.ok(!isWorkspaceGreetingVariant(variant));
  }
});

test('pickEmptySessionGreetingVariant can pick workspace when enabled', () => {
  const variant = pickEmptySessionGreetingVariant({
    includeWorkspaceVariants: true,
    random: () => 0.99,
  });
  assert.equal(variant, EMPTY_SESSION_GREETING_WORKSPACE_VARIANT);
});

test('beginEmptySessionGreetingNavigation exposes pending variant until commit', () => {
  resetEmptySessionGreetingStateForTests();
  const variant = beginEmptySessionGreetingNavigation(7, {
    includeWorkspaceVariants: true,
    random: () => 0.99,
  });
  assert.equal(variant, EMPTY_SESSION_GREETING_WORKSPACE_VARIANT);
  assert.equal(activeEmptySessionGreetingNavigationVariant(7), variant);
  commitEmptySessionGreetingNavigation(7, 'session-b');
  assert.equal(activeEmptySessionGreetingNavigationVariant(7), null);
  assert.equal(
    resolveEmptySessionGreetingVariantForSession('session-b', {
      includeWorkspaceVariants: true,
      random: () => 0,
    }),
    variant,
  );
});

test('cancelEmptySessionGreetingNavigation drops pending variant', () => {
  resetEmptySessionGreetingStateForTests();
  beginEmptySessionGreetingNavigation(9, {
    includeWorkspaceVariants: false,
    random: () => 0,
  });
  cancelEmptySessionGreetingNavigation(9);
  assert.equal(activeEmptySessionGreetingNavigationVariant(9), null);
});

test('resolveEmptySessionGreetingVariantForSession returns stable variant per session key', () => {
  resetEmptySessionGreetingStateForTests();
  const first = resolveEmptySessionGreetingVariantForSession('session-a', {
    includeWorkspaceVariants: true,
    random: () => 0.99,
  });
  const second = resolveEmptySessionGreetingVariantForSession('session-a', {
    includeWorkspaceVariants: false,
    random: () => 0,
  });
  assert.equal(first, EMPTY_SESSION_GREETING_WORKSPACE_VARIANT);
  assert.equal(second, first);
});

test('resolveEmptySessionGreeting passes workspace to t', () => {
  const calls = [];
  const t = (key, options) => {
    calls.push({ key, options });
    return `${key}:${options?.workspace ?? ''}`;
  };
  const resolved = resolveEmptySessionGreeting(t, 'doSomethingIn', 'SpiritAgent');
  assert.equal(resolved, 'app.emptySessionGreeting.doSomethingIn:SpiritAgent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.workspace, 'SpiritAgent');
});
