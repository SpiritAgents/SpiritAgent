#!/usr/bin/env node
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "../..");
export const packNodeModulesDir = path.join(desktopRoot, "..", ".desktop-pack-node-modules");

export async function stagePackagedNodeModules() {
  if (existsSync(packNodeModulesDir)) {
    await rm(packNodeModulesDir, { recursive: true, force: true });
  }
  const result = spawnSync(
    "pnpm",
    ["--filter", "@spiritagent/desktop", "deploy", "--prod", packNodeModulesDir],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`pnpm deploy --prod failed with status ${result.status}`);
  }
  const nodeModules = path.join(packNodeModulesDir, "node_modules");
  if (!existsSync(nodeModules)) {
    throw new Error(`pnpm deploy did not create ${nodeModules}`);
  }
  return nodeModules;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await stagePackagedNodeModules();
}
