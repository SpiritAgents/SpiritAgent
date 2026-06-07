import { randomUUID } from 'node:crypto';

import {
  createLlmMessageContentFromText,
  createLlmTransport,
  createToolExecutionTextOutput,
  DEFAULT_IMAGE_GENERATION_SIZE,
  type ImageGenerationRequest,
  type RuntimeEvent,
  type RuntimeToolExecution,
  type StoredLlmMessageArchiveEntry,
  type ToolExecutionOutput,
} from '@spirit-agent/core';

import i18n from '../lib/i18n-host.js';
import {
  resolveComposerDirectMediaTool,
  type DirectMediaTool,
} from '../lib/composer-direct-media.js';
import type { DesktopToolRequest } from './contracts.js';
import {
  buildMediaOnlyTransportConfig,
  type DirectMediaTool as HostDirectMediaTool,
} from './model-config.js';
import type { SessionBundle } from './session-bundle.js';
import { syncRuntimeHistoryFromBundleArchive } from './conversation-continuation.js';
import type { SessionTurnOrchestratorContext } from './session-turn-orchestrator.js';
import type { DesktopConfigFile } from './storage.js';
import type { DesktopToolExecutor } from './tool-executor.js';

export interface DirectMediaTurnInput {
  bundle: SessionBundle;
  toolName: HostDirectMediaTool;
  prompt: string;
  userMessageId: number;
  beforeUserCheckpoint: unknown;
}

function buildMediaToolRequest(toolName: DirectMediaTool, prompt: string): DesktopToolRequest {
  if (toolName === 'generate_image') {
    return { name: 'generate_image', prompt };
  }
  return { name: 'generate_video', prompt };
}

function buildMediaToolExecution(
  toolCallId: string,
  toolName: DirectMediaTool,
  request: DesktopToolRequest,
  output: ToolExecutionOutput,
  failed: boolean,
): RuntimeToolExecution<DesktopToolRequest> {
  const artifacts: RuntimeToolExecution<DesktopToolRequest>['artifacts'] = [];
  for (const part of output.content) {
    if (part.type === 'image') {
      artifacts.push({ kind: 'image', path: part.path });
      continue;
    }
    if (part.type === 'video') {
      artifacts.push({ kind: 'video', path: part.path });
    }
  }

  return {
    toolCallId,
    toolName,
    request,
    output: output.summaryText,
    failed,
    ...(artifacts.length > 0 ? { artifacts } : {}),
  };
}

export function appendDirectMediaTurnToArchive(
  bundle: SessionBundle,
  input: {
    prompt: string;
    toolCallId: string;
    toolName: DirectMediaTool;
    request: DesktopToolRequest;
    summaryText: string;
  },
): void {
  const userEntry: StoredLlmMessageArchiveEntry = {
    role: 'user',
    content: createLlmMessageContentFromText(input.prompt),
  };
  const assistantEntry: StoredLlmMessageArchiveEntry = {
    role: 'assistant',
    content: createLlmMessageContentFromText(''),
    toolCalls: [
      {
        id: input.toolCallId,
        name: input.toolName,
        argumentsJson: JSON.stringify(input.request),
      },
    ],
  };
  const toolEntry: StoredLlmMessageArchiveEntry = {
    role: 'tool',
    content: createLlmMessageContentFromText(input.summaryText),
    toolCallId: input.toolCallId,
  };

  bundle.archiveHistory = [...bundle.archiveHistory, userEntry, assistantEntry, toolEntry];
}

function renderDirectMediaError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return String(error);
}

export function isSessionBundleBusy(bundle: SessionBundle | undefined): boolean {
  if (!bundle) {
    return false;
  }
  if (bundle.directMediaTurnInFlight === true) {
    return true;
  }
  return bundle.runtime?.isBusy() === true;
}

export function beginDirectMediaTurn(
  ctx: SessionTurnOrchestratorContext,
  input: DirectMediaTurnInput & { toolCallId: string },
): DesktopToolRequest {
  const request = buildMediaToolRequest(input.toolName, input.prompt);
  const startedEvent: RuntimeEvent<DesktopToolRequest> = {
    kind: 'tool-call-started',
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    request,
  };
  ctx.orchestrationFor(input.bundle).runtimeEvents.applyRuntimeHostEvents([startedEvent]);
  input.bundle.messages = input.bundle.messageTimeline.toMessages();
  input.bundle.directMediaTurnInFlight = true;
  return request;
}

function rollbackDirectMediaUserTurn(
  ctx: SessionTurnOrchestratorContext,
  input: DirectMediaTurnInput,
): void {
  input.bundle.currentTurnSkills = [];
  ctx.orchestrationFor(input.bundle).assistantMessages.handleMessageRemoved(
    input.bundle.messages.length - 1,
    input.userMessageId,
    'send-user-rollback',
  );
  input.bundle.messages.pop();
  ctx.rebuildMessageTimelineFromMessages();
}

async function validateDirectMediaTurnSetup(
  ctx: SessionTurnOrchestratorContext,
  input: DirectMediaTurnInput,
): Promise<void> {
  const config = ctx.requireConfig();
  const profile = config.models.find((model) => model.name === config.activeModel);
  if (!profile) {
    throw new Error(i18n.t('error.modelNotFound', { model: config.activeModel }));
  }

  const apiKey = await ctx.resolveApiKeyForConfigModel(profile.name);
  if (!apiKey) {
    throw new Error(i18n.t('error.apiKeyNotConfigured'));
  }

  await ctx.ensureToolExecutor(input.bundle);
}

async function runDirectMediaGeneration(
  ctx: SessionTurnOrchestratorContext,
  input: DirectMediaTurnInput,
  toolCallId: string,
  request: DesktopToolRequest,
): Promise<void> {
  const config = ctx.requireConfig();
  const profile = config.models.find((model) => model.name === config.activeModel);
  if (!profile) {
    throw new Error(i18n.t('error.modelNotFound', { model: config.activeModel }));
  }

  const apiKey = await ctx.resolveApiKeyForConfigModel(profile.name);
  if (!apiKey) {
    throw new Error(i18n.t('error.apiKeyNotConfigured'));
  }

  const mediaTransportConfig = buildMediaOnlyTransportConfig(input.toolName, {
    profile,
    apiKey,
  });
  const toolExecutor = (await ctx.ensureToolExecutor(input.bundle)) as DesktopToolExecutor;
  const llmTransport = input.bundle.runtimeTransport ?? createLlmTransport();
  const orchestration = ctx.orchestrationFor(input.bundle);

  try {
    let output: ToolExecutionOutput;
    if (input.toolName === 'generate_image') {
      const imageRequest: ImageGenerationRequest = {
        prompt: input.prompt,
        size: DEFAULT_IMAGE_GENERATION_SIZE,
      };
      output = await llmTransport.generateImage(
        mediaTransportConfig,
        imageRequest,
        (saveRequest) => toolExecutor.saveGeneratedImage(saveRequest),
      );
    } else {
      output = await llmTransport.generateVideo(
        mediaTransportConfig,
        { prompt: input.prompt },
        (saveRequest) => toolExecutor.saveGeneratedVideo(saveRequest),
      );
    }

    const execution = buildMediaToolExecution(toolCallId, input.toolName, request, output, false);
    orchestration.runtimeEvents.applyRuntimeHostEvents([
      { kind: 'tool-execution-finished', execution },
    ]);
    appendDirectMediaTurnToArchive(input.bundle, {
      prompt: input.prompt,
      toolCallId,
      toolName: input.toolName,
      request,
      summaryText: output.summaryText,
    });
  } catch (error) {
    const message = renderDirectMediaError(error);
    const failedOutput = createToolExecutionTextOutput(
      `${input.toolName} failed: ${message}`,
    );
    const execution = buildMediaToolExecution(
      toolCallId,
      input.toolName,
      request,
      failedOutput,
      true,
    );
    orchestration.runtimeEvents.applyRuntimeHostEvents([
      { kind: 'tool-execution-finished', execution },
    ]);
    appendDirectMediaTurnToArchive(input.bundle, {
      prompt: input.prompt,
      toolCallId,
      toolName: input.toolName,
      request,
      summaryText: failedOutput.summaryText,
    });
  }

  syncRuntimeHistoryFromBundleArchive(input.bundle);

  input.bundle.messages = input.bundle.messageTimeline.toMessages();
  await ctx.recordRewindCheckpoint(input.userMessageId, input.beforeUserCheckpoint);
  await ctx.persistSessionBundle(input.bundle, { bumpListSortAt: false });
}

/** 同步执行整轮直连媒体（测试与旧调用路径）。 */
export async function executeDirectMediaTurn(
  ctx: SessionTurnOrchestratorContext,
  input: DirectMediaTurnInput,
): Promise<void> {
  const toolCallId = randomUUID();
  const request = beginDirectMediaTurn(ctx, { ...input, toolCallId });
  try {
    await runDirectMediaGeneration(ctx, input, toolCallId, request);
  } finally {
    input.bundle.directMediaTurnInFlight = false;
  }
}

/** 与 LLM 流式回合一致：先展示工具卡并立即返回 snapshot，生成在后台 runSerialized 中完成。 */
export function scheduleDirectMediaTurn(
  ctx: SessionTurnOrchestratorContext,
  input: DirectMediaTurnInput,
): void {
  input.bundle.directMediaTurnInFlight = true;

  void ctx.runSerialized(async () => {
    const toolCallId = randomUUID();
    let beganTurn = false;
    try {
      await validateDirectMediaTurnSetup(ctx, input);
      const request = beginDirectMediaTurn(ctx, { ...input, toolCallId });
      beganTurn = true;
      ctx.emitLiveSnapshotUpdate();
      await runDirectMediaGeneration(ctx, input, toolCallId, request);
      const orchestration = ctx.orchestrationFor(input.bundle);
      orchestration.runtimeEvents.syncPendingToolStates();
      orchestration.runtimeEvents.syncAssistantPrefixFromHistoryBeforeToolRow();
      await ctx.flushDeferredRuntimeRefreshIfIdle(input.bundle);
      await ctx.refreshTodoSnapshotForBundle(input.bundle);
    } catch (error) {
      if (!beganTurn) {
        rollbackDirectMediaUserTurn(ctx, input);
      }
      throw error;
    } finally {
      input.bundle.directMediaTurnInFlight = false;
      input.bundle.currentTurnSkills = [];
      ctx.emitLiveSnapshotUpdate();
    }
  });
}

export function shouldUseComposerDirectMediaTurn(
  config: DesktopConfigFile,
  activeModel: string,
  explicitWorkspaceFileCount: number,
): DirectMediaTool | null {
  const directMediaTool = resolveComposerDirectMediaTool(activeModel, config);
  if (!directMediaTool) {
    return null;
  }
  if (explicitWorkspaceFileCount > 0) {
    console.debug(
      '[desktop][composer-direct-media] attachments present; falling back to chat',
      { activeModel, tool: directMediaTool },
    );
    return null;
  }
  return directMediaTool;
}
