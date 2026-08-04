import {
  AgentRuntime,
  type LlmActiveSkill,
  type LlmToolAgentBasicInfo,
  type LlmToolAgentState,
  type LlmTransportConfig,
} from '@spiritagent/agent-core';
import { resolveTranscriptSessionDir } from '@spiritagent/host-internal';

import type { DesktopToolRequest } from './contracts.js';
import { spiritAgentDataDir } from './storage.js';
import type { DesktopToolExecutor } from './tool-executor.js';

export type DesktopRuntime = AgentRuntime<
  LlmTransportConfig,
  LlmToolAgentState,
  DesktopToolRequest,
  string
>;

export function buildDesktopRuntimeBasicInfo(
  workspaceRoot: string,
  toolExecutor: DesktopToolExecutor,
  gitBranch?: string,
  sessionKey?: string,
): LlmToolAgentBasicInfo {
  const shell = toolExecutor.toolDefinitionEnvironment();
  const normalizedGitBranch = gitBranch?.trim();
  const normalizedSessionKey = sessionKey?.trim();
  const sessionTranscript = normalizedSessionKey
    ? resolveTranscriptSessionDir(spiritAgentDataDir(), normalizedSessionKey)
    : undefined;
  return {
    workspaceRoot,
    ...(normalizedGitBranch ? { gitBranch: normalizedGitBranch } : {}),
    ...(sessionTranscript ? { sessionTranscript } : {}),
    terminal: shell.shellDisplayName,
    system: toolExecutor.operatingSystemInfo(),
  };
}

export function cloneActiveSkills(skills: LlmActiveSkill[]): LlmActiveSkill[] {
  return skills.map((skill) => ({
    ...skill,
    resources: skill.resources.map((resource) => ({ ...resource })),
  }));
}
