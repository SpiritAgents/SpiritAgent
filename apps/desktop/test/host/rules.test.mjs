import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";

import {
  buildCreateRuleUserTurn,
  createRuleFile,
  deleteRuleFile,
  parseCreateRuleRequest,
  parseCreateRuleSlashPrompt,
  resolveRuleFilePath,
} from "../../dist-electron/src/host/rules.js";
import { desktopInstructionPaths } from "../../dist-electron/src/host/skills.js";

test("parseCreateRuleRequest accepts user scope prefix", () => {
  const parsed = parseCreateRuleRequest("user cross-repo commit conventions");
  assert.ok(!(parsed instanceof Error));
  assert.equal(parsed.scope, "user");
  assert.equal(parsed.prompt, "cross-repo commit conventions");
});

test("parseCreateRuleRequest prefers compound scope prefixes over short ones", () => {
  const userLevel = parseCreateRuleRequest("user-level cross-repo conventions");
  assert.ok(!(userLevel instanceof Error));
  assert.equal(userLevel.scope, "user");
  assert.equal(userLevel.prompt, "cross-repo conventions");

  const repoLevel = parseCreateRuleRequest("repo-level repo test requirements");
  assert.ok(!(repoLevel instanceof Error));
  assert.equal(repoLevel.scope, "workspace");
  assert.equal(repoLevel.prompt, "repo test requirements");

  const workspaceLevel = parseCreateRuleRequest("workspace-level workspace lint");
  assert.ok(!(workspaceLevel instanceof Error));
  assert.equal(workspaceLevel.scope, "workspace");
  assert.equal(workspaceLevel.prompt, "workspace lint");
});

test("parseCreateRuleSlashPrompt defaults to workspace scope", () => {
  const parsed = parseCreateRuleSlashPrompt("/create-rule write commits in concise English");
  assert.ok(!(parsed instanceof Error));
  assert.equal(parsed.scope, "workspace");
  assert.equal(parsed.prompt, "write commits in concise English");
});

test("buildCreateRuleUserTurn includes workspace root and target path", () => {
  const turn = buildCreateRuleUserTurn("C:/workspace/demo", {
    scope: "workspace",
    prompt: "test",
  });
  assert.match(turn, /workspace_root: C:\/workspace\/demo/);
  assert.match(turn, /rule\.md/);
});

test("createRuleFile writes template and rejects duplicates", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "spirit-rules-create-"));
  const previousAppData = process.env.APPDATA;
  process.env.APPDATA = join(workspaceRoot, "appdata");
  try {
    const instructionPaths = desktopInstructionPaths(workspaceRoot);
    const targetPath = resolveRuleFilePath(instructionPaths, "workspaceSpirit");
    await createRuleFile(workspaceRoot, {
      rootKind: "workspaceSpirit",
      description: "Commit messages use English",
    });
    const content = await import("node:fs/promises").then((fs) => fs.readFile(targetPath, "utf8"));
    assert.match(content, /Commit messages use English/);
    await assert.rejects(
      () =>
        createRuleFile(workspaceRoot, {
          rootKind: "workspaceSpirit",
          description: "duplicate",
        }),
      /已存在|already exists/i,
    );
  } finally {
    if (previousAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = previousAppData;
    }
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("deleteRuleFile removes managed rule file", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "spirit-rules-delete-"));
  const appDataRoot = join(workspaceRoot, "appdata");
  const spiritDataDir = join(appDataRoot, "SpiritAgent");
  const previousAppData = process.env.APPDATA;
  process.env.APPDATA = appDataRoot;
  try {
    await mkdir(join(workspaceRoot, ".spirit"), { recursive: true });
    const instructionPaths = desktopInstructionPaths(workspaceRoot);
    const targetPath = resolveRuleFilePath(instructionPaths, "workspaceSpirit");
    await writeFile(targetPath, "# Rules\n", "utf8");
    const entries = await import("@spiritagent/host-internal").then((mod) =>
      mod.discoverRuleEntries({
        workspaceRoot,
        spiritDataDir,
      }),
    );
    const entry = entries.find((item) => item.source.rootKind === "workspaceSpirit");
    assert.ok(entry?.exists);
    await deleteRuleFile(workspaceRoot, { id: entry.source.id }, { workspaceRoot, spiritDataDir });
    const after = await import("node:fs/promises").then((fs) =>
      fs.stat(targetPath).catch(() => null),
    );
    assert.equal(after, null);
  } finally {
    if (previousAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = previousAppData;
    }
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
