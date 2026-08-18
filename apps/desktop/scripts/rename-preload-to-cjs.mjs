import { existsSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "dist-electron", "electron", "preload.js");
const to = join(root, "dist-electron", "electron", "preload.cjs");

/** When build:electron runs twice concurrently, the first finisher already renamed it and the other only sees preload.cjs — treat as success */
if (existsSync(to) && !existsSync(from)) {
  console.log("[build] preload.cjs already present (skip rename)");
  process.exit(0);
}

if (!existsSync(from)) {
  console.error("[build] missing preload.js:", from);
  process.exit(1);
}

renameSync(from, to);
console.log("[build] renamed preload.js -> preload.cjs");
