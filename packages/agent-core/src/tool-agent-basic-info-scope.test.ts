import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBasicInfoSystemMessage,
  patchBasicInfoWorkspaceRootInMessages,
  patchBasicInfoWorkspaceRootInSystemText,
} from "./tool-agent.js";

test("buildBasicInfoSystemMessage includes current Git branch", () => {
  const message = buildBasicInfoSystemMessage({
    workspaceRoot: "/tmp/project",
    gitBranch: "main",
  });
  assert.match(message ?? "", /Current Git branch:\n- main/);
});

test("buildBasicInfoSystemMessage includes non-git workspace label", () => {
  const message = buildBasicInfoSystemMessage({
    workspaceRoot: "/tmp/project",
    gitBranch: "Current workspace is not a Git repository",
  });
  assert.match(message ?? "", /Current Git branch:\n- Current workspace is not a Git repository/);
});

test("buildBasicInfoSystemMessage includes current session transcript path", () => {
  const message = buildBasicInfoSystemMessage({
    workspaceRoot: "/tmp/project",
    sessionTranscript: "/data/transcripts/session-1",
  });
  assert.match(message ?? "", /Current session transcript:\n- \/data\/transcripts\/session-1/);
});

test("buildBasicInfoSystemMessage includes Desktop host before workspace", () => {
  const message = buildBasicInfoSystemMessage({
    workspaceRoot: "/tmp/project",
    host: { kind: "Desktop" },
  });
  assert.match(message ?? "", /Current host:\n- Desktop\n\nCurrent workspace:\n- \/tmp\/project/);
});

test("buildBasicInfoSystemMessage includes Web host with page URL", () => {
  const message = buildBasicInfoSystemMessage({
    workspaceRoot: "/tmp/project",
    host: { kind: "Web", url: "https://example.com/app" },
  });
  assert.match(
    message ?? "",
    /Current host:\n- Web\n- URL: https:\/\/example\.com\/app\n\nCurrent workspace:/,
  );
});

test("patchBasicInfoWorkspaceRootInMessages rewrites Current workspace line", () => {
  const messages = [
    {
      role: "system",
      content: [
        "<basic_info>",
        "Basic information",
        "",
        "Current workspace:",
        "- D:\\\\SpiritAgent",
        "",
        "Current terminal:",
        "- powershell",
        "</basic_info>",
      ].join("\n"),
    },
  ];

  const patched = patchBasicInfoWorkspaceRootInMessages(
    messages,
    "D:\\SpiritAgent.worktrees\\spirit-read-readme",
  );

  assert.match(
    String((patched[0] as { content: string }).content),
    /Current workspace:\n- D:\\SpiritAgent\.worktrees\\spirit-read-readme/,
  );
});

test("patchBasicInfoWorkspaceRootInSystemText handles CRLF workspace lines", () => {
  const content = [
    "<basic_info>",
    "Basic information",
    "",
    "Current workspace:",
    "- D:\\SpiritAgent",
    "</basic_info>",
  ].join("\r\n");
  const patched = patchBasicInfoWorkspaceRootInSystemText(
    content,
    "D:\\SpiritAgent.worktrees\\spirit-read-readme",
  );
  assert.match(patched, /Current workspace:\r?\n- D:\\SpiritAgent\.worktrees\\spirit-read-readme/);
});
