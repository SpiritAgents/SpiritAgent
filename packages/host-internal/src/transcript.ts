import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SessionTranscript } from '@spiritagent/agent-core';

import { sanitizeSessionIdForFilename } from './spirit-filename-sanitize.js';

export const TRANSCRIPTS_DIR_NAME = 'transcripts';
export const SESSION_TRANSCRIPT_FILE_NAME = 'transcript.json';
export const SUBAGENT_TRANSCRIPTS_DIR_NAME = 'subagents';

export function resolveTranscriptsDir(spiritDataDir: string): string {
  return path.join(spiritDataDir, TRANSCRIPTS_DIR_NAME);
}

export function resolveTranscriptSessionDir(
  spiritDataDir: string,
  sessionKey: string | undefined,
): string {
  return path.join(resolveTranscriptsDir(spiritDataDir), sanitizeSessionIdForFilename(sessionKey));
}

export function resolveSessionTranscriptFilePath(
  spiritDataDir: string,
  sessionKey: string | undefined,
): string {
  return path.join(resolveTranscriptSessionDir(spiritDataDir, sessionKey), SESSION_TRANSCRIPT_FILE_NAME);
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

/**
 * Writes the main-session transcript and returns the transcript **directory** absolute path.
 */
export async function persistSessionTranscript(
  spiritDataDir: string,
  transcript: SessionTranscript,
  options: { sessionKey?: string } = {},
): Promise<string> {
  const sessionDir = resolveTranscriptSessionDir(spiritDataDir, options.sessionKey);
  await mkdir(sessionDir, { recursive: true });

  const filePath = path.join(sessionDir, SESSION_TRANSCRIPT_FILE_NAME);
  await writeFile(filePath, `${JSON.stringify(transcript, null, 2)}\n`, 'utf8');
  return sessionDir;
}
