import path from 'node:path';

import { loadStoredSession, saveStoredSession } from './storage.js';
import type { SessionRegistry } from './session-registry.js';

export async function applyGeneratedSessionTitle(input: {
  sessionPath: string;
  title: string;
  registry: SessionRegistry;
  notifySessionListUpdated: () => void;
}): Promise<void> {
  const resolvedPath = path.resolve(input.sessionPath);
  const bundle = input.registry.findBySessionPath(resolvedPath);
  if (
    bundle?.activeSession
    && path.resolve(bundle.activeSession.filePath) === resolvedPath
  ) {
    bundle.activeSession.displayName = input.title;
    bundle.sessionTitleSource = 'llm';
  }

  const stored = await loadStoredSession(resolvedPath);
  await saveStoredSession(resolvedPath, {
    ...stored,
    sessionDisplayName: input.title,
    sessionTitleSource: 'llm',
  });
  input.notifySessionListUpdated();
}
