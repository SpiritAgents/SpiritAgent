export type VoiceChatPhase = "idle" | "listening" | "speaking";

export type ResolveVoiceChatPhaseInput = {
  /** Agent 正在回复或执行工具（conversation.isBusy） */
  conversationBusy: boolean;
  /** 预留：Realtime 麦克风采集/聆听中 */
  listening?: boolean;
};

export function resolveVoiceChatPhase(input: ResolveVoiceChatPhaseInput): VoiceChatPhase {
  if (input.listening) {
    return "listening";
  }
  if (input.conversationBusy) {
    return "speaking";
  }
  return "idle";
}
