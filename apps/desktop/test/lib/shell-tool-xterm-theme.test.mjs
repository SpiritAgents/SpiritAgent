import assert from "node:assert/strict";
import { test } from "node:test";

import { buildShellToolMonochromeTheme } from "../../src/lib/shell-tool-xterm-theme.ts";

test("buildShellToolMonochromeTheme forces every ANSI slot to the same foreground", () => {
  const theme = buildShellToolMonochromeTheme("#a1a1a1", "#333333");
  assert.equal(theme.foreground, "#a1a1a1");
  assert.equal(theme.background, "#00000000");
  assert.equal(theme.cursor, "#00000000");
  assert.equal(theme.selectionBackground, "#333333");
  assert.equal(theme.red, "#a1a1a1");
  assert.equal(theme.green, "#a1a1a1");
  assert.equal(theme.brightCyan, "#a1a1a1");
  assert.equal(theme.brightWhite, "#a1a1a1");
});
