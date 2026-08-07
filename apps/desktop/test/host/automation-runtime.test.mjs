import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildAutomationRemoteRuntimeCreateInput,
  buildEmptyAutomationArchive,
} from "../../dist-electron/src/host/automation-runtime.js";

const sampleDefinition = {
  id: "automation-test-id",
  title: "Daily",
  overview: "Run daily task",
  trigger: { kind: "time", schedule: { kind: "hourly" } },
  workspaceRoot: "/tmp/workspace",
  modelRef: { groupId: "openai", name: "gpt-test" },
  approvalLevel: "full-approval",
  enabled: true,
  createdAtUnixMs: 1,
  updatedAtUnixMs: 1,
};

test("buildEmptyAutomationArchive seeds empty daemon session archive", () => {
  const archive = buildEmptyAutomationArchive("auto-approval");
  assert.deepEqual(archive.messages, []);
  assert.deepEqual(archive.assistantAux, []);
  assert.deepEqual(archive.llmHistory, []);
  assert.deepEqual(archive.subagentSessions, []);
  assert.equal(archive.loopEnabled, false);
  assert.equal(archive.approvalLevel, "auto-approval");
});

test("buildAutomationRemoteRuntimeCreateInput aligns conversationKey with resolved session path", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "spirit-automation-runtime-"));
  const previousAppData = process.env.APPDATA;
  process.env.APPDATA = tempRoot;
  try {
    const sessionPath = path.join(tempRoot, "chats", "chat-automation-abc-123.json");
    const input = buildAutomationRemoteRuntimeCreateInput({
      definition: sampleDefinition,
      config: { activeModel: sampleDefinition.modelRef },
      sessionPath,
    });
    assert.equal(input.conversationKey, path.resolve(sessionPath));
    assert.equal(input.todoSessionKey, path.resolve(sessionPath));
    assert.equal(input.agentMode, "agent");
    assert.deepEqual(input.modelRef, sampleDefinition.modelRef);
    assert.equal(input.approvalLevel, "full-approval");
    assert.deepEqual(input.archive.llmHistory, []);
  } finally {
    if (previousAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = previousAppData;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});
