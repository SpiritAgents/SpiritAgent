import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";

import {
  loadOrCreateToken,
  readCurrentToken,
  rotateToken,
  tokenEquals,
  tokenFilePath,
} from "../src/auth-token.js";

async function freshDataDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "spirit-server-test-"));
}

describe("auth-token", () => {
  it("creates a token on first use and persists it", async () => {
    const dir = await freshDataDir();
    const first = await loadOrCreateToken(dir);
    assert.ok(first.length > 20);
    const second = await loadOrCreateToken(dir);
    assert.equal(first, second);
    assert.equal(await readCurrentToken(dir), first);
  });

  it("stores the token with 0600 permissions on posix", async () => {
    if (process.platform === "win32") {
      return;
    }
    const dir = await freshDataDir();
    await loadOrCreateToken(dir);
    const mode = (await stat(tokenFilePath(dir))).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  it("rotateToken replaces the stored token", async () => {
    const dir = await freshDataDir();
    const first = await loadOrCreateToken(dir);
    const rotated = await rotateToken(dir);
    assert.notEqual(first, rotated);
    const onDisk = (await readFile(tokenFilePath(dir), "utf8")).trim();
    assert.equal(onDisk, rotated);
  });

  it("tokenEquals compares constant-time and length-safely", async () => {
    assert.equal(tokenEquals("abc", "abc"), true);
    assert.equal(tokenEquals("abc", "abd"), false);
    assert.equal(tokenEquals("abc", "abcd"), false);
    assert.equal(tokenEquals("", ""), true);
  });
});
