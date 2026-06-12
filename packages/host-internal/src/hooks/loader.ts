import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  emptyHooksConfigFile,
  hooksUserConfigPath,
  hooksWorkspaceConfigPath,
  parseHooksConfigFile,
  resolveMergedHookDefinitions,
  type HookEventName,
  type HookInput,
  type HooksConfigFile,
  hookMatcherTarget,
} from '@spirit-agent/core';

export interface LoadHooksConfigOptions {
  spiritDataDir: string;
  workspaceRoot: string | undefined;
}

export interface LoadedHooksConfig {
  user: HooksConfigFile;
  workspace: HooksConfigFile;
  userConfigDir: string;
  workspaceConfigDir: string | undefined;
}

export function loadHooksConfigFileAt(configPath: string): HooksConfigFile {
  if (!existsSync(configPath)) {
    return emptyHooksConfigFile();
  }
  const content = readFileSync(configPath, 'utf8');
  return parseHooksConfigFile(JSON.parse(content) as unknown);
}

export function loadHooksConfig(options: LoadHooksConfigOptions): LoadedHooksConfig {
  const userConfigPath = hooksUserConfigPath(options.spiritDataDir);
  const user = loadHooksConfigFileAt(userConfigPath);
  const userConfigDir = path.dirname(userConfigPath);

  let workspace = emptyHooksConfigFile();
  let workspaceConfigDir: string | undefined;
  if (options.workspaceRoot?.trim()) {
    const workspaceConfigPath = hooksWorkspaceConfigPath(options.workspaceRoot.trim());
    workspace = loadHooksConfigFileAt(workspaceConfigPath);
    workspaceConfigDir = path.dirname(workspaceConfigPath);
  }

  return {
    user,
    workspace,
    userConfigDir,
    workspaceConfigDir,
  };
}

export function listHookDefinitionsForInput(
  loaded: LoadedHooksConfig,
  input: HookInput,
) {
  return resolveMergedHookDefinitions(
    loaded.user,
    loaded.workspace,
    input.hookEventName,
    loaded.userConfigDir,
    loaded.workspaceConfigDir,
    hookMatcherTarget(input),
  );
}

export function summarizeHooksConfig(loaded: LoadedHooksConfig): Record<HookEventName, number> {
  const summary = {} as Record<HookEventName, number>;
  const events = [
    'sessionStart',
    'sessionEnd',
    'submitPrompt',
    'preToolUse',
    'postToolUse',
    'subagentStart',
    'subagentEnd',
  ] as const;
  for (const event of events) {
    const userCount = loaded.user.hooks[event]?.length ?? 0;
    const workspaceCount = loaded.workspace.hooks[event]?.length ?? 0;
    summary[event] = userCount + workspaceCount;
  }
  return summary;
}
