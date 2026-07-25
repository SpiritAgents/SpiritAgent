import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  persistSessionTranscript,
  persistSubagentTranscript,
  resolveSessionTranscriptFilePath,
  resolveSubagentTranscriptFilePath,
  resolveTranscriptSessionDir,
  SESSION_TRANSCRIPT_FILE_NAME,
} from './transcript.js';

test('persistSessionTranscript writes transcript.json under transcripts/{sessionKey}/ and returns dir', async () => {
  const spiritDataDir = await mkdtemp(join(tmpdir(), 'spirit-transcript-'));

  try {
    const transcript = {
      export_version: 1 as const,
      kind: 'session_transcript' as const,
      exported_at_unix_ms: 1_700_000_000_000,
      message_count: 1,
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'hello' }],
        },
      ],
    };

    const sessionDir = await persistSessionTranscript(spiritDataDir, transcript, {
      sessionKey: 'session/1',
    });

    assert.equal(sessionDir, resolveTranscriptSessionDir(spiritDataDir, 'session/1'));
    assert.equal(
      resolveSessionTranscriptFilePath(spiritDataDir, 'session/1'),
      join(sessionDir, SESSION_TRANSCRIPT_FILE_NAME),
    );
    const written = JSON.parse(
      await readFile(join(sessionDir, SESSION_TRANSCRIPT_FILE_NAME), 'utf8'),
    ) as typeof transcript;
    assert.deepEqual(written, transcript);
  } finally {
    await rm(spiritDataDir, { recursive: true, force: true });
  }
});

test('persistSubagentTranscript writes under transcripts/{sessionKey}/subagents/', async () => {
  const spiritDataDir = await mkdtemp(join(tmpdir(), 'spirit-transcript-sub-'));

  try {
    const transcript = {
      export_version: 1 as const,
      kind: 'session_transcript' as const,
      exported_at_unix_ms: 1_700_000_000_000,
      message_count: 1,
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'sub task' }],
        },
      ],
    };

    const filePath = await persistSubagentTranscript(spiritDataDir, transcript, {
      sessionKey: 'sess-1',
      subagentSessionId: 'subagent-1',
    });

    assert.equal(
      filePath,
      resolveSubagentTranscriptFilePath(spiritDataDir, 'sess-1', 'subagent-1'),
    );
    const written = JSON.parse(await readFile(filePath, 'utf8')) as typeof transcript;
    assert.deepEqual(written, transcript);
  } finally {
    await rm(spiritDataDir, { recursive: true, force: true });
  }
});
