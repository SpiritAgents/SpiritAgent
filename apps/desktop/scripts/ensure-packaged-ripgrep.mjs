#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const destVscode = path.join(desktopRoot, "node_modules", "@vscode");

/** @vscode/ripgrep ships the rg binary via optionalDependency platform packages; under the pnpm hoisted layout it often lives only in the repo root node_modules. */
function resolveHoistedVscode() {
  const desktopVscode = path.join(desktopRoot, "node_modules", "@vscode");
  if (fs.existsSync(desktopVscode)) {
    return desktopVscode;
  }
  return path.join(repoRoot, "node_modules", "@vscode");
}

function copyRipgrepPackages() {
  const hoistedVscode = resolveHoistedVscode();
  if (!fs.existsSync(hoistedVscode)) {
    console.error("[pack] missing hoisted @vscode at", hoistedVscode);
    process.exit(1);
  }

  if (path.resolve(hoistedVscode) === path.resolve(destVscode)) {
    console.log("[pack] @vscode/ripgrep already under desktop node_modules, skip copy");
    return;
  }

  const names = fs
    .readdirSync(hoistedVscode)
    .filter((name) => name === "ripgrep" || name.startsWith("ripgrep-"));
  if (names.length === 0) {
    console.error("[pack] no @vscode/ripgrep packages under", hoistedVscode);
    process.exit(1);
  }

  const platformPkg = `ripgrep-${process.platform}-${process.arch}`;
  if (!names.includes(platformPkg)) {
    console.error(`[pack] missing ${platformPkg} for this build host; found: ${names.join(", ")}`);
    process.exit(1);
  }

  fs.mkdirSync(destVscode, { recursive: true });
  for (const name of names) {
    const src = path.join(hoistedVscode, name);
    const dest = path.join(destVscode, name);
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`[pack] copied @vscode/${name}`);
  }
}

copyRipgrepPackages();
