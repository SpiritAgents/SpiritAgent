import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildShellToolMonochromeTheme,
  stripAnsiSgrSequences,
} from "../../src/lib/shell-tool-xterm-theme.ts";

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

test("stripAnsiSgrSequences removes truecolor SGR but keeps erase-line CSI", () => {
  const input = "\x1b[38;2;225;80;80;1m×\x1b[0m \x1b[38;2;92;157;255;1mpath\x1b[0m\x1b[2K\rnext";
  const out = stripAnsiSgrSequences(input);
  assert.equal(out.includes("\x1b[38;2"), false);
  assert.equal(out.includes("\x1b[0m"), false);
  assert.equal(out.includes("\x1b[2K"), true);
  assert.equal(out.includes("×"), true);
  assert.equal(out.includes("path"), true);
  assert.equal(out.includes("\rnext"), true);
});
