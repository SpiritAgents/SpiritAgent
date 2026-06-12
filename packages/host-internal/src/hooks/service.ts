import {
  emptyHookRunResult,
  serializeHookInput,
  type HookCommandOutput,
  type HookEventName,
  type HookInput,
  type HookRunResult,
  type HookRunner,
  type HookRunnerContext,
  isPreHookEvent,
} from '@spirit-agent/core';

import { runCommandHook } from './command-runner.js';
import { listHookDefinitionsForInput, loadHooksConfig, type LoadedHooksConfig } from './loader.js';

function applyOutput(
  aggregate: HookRunResult,
  event: HookEventName,
  output: HookCommandOutput | null | undefined,
): HookRunResult {
  if (!output) {
    return aggregate;
  }

  if (isPreHookEvent(event) && output.permission === 'deny') {
    return {
      ...aggregate,
      denied: true,
      userMessage: output.userMessage ?? aggregate.userMessage,
      agentMessage: output.agentMessage ?? aggregate.agentMessage,
    };
  }

  if (output.updatedInput) {
    aggregate.updatedInput = output.updatedInput;
  }

  if (output.additionalContext?.trim()) {
    aggregate.additionalContexts.push(output.additionalContext.trim());
  }

  if (output.followupMessage?.trim()) {
    aggregate.followupMessage = output.followupMessage.trim();
  }

  return aggregate;
}

export interface CreateHookRunnerOptions extends HookRunnerContext {
  logger?: (message: string) => void;
  reloadConfig?: () => LoadedHooksConfig;
}

export function createHookRunner(options: CreateHookRunnerOptions): HookRunner {
  const getLoaded = (): LoadedHooksConfig =>
    options.reloadConfig?.() ?? loadHooksConfig({
      spiritDataDir: options.spiritDataDir,
      workspaceRoot: options.workspaceRoot,
    });

  async function runEvent(input: HookInput): Promise<HookRunResult> {
    const loaded = getLoaded();
    const definitions = listHookDefinitionsForInput(loaded, input);
    if (definitions.length === 0) {
      return emptyHookRunResult();
    }

    const inputJson = JSON.stringify(serializeHookInput(input));
    let aggregate = emptyHookRunResult();

    for (const definition of definitions) {
      const hookOptions: Parameters<typeof runCommandHook>[0] = {
        definition,
        inputJson,
      };
      if (options.logger) {
        hookOptions.logger = options.logger;
      }
      const result = await runCommandHook(hookOptions);
      aggregate.records.push(result.record);

      if (result.denied) {
        aggregate.denied = true;
        aggregate.userMessage = result.effectiveOutput?.userMessage ?? aggregate.userMessage;
        aggregate.agentMessage = result.effectiveOutput?.agentMessage ?? aggregate.agentMessage;
        break;
      }

      aggregate = applyOutput(aggregate, input.hookEventName, result.effectiveOutput);
    }

    return aggregate;
  }

  return {
    runSessionStart: (input) =>
      runEvent({ ...input, hookEventName: 'sessionStart', timestamp: new Date().toISOString() }),
    runSessionEnd: (input) =>
      runEvent({ ...input, hookEventName: 'sessionEnd', timestamp: new Date().toISOString() }),
    runSubmitPrompt: (input) =>
      runEvent({ ...input, hookEventName: 'submitPrompt', timestamp: new Date().toISOString() }),
    runPreToolUse: (input) =>
      runEvent({ ...input, hookEventName: 'preToolUse', timestamp: new Date().toISOString() }),
    runPostToolUse: (input) =>
      runEvent({ ...input, hookEventName: 'postToolUse', timestamp: new Date().toISOString() }),
    runSubagentStart: (input) =>
      runEvent({ ...input, hookEventName: 'subagentStart', timestamp: new Date().toISOString() }),
    runSubagentEnd: (input) =>
      runEvent({ ...input, hookEventName: 'subagentEnd', timestamp: new Date().toISOString() }),
  };
}

export { loadHooksConfig, summarizeHooksConfig } from './loader.js';
