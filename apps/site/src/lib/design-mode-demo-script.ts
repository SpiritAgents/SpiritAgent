import type { Messages } from "@/i18n/messages";
import type { ToolBlockSnapshot } from "@/types/spirit-desktop";

export const DESIGN_MODE_DEMO_START_DELAY_MS = 900;
export const DESIGN_MODE_DEMO_RESTART_DELAY_MS = 4800;
export const DESIGN_MODE_DEMO_RESUME_AFTER_IDLE_MS = 5000;
export const DESIGN_MODE_TOOLS_OPEN_MS = 400;
export const DESIGN_MODE_PICKER_ACTIVATE_MS = 300;
/** Quick sweep across tagline / CTA (headline → tagline → cta). */
export const DESIGN_MODE_HOVER_SWEEP_STEP_MS = 180;
/** Return to headline before selection — keep slower, deliberate. */
export const DESIGN_MODE_HOVER_STEP_MS = 600;
export const DESIGN_MODE_CURSOR_SWEEP_TRANSITION_MS = 180;
export const DESIGN_MODE_CURSOR_RETURN_TRANSITION_MS = 500;
export const DESIGN_MODE_SELECT_MS = 200;
export const DESIGN_MODE_TYPE_SPEED_MS = 32;
export const DESIGN_MODE_SEND_DELAY_MS = 280;
export const DESIGN_MODE_THINKING_START_DELAY_MS = 260;
export const DESIGN_MODE_THINKING_STREAM_SPEED_MS = 10;
export const DESIGN_MODE_EDIT_TOOL_START_DELAY_MS = 900;
export const DESIGN_MODE_EDIT_TOOL_SUCCESS_DELAY_MS = 2100;
export const DESIGN_MODE_HEADLINE_CROSSFADE_MS = 500;
export const DESIGN_MODE_ASSISTANT_STREAM_START_DELAY_MS = 420;
export const DESIGN_MODE_ASSISTANT_STREAM_SPEED_MS = 16;

export function buildDesignModeEditRunningTool(
  callId: string,
  copy: Messages["desktop"]["conversation"]["designDemo"],
): ToolBlockSnapshot {
  const fileName = copy.editFilePath.split("/").pop() ?? copy.editFilePath;

  return {
    toolCallId: callId,
    toolName: "edit_file",
    phase: "running",
    headline: copy.editFileRunningHeadline,
    headlineDetail: fileName,
    detailLines: [copy.editFileRunningDetail],
  };
}

export function buildDesignModeEditSucceededTool(
  callId: string,
  copy: Messages["desktop"]["conversation"]["designDemo"],
): ToolBlockSnapshot {
  return {
    ...buildDesignModeEditRunningTool(callId, copy),
    phase: "succeeded",
    headline: copy.editFileSucceededHeadline,
  };
}
