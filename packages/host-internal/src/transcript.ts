import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { mergeSessionTranscripts, type SessionTranscript } from "@spiritagent/agent-core";

import { sanitizeSessionIdForFilename } from "./spirit-filename-sanitize.js";

export const TRANSCRIPTS_DIR_NAME = "transcripts";
export const SESSION_TRANSCRIPT_FILE_NAME = "transcript.json";
export const SUBAGENT_TRANSCRIPTS_DIR_NAME = "subagents";

/** Transcript 目录名：对 sessionKey 做稳定归一后取 sha256 前 32 hex，避免路径 flatten 碰撞与过长组件名。 */
export function transcriptSessionDirName(sessionKey: string | undefined): string {
  const trimmed = sessionKey?.trim();
  if (!trimmed) {
    return "unknown";
  }
  // 绝对路径先 resolve，保证 Desktop / server 对同一 chat 文件得到同一目录名；相对/opaque id 原样哈希。
  const stableKey = path.isAbsolute(trimmed) ? path.resolve(trimmed) : trimmed;
  return createHash("sha256").update(stableKey, "utf8").digest("hex").slice(0, 32);
}

export function resolveTranscriptsDir(spiritDataDir: string): string {
  return path.join(spiritDataDir, TRANSCRIPTS_DIR_NAME);
}

export function resolveTranscriptSessionDir(
  spiritDataDir: string,
  sessionKey: string | undefined,
): string {
  return path.join(resolveTranscriptsDir(spiritDataDir), transcriptSessionDirName(sessionKey));
}

export function resolveSessionTranscriptFilePath(
  spiritDataDir: string,
  sessionKey: string | undefined,
): string {
  return path.join(
    resolveTranscriptSessionDir(spiritDataDir, sessionKey),
    SESSION_TRANSCRIPT_FILE_NAME,
  );
}

export function resolveSubagentTranscriptFilePath(
  spiritDataDir: string,
  sessionKey: string | undefined,
  subagentSessionId: string,
): string {
  return path.join(
    resolveTranscriptSessionDir(spiritDataDir, sessionKey),
    SUBAGENT_TRANSCRIPTS_DIR_NAME,
    `${sanitizeSessionIdForFilename(subagentSessionId)}.json`,
  );
}

async function readExistingSessionTranscript(
  filePath: string,
): Promise<SessionTranscript | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SessionTranscript;
    if (parsed?.kind !== "session_transcript" || !Array.isArray(parsed.messages)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Writes the main-session transcript and returns the transcript **directory** absolute path.
 * Merges with any existing file so a post-compaction short history cannot wipe durable content.
 */
export async function persistSessionTranscript(
  spiritDataDir: string,
  transcript: SessionTranscript,
  options: { sessionKey?: string } = {},
): Promise<string> {
  const sessionDir = resolveTranscriptSessionDir(spiritDataDir, options.sessionKey);
  await mkdir(sessionDir, { recursive: true });

  const filePath = path.join(sessionDir, SESSION_TRANSCRIPT_FILE_NAME);
  const existing = await readExistingSessionTranscript(filePath);
  const merged = mergeSessionTranscripts(existing, transcript);
  await writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return sessionDir;
}

/**
 * Writes a subagent transcript under `{session}/subagents/{subagentSessionId}.json`.
 */
export async function persistSubagentTranscript(
  spiritDataDir: string,
  transcript: SessionTranscript,
  options: { sessionKey?: string; subagentSessionId: string },
): Promise<string> {
  const filePath = resolveSubagentTranscriptFilePath(
    spiritDataDir,
    options.sessionKey,
    options.subagentSessionId,
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
  return filePath;
}

export async function ensureTranscriptSessionDir(
  spiritDataDir: string,
  sessionKey: string | undefined,
): Promise<string> {
  const sessionDir = resolveTranscriptSessionDir(spiritDataDir, sessionKey);
  await mkdir(sessionDir, { recursive: true });
  return sessionDir;
}

export async function deleteTranscriptSessionDir(
  spiritDataDir: string,
  sessionKey: string | undefined,
): Promise<void> {
  const sessionDir = resolveTranscriptSessionDir(spiritDataDir, sessionKey);
  await rm(sessionDir, { recursive: true, force: true });
}
