import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "vitest";

import {
  assertSpiritConfigSchemaVersion,
  SPIRIT_CONFIG_SCHEMA_VERSION,
} from "@spiritagent/host-internal";
import {
  ConfigSchemaError,
  loadConfig,
  setSpiritAgentDataDirOverride,
} from "../../dist-electron/src/host/storage.js";

test("assertSpiritConfigSchemaVersion rejects legacy schemaVersion 1", () => {
  assert.throws(() => assertSpiritConfigSchemaVersion({ schemaVersion: 1 }), ConfigSchemaError);
});

test("assertSpiritConfigSchemaVersion accepts schemaVersion 2", () => {
  assert.doesNotThrow(() =>
    assertSpiritConfigSchemaVersion({ schemaVersion: SPIRIT_CONFIG_SCHEMA_VERSION }),
  );
});

async function withConfigFile(rawConfig, run) {
  const dir = await mkdtemp(path.join(tmpdir(), "spirit-config-schema-"));
  setSpiritAgentDataDirOverride(dir);
  try {
    await writeFile(
      path.join(dir, "config.json"),
      `${JSON.stringify({ schemaVersion: SPIRIT_CONFIG_SCHEMA_VERSION, ...rawConfig }, null, 2)}\n`,
      "utf8",
    );
    await run(await loadConfig());
  } finally {
    setSpiritAgentDataDirOverride(undefined);
    await rm(dir, { recursive: true, force: true });
  }
}

test("loadConfig round-trips the permission allowlist block", async () => {
  const permission = {
    shell: { "git status": "allow" },
    read_file: { "/etc/hosts": "ask" },
  };
  await withConfigFile({ permission }, (config) => {
    assert.deepEqual(config.permission, permission);
  });
});

test("loadConfig drops a non-object permission value", async () => {
  await withConfigFile({ permission: "allow-everything" }, (config) => {
    assert.equal(config.permission, undefined);
  });
});
