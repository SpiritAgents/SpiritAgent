import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ExtensionHostKind } from "../storage.js";
import {
  installPreparedExtensionDirectory,
  readPreparedExtensionManifestDirectory,
  type HostExtensionManager,
  type HostInstalledExtension,
} from "../extensions.js";
import { BUILT_IN_EXTENSION_IDS } from "./extension-ids.js";
import { loadBuiltInState } from "./state.js";

export { BUILT_IN_EXTENSION_IDS, isBuiltInExtensionId } from "./extension-ids.js";
export type { BuiltInExtensionId } from "./extension-ids.js";

export function resolveBuiltInExtensionsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "../../built-in/extensions");
}

export interface EnsureBuiltInExtensionsRequest {
  spiritDataDir: string;
  hostKind: ExtensionHostKind;
  manager: Pick<HostExtensionManager, "list" | "installPreparedDirectory">;
}

async function listBuiltInExtensionTemplateDirs(): Promise<string[]> {
  const root = resolveBuiltInExtensionsRoot();
  if (!existsSync(root)) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const directories: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directoryPath = path.join(root, entry.name);
    if (!existsSync(path.join(directoryPath, "package.json"))) {
      continue;
    }
    directories.push(directoryPath);
  }
  return directories.sort((left, right) => left.localeCompare(right, "en"));
}

export async function ensureBuiltInExtensions(
  request: EnsureBuiltInExtensionsRequest,
): Promise<readonly HostInstalledExtension[]> {
  if (BUILT_IN_EXTENSION_IDS.length === 0) {
    return [];
  }

  const allowedIds = new Set<string>(BUILT_IN_EXTENSION_IDS);
  const { spiritDataDir, hostKind } = request;
  const state = await loadBuiltInState(spiritDataDir);
  const removed = new Set(state.removedExtensionIds);
  const installed = await request.manager.list();
  const installedIds = new Set(installed.map((item) => item.id));
  const seeded: HostInstalledExtension[] = [];

  for (const templateDir of await listBuiltInExtensionTemplateDirs()) {
    let manifest;
    try {
      manifest = await readPreparedExtensionManifestDirectory(templateDir);
    } catch {
      continue;
    }

    if (!allowedIds.has(manifest.id)) {
      continue;
    }
    if (!manifest.supportedHosts.includes(hostKind)) {
      continue;
    }
    if (removed.has(manifest.id) || installedIds.has(manifest.id)) {
      continue;
    }

    const next = await installPreparedExtensionDirectory(
      { spiritDataDir, hostKind },
      {
        preparedDirectoryPath: templateDir,
        installSource: "built-in",
        replaceExisting: false,
      },
    );
    installedIds.add(next.id);
    seeded.push(next);
  }

  return seeded;
}
