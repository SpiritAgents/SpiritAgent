import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_DATA_DIR_NAME = 'SpiritAgent';

/**
 * Resolves the Spirit Agent data directory (shared with Desktop / CLI /
 * acp-server). Same resolution order as the other hosts:
 * env override → %APPDATA% → platform conventions.
 */
export function resolveSpiritDataDir(): string {
  const envOverride = process.env['SPIRIT_SERVER_DATA_DIR']?.trim()
    || process.env['SPIRIT_AGENT_DATA_DIR']?.trim();
  if (envOverride) {
    return envOverride;
  }

  const appData = process.env['APPDATA']?.trim();
  if (appData) {
    return join(appData, APP_DATA_DIR_NAME);
  }

  const home = process.env['HOME']?.trim() || homedir()?.trim();
  if (home) {
    if (process.platform === 'darwin') {
      return join(home, 'Library', 'Application Support', APP_DATA_DIR_NAME);
    }
    if (process.platform === 'linux') {
      const xdgDataHome = process.env['XDG_DATA_HOME']?.trim();
      if (xdgDataHome) {
        return join(xdgDataHome, APP_DATA_DIR_NAME);
      }
      return join(home, '.local', 'share', APP_DATA_DIR_NAME);
    }
    return join(home, '.spirit-agent');
  }

  const userProfile = process.env['USERPROFILE']?.trim();
  if (userProfile) {
    return join(userProfile, '.spirit-agent');
  }

  return join(homedir(), '.spirit-agent');
}

/** Reads the package version at runtime (dist/src → ../../package.json). */
export function resolveServerVersion(): string {
  try {
    const pkgUrl = new URL('../../package.json', import.meta.url);
    const parsed: unknown = JSON.parse(readFileSync(pkgUrl, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null) {
      const version = (parsed as Record<string, unknown>)['version'];
      if (typeof version === 'string') {
        return version;
      }
    }
  } catch {
    // Fall through to the development placeholder.
  }
  return '0.0.0-dev';
}
