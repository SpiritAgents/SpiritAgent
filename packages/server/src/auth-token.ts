import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TOKEN_FILE_NAME = "server.token";
const TOKEN_BYTES = 32;

export function tokenFilePath(dataDir: string): string {
  return join(dataDir, TOKEN_FILE_NAME);
}

/**
 * Reads the home-level bearer token, creating it (mode 0600) on first use.
 * All daemon instances under one Spirit data dir share this token; rotating
 * it takes effect for new connections as daemons re-read it per handshake.
 */
export async function loadOrCreateToken(dataDir: string): Promise<string> {
  const path = tokenFilePath(dataDir);
  try {
    const existing = (await readFile(path, "utf8")).trim();
    if (existing.length > 0) {
      return existing;
    }
  } catch {
    // Missing or unreadable — fall through and create a fresh token.
  }
  return rotateToken(dataDir);
}

export async function rotateToken(dataDir: string): Promise<string> {
  const path = tokenFilePath(dataDir);
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  await mkdir(dataDir, { recursive: true });
  await writeFile(path, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") {
    await chmod(path, 0o600);
  }
  return token;
}

/** Re-reads the token from disk so `rotate-token` applies to new handshakes. */
export async function readCurrentToken(dataDir: string): Promise<string | null> {
  try {
    const token = (await readFile(tokenFilePath(dataDir), "utf8")).trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export function tokenEquals(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
