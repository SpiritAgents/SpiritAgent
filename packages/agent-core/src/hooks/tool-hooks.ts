import type { AuthorizationDecision, JsonObject, ToolCallRequest, ToolExecutionOutput } from '../ports.js';
import type { TurnMachineRuntime } from '../runtime/turn-machine.js';

import { HookDeniedError } from './errors.js';
import {
  appendHookAdditionalContexts,
  applyUpdatedToolRequest,
  runPostToolUseHook,
  runPreToolUseHook,
  toolInputFromArgumentsJson,
} from './integration.js';

export type PreToolUseGateResult<ToolRequest> =
  | { kind: 'ready'; request: ToolRequest; hookBypassApproval?: boolean }
  | { kind: 'needs-approval'; request: ToolRequest; prompt: string }
  | { kind: 'denied'; error: HookDeniedError };

export interface ToolApprovalGate<TrustTarget = string> {
  prompt: string;
  trustTarget: TrustTarget | undefined;
}

export function resolveApprovalGateAfterAuthorize<ToolRequest, TrustTarget>(
  preGate: PreToolUseGateResult<ToolRequest>,
  authorization: AuthorizationDecision<TrustTarget>,
): ToolApprovalGate<TrustTarget> | null {
  if (preGate.kind === 'needs-approval') {
    return {
      prompt: preGate.prompt,
      trustTarget: authorization.kind === 'need-approval' ? authorization.trustTarget : undefined,
    };
  }

  if (authorization.kind === 'need-approval') {
    if (preGate.kind === 'ready' && preGate.hookBypassApproval) {
      return null;
    }
    return {
      prompt: authorization.prompt,
      trustTarget: authorization.trustTarget,
    };
  }

  return null;
}

function preToolUseGateFromHookResult<ToolRequest>(
  call: ToolCallRequest,
  request: ToolRequest,
  permission: 'allow' | 'ask' | undefined,
  userMessage: string | undefined,
): PreToolUseGateResult<ToolRequest> {
  if (permission === 'ask') {
    return {
      kind: 'needs-approval',
      request,
      prompt: userMessage?.trim() || `Hook requested approval for ${call.name}.`,
    };
  }

  return {
    kind: 'ready',
    request,
    ...(permission === 'allow' ? { hookBypassApproval: true } : {}),
  };
}

export async function runPreToolUseGate<
  Config,
  State,
  ToolRequest,
  TrustTarget = string,
>(
  runtime: TurnMachineRuntime<Config, State, ToolRequest, TrustTarget>,
  call: ToolCallRequest,
  request: ToolRequest,
): Promise<PreToolUseGateResult<ToolRequest>> {
  try {
    const toolInput = toolInputFromArgumentsJson(call.argumentsJson);
    const preHook = await runPreToolUseHook(runtime.options, call, toolInput);
    appendHookAdditionalContexts(
      runtime.recordContextMessage
        ? (role, content) => runtime.recordContextMessage!(role, content)
        : undefined,
      preHook.additionalContexts,
    );

    let resolvedRequest = request;
    if (preHook.updatedInput) {
      resolvedRequest = await applyUpdatedToolRequest(
        runtime.options.toolExecutor,
        call,
        preHook.updatedInput,
      );
    }

    return preToolUseGateFromHookResult(
      call,
      resolvedRequest,
      preHook.permission === 'allow' || preHook.permission === 'ask' ? preHook.permission : undefined,
      preHook.userMessage,
    );
  } catch (error) {
    if (error instanceof HookDeniedError) {
      return { kind: 'denied', error };
    }
    throw error;
  }
}

export async function runPostToolUseSideEffects<
  Config,
  State,
  ToolRequest,
  TrustTarget = string,
>(
  runtime: TurnMachineRuntime<Config, State, ToolRequest, TrustTarget>,
  call: Pick<ToolCallRequest, 'id' | 'name' | 'argumentsJson'>,
  toolInput: JsonObject,
  output: ToolExecutionOutput,
  durationMs: number,
  failed: boolean,
): Promise<void> {
  const postHook = await runPostToolUseHook(runtime.options, {
    toolName: call.name,
    toolCallId: call.id,
    toolInput,
    toolOutput: output.summaryText,
    durationMs,
    failed,
  });
  appendHookAdditionalContexts(
    runtime.recordContextMessage
      ? (role, content) => runtime.recordContextMessage!(role, content)
      : undefined,
    postHook.additionalContexts,
  );
}

export function hookDeniedToolOutput(error: HookDeniedError): string {
  return error.agentMessage ?? error.userMessage ?? error.message;
}
