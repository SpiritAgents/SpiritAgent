import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildDreamCollectorRemoteCreateInput } from "../../dist-electron/src/host/dream-collector-runtime.js";

test("buildDreamCollectorRemoteCreateInput shapes daemon session.create payload", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "spirit-dream-collector-runtime-"));
  const previousAppData = process.env.APPDATA;
  process.env.APPDATA = tempRoot;
  try {
    const input = buildDreamCollectorRemoteCreateInput({
      workspaceRoot: "/tmp/workspace",
      gitBranch: "main",
      modelRef: { groupId: "openai", name: "gpt-test" },
      dreamSourceSession: {
        path: "/tmp/workspace/chats/source.json",
        displayName: "Source chat",
        savedAtUnixMs: 1_700_000_000_000,
      },
      approvalLevel: "auto-approval",
    });

    assert.equal(input.sessionKind, "dream-collector");
    assert.equal(input.agentMode, "agent");
    assert.equal(input.approvalLevel, "auto-approval");
    assert.deepEqual(input.dreamScope, {
      workspaceRoot: "/tmp/workspace",
      gitBranch: "main",
    });
    assert.equal(input.dreamSourceSession.path, "/tmp/workspace/chats/source.json");
    assert.equal(input.dreamSourceSession.displayName, "Source chat");
    assert.equal(input.dreamSourceSession.savedAtUnixMs, 1_700_000_000_000);
    assert.deepEqual(input.archive.llmHistory, []);
    assert.equal(input.conversationKey, undefined);
    assert.equal(input.todoSessionKey, undefined);
  } finally {
    if (previousAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = previousAppData;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("buildDreamCollectorRemoteCreateInput defaults approval to auto-approval", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "spirit-dream-collector-runtime-"));
  const previousAppData = process.env.APPDATA;
  process.env.APPDATA = tempRoot;
  try {
    const input = buildDreamCollectorRemoteCreateInput({
      workspaceRoot: "/tmp/workspace",
      gitBranch: "feature",
      modelRef: { groupId: "openai", name: "gpt-test" },
      dreamSourceSession: { path: "/tmp/workspace/chats/source.json" },
    });
    assert.equal(input.approvalLevel, "auto-approval");
  } finally {
    if (previousAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = previousAppData;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});
