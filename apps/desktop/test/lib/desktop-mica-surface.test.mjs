import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DESKTOP_COMPOSER_SURFACE_BACKDROP,
  DESKTOP_COMPOSER_SURFACE_MICA_TINT,
  DESKTOP_MICA_BROWSER_TINT_CLASS,
  DESKTOP_MICA_CONTENT_TINT_CLASS,
  DESKTOP_MICA_TERMINAL_TINT_CLASS,
  DESKTOP_MICA_WORKSPACE_TAB_SELECTED_TINT_CLASS,
  DESKTOP_FILES_DETAIL_PREVIEW_TINT_CLASS,
  desktopComposerChipSurfaceClass,
  desktopComposerSurfaceBackdropClass,
  desktopMicaBrowserTintClass,
  desktopMicaFileDetailSurfaceClass,
  desktopMicaTerminalTintClass,
  desktopMicaTintClass,
  desktopMicaTintInnerClass,
  desktopMicaWorkspaceTabSelectedClass,
  desktopFullscreenOverlayTintClass,
} from '../../src/lib/desktop-mica-surface.ts';

test('desktopMicaTintClass returns solid background when Mica is off', () => {
  assert.equal(desktopMicaTintClass(false), 'bg-background');
});

test('desktopMicaTintClass returns semi-transparent tint without backdrop-blur when Mica is on', () => {
  const cls = desktopMicaTintClass(true);
  assert.equal(cls, DESKTOP_MICA_CONTENT_TINT_CLASS);
  assert.match(cls, /bg-background\//);
  assert.doesNotMatch(cls, /backdrop-blur/);
});

test('desktopMicaTintInnerClass is transparent under Mica', () => {
  assert.equal(desktopMicaTintInnerClass(false), 'bg-background');
  assert.equal(desktopMicaTintInnerClass(true), 'bg-transparent');
});

test('desktopFullscreenOverlayTintClass drops tint while exiting to avoid double stacking', () => {
  assert.equal(desktopFullscreenOverlayTintClass(false, false), 'bg-background');
  assert.equal(desktopFullscreenOverlayTintClass(true, false), DESKTOP_MICA_CONTENT_TINT_CLASS);
  assert.equal(desktopFullscreenOverlayTintClass(false, true), 'bg-transparent');
  assert.equal(desktopFullscreenOverlayTintClass(true, true), 'bg-transparent');
});

test('desktopMicaBrowserTintClass uses higher opacity than main content tint', () => {
  assert.equal(desktopMicaBrowserTintClass(true), DESKTOP_MICA_BROWSER_TINT_CLASS);
  assert.notEqual(DESKTOP_MICA_BROWSER_TINT_CLASS, DESKTOP_MICA_CONTENT_TINT_CLASS);
});

test('desktopMicaTerminalTintClass keeps high opacity for readability', () => {
  assert.equal(desktopMicaTerminalTintClass(true), DESKTOP_MICA_TERMINAL_TINT_CLASS);
  assert.match(DESKTOP_MICA_TERMINAL_TINT_CLASS, /\/87$/);
});

test('desktopMicaWorkspaceTabSelectedClass uses light tint when Mica is on', () => {
  assert.equal(desktopMicaWorkspaceTabSelectedClass(false), 'bg-background');
  assert.equal(desktopMicaWorkspaceTabSelectedClass(true), DESKTOP_MICA_WORKSPACE_TAB_SELECTED_TINT_CLASS);
});

test('desktopMicaFileDetailSurfaceClass avoids stacking tint under Mica', () => {
  assert.equal(desktopMicaFileDetailSurfaceClass(false), DESKTOP_FILES_DETAIL_PREVIEW_TINT_CLASS);
  assert.equal(desktopMicaFileDetailSurfaceClass(true), 'bg-transparent');
});

test('desktopComposerSurfaceBackdropClass keeps glass when Mica is off', () => {
  assert.equal(desktopComposerSurfaceBackdropClass(false), DESKTOP_COMPOSER_SURFACE_BACKDROP);
  assert.match(DESKTOP_COMPOSER_SURFACE_BACKDROP, /backdrop-blur/);
  assert.match(DESKTOP_COMPOSER_SURFACE_BACKDROP, /dark:bg-input/);
});

test('desktopComposerSurfaceBackdropClass uses translucent tint without blur when Mica is on', () => {
  assert.equal(desktopComposerSurfaceBackdropClass(true), DESKTOP_COMPOSER_SURFACE_MICA_TINT);
  assert.doesNotMatch(DESKTOP_COMPOSER_SURFACE_MICA_TINT, /backdrop-blur/);
  assert.equal(DESKTOP_COMPOSER_SURFACE_MICA_TINT, 'bg-background/70');
});

test('desktopComposerChipSurfaceClass follows composer surface mica tint/glass', () => {
  assert.match(desktopComposerChipSurfaceClass(false), /backdrop-blur/);
  assert.doesNotMatch(desktopComposerChipSurfaceClass(true), /backdrop-blur/);
  assert.match(desktopComposerChipSurfaceClass(true), /bg-background\/70/);
});
