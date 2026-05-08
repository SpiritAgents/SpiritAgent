import {
  AgentRuntime,
  VisionExecutor,
  VisionTransport,
  appendScriptedToolResult,
  appendScriptedUserMessage,
  createScriptedState,
  extractScriptedAssistantText,
  isOpenAiVisionUnsupportedError,
  llmMessageHasImages,
  llmMessageTextContent,
  type RuntimeEvent,
  type RuntimeParityCaseResult,
  type ScriptedToolRequest,
  userMessageContentMatchesInput,
} from './harness.js';

export async function runVisionCase(): Promise<RuntimeParityCaseResult> {
  const visionEvents: RuntimeEvent<ScriptedToolRequest>[] = [];

  const visionRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new VisionTransport(),
    toolExecutor: new VisionExecutor(),
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
    isVisionUnsupportedError: isOpenAiVisionUnsupportedError,
    onEvent: (event) => visionEvents.push(event),
  });

  const visionResult = await visionRuntime.submitUserTurn('请描述这张图。', ['fixtures/demo.png']);
  if (visionResult.kind !== 'completed' || visionResult.assistantText !== 'VISION_OK') {
    throw new Error('vision fallback smoke 未完成闭环。');
  }

  const visionEvent = visionEvents.find((event) => event.kind === 'vision-fallback-retry');
  if (!visionEvent || visionEvent.droppedImages !== 1) {
    throw new Error('vision fallback smoke 未记录正确的降级事件。');
  }
  const visionUserHistory = visionRuntime.history().find(
    (message) =>
      message.role === 'user' &&
      userMessageContentMatchesInput(llmMessageTextContent(message.content), '请描述这张图。'),
  );
  if (!visionUserHistory || llmMessageHasImages(visionUserHistory.content)) {
    throw new Error('vision fallback smoke 未清空 user imagePaths。');
  }

  return { visionResult };
}
