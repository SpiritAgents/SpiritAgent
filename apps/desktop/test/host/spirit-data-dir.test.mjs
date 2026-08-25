import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "vitest";

import {
  resolveConfiguredSpiritDataDir,
  resolveDefaultSpiritDataDir,
} from "../../dist-electron/src/host/storage.js";

async function withEnv(vars, run) {
  const previous = new Map();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("resolveDefaultSpiritDataDir uses Application Support on macOS", async () => {
  if (process.platform !== "darwin") {
    return;
  }

  const home = await mkdtemp(path.join(tmpdir(), "spirit-agent-home-"));
  try {
    await withEnv(
      {
        APPDATA: undefined,
        HOME: home,
        USERPROFILE: undefined,
        SPIRIT_DATA_DIR: undefined,
      },
      async () => {
        assert.equal(
          resolveDefaultSpiritDataDir(),
          path.join(home, "Library", "Application Support", "Spirit"),
        );
      },
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("resolveConfiguredSpiritDataDir honors SPIRIT_DATA_DIR", async () => {
  await withEnv(
    {
      SPIRIT_DATA_DIR: "/tmp/spirit-agent-custom-data-dir",
      APPDATA: "/tmp/spirit-agent-appdata",
      HOME: "/tmp/spirit-agent-home",
    },
    async () => {
      assert.equal(resolveConfiguredSpiritDataDir(), "/tmp/spirit-agent-custom-data-dir");
    },
  );
});
