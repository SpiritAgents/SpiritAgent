import { resolveEnvApiKey } from '../config.js';
import { hasResolvableCredentials } from '../credentials/index.js';
import type { AcpServerConfig } from '../types.js';
import type { AuthState } from './auth-state.js';

export function isEnvPreAuthenticated(): boolean {
  return resolveEnvApiKey() !== undefined;
}

export function canCreateSession(config: AcpServerConfig, authState: AuthState): boolean {
  if (isEnvPreAuthenticated()) {
    return true;
  }
  if (!authState.isAuthenticated()) {
    return false;
  }
  return hasResolvableCredentials(config.spiritDataDir);
}
