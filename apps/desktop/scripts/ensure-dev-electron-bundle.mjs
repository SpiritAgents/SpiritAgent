#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDevElectronBundle } from "./dev-electron-bundle.mjs";

if (process.platform !== "darwin") {
  process.exit(0);
}

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

let electronExec;
try {
  electronExec = require("electron");
} catch (err) {
  console.error("[dev] electron is not installed:", err);
  process.exit(1);
}

let electronVersion;
try {
  electronVersion = JSON.parse(
    fs.readFileSync(require.resolve("electron/package.json"), "utf8"),
  ).version;
} catch (err) {
  console.error("[dev] could not read electron version:", err);
  process.exit(1);
}

try {
  ensureDevElectronBundle({
    desktopRoot,
    electronExec,
    electronVersion,
    icnsPath: path.join(desktopRoot, "build", "icon.icns"),
    log: console.log,
  });
} catch (err) {
  console.error("[dev] failed to brand Electron.app:", err);
  process.exit(1);
}
