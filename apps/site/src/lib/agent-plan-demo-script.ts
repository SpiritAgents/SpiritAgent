import type { Messages } from "@/i18n/messages";
import type { ToolBlockSnapshot } from "@/types/spirit-desktop";

export const AGENT_PLAN_MOCKUP_IMAGE_URL = "/demo/hero-mockup.png";

export const AGENT_PLAN_DEMO_START_DELAY_MS = 1100;
export const AGENT_PLAN_DEMO_RESTART_DELAY_MS = 4200;
export const AGENT_PLAN_DEMO_RESUME_AFTER_IDLE_MS = 5000;
export const AGENT_PLAN_TYPE_SPEED_MS = 34;
export const AGENT_PLAN_SEND_DELAY_MS = 300;
export const AGENT_PLAN_THINKING_START_DELAY_MS = 280;
export const AGENT_PLAN_THINKING_STREAM_SPEED_MS = 10;
export const AGENT_PLAN_IMAGE_TOOL_START_DELAY_MS = 1100;
export const AGENT_PLAN_IMAGE_TOOL_SUCCESS_DELAY_MS = 2400;
export const AGENT_PLAN_CREATE_PLAN_START_DELAY_MS = 3000;
export const AGENT_PLAN_CREATE_PLAN_SUCCESS_DELAY_MS = 3600;
export const AGENT_PLAN_REVEAL_DELAY_MS = 3800;
export const AGENT_PLAN_STREAM_CHAR_MS = 14;
export const AGENT_PLAN_ASSISTANT_STREAM_START_DELAY_MS = 480;
export const AGENT_PLAN_ASSISTANT_STREAM_SPEED_MS = 18;

export function buildAgentImageRunningTool(
  callId: string,
  copy: Messages["desktop"]["conversation"]["agentDemo"],
): ToolBlockSnapshot {
  return {
    toolCallId: callId,
    toolName: "generate_image",
    phase: "running",
    headline: copy.imageGenRunningHeadline,
    detailLines: [],
    imagePaths: [],
  };
}

export function buildAgentImageSucceededTool(
  callId: string,
  copy: Messages["desktop"]["conversation"]["agentDemo"],
): ToolBlockSnapshot {
  return {
    toolCallId: callId,
    toolName: "generate_image",
    phase: "succeeded",
    headline: copy.imageGenSucceededHeadline,
    detailLines: [],
    imagePaths: [AGENT_PLAN_MOCKUP_IMAGE_URL],
  };
}

export function buildAgentCreatePlanRunningTool(
  callId: string,
  copy: Messages["desktop"]["conversation"]["agentDemo"],
): ToolBlockSnapshot {
  const planFilename = copy.planPath.split("/").pop() ?? copy.planPath;

  return {
    toolCallId: callId,
    toolName: "create_plan",
    phase: "running",
    headline: copy.createPlanHeadlineRunning,
    headlineDetail: planFilename,
    detailLines: [],
  };
}

export function buildAgentCreatePlanSucceededTool(
  callId: string,
  copy: Messages["desktop"]["conversation"]["agentDemo"],
): ToolBlockSnapshot {
  const planFilename = copy.planPath.split("/").pop() ?? copy.planPath;

  return {
    toolCallId: callId,
    toolName: "create_plan",
    phase: "succeeded",
    headline: copy.createPlanHeadlineSucceeded,
    headlineDetail: planFilename,
    detailLines: [],
  };
}
