import type { Messages } from "@/i18n/messages";

export type ToolCardsDemoCopy = Messages["landing"]["trio"]["toolCards"];

export type EditFileLineDelta = {
  added: number;
  removed: number;
};

export type ToolCardsToolPhase = "running" | "succeeded";

export type LandingToolCardsDemoItem =
  | { id: "user"; kind: "user"; text: string }
  | {
      id: "search" | "read" | "edit";
      kind: "tool";
      headline: string;
      detail: string;
      phase: ToolCardsToolPhase;
      delta?: EditFileLineDelta;
    }
  | { id: "assistant"; kind: "assistant"; text: string; pending: boolean };

export const TOOL_CARDS_DEMO_TOOL_GAP_MS = 300;
export const TOOL_CARDS_DEMO_DELTA_TICK_MS = 55;
export const TOOL_CARDS_DEMO_DELTA_TARGET = 5;
export const TOOL_CARDS_DEMO_STREAM_CHAR_MS = 22;
export const TOOL_CARDS_DEMO_FINAL_HOLD_MS = 2400;
/** Pixels the stack shifts up each time a new item appears (after the first user message). */
export const TOOL_CARDS_DEMO_STACK_ITEM_GAP_PX = 20;

export const TOOL_CARDS_DEMO_DELTA_SEQUENCE = [1, 2, 3, 4, 5] as const;

export type ToolCardsDemoSnapshot = {
  showUser: boolean;
  searchPhase: ToolCardsToolPhase | null;
  readPhase: ToolCardsToolPhase | null;
  editPhase: ToolCardsToolPhase | null;
  editDelta: EditFileLineDelta | null;
  showAssistant: boolean;
  assistantText: string;
  assistantPending: boolean;
};

export function buildToolCardsDemoItems(
  snapshot: ToolCardsDemoSnapshot,
  copy: ToolCardsDemoCopy,
): LandingToolCardsDemoItem[] {
  const items: LandingToolCardsDemoItem[] = [];

  if (snapshot.showUser) {
    items.push({ id: "user", kind: "user", text: copy.userMessage });
  }

  if (snapshot.searchPhase) {
    items.push({
      id: "search",
      kind: "tool",
      headline: snapshot.searchPhase === "running" ? copy.searchRunning : copy.searchSucceeded,
      detail: copy.searchQuery,
      phase: snapshot.searchPhase,
    });
  }

  if (snapshot.readPhase) {
    items.push({
      id: "read",
      kind: "tool",
      headline: snapshot.readPhase === "running" ? copy.readRunning : copy.readSucceeded,
      detail: copy.fileName,
      phase: snapshot.readPhase,
    });
  }

  if (snapshot.editPhase) {
    items.push({
      id: "edit",
      kind: "tool",
      headline: snapshot.editPhase === "running" ? copy.editRunning : copy.editSucceeded,
      detail: copy.fileName,
      phase: snapshot.editPhase,
      delta: snapshot.editDelta ?? undefined,
    });
  }

  if (snapshot.showAssistant) {
    items.push({
      id: "assistant",
      kind: "assistant",
      text: snapshot.assistantText,
      pending: snapshot.assistantPending,
    });
  }

  return items;
}

export function createInitialToolCardsSnapshot(): ToolCardsDemoSnapshot {
  return {
    showUser: false,
    searchPhase: null,
    readPhase: null,
    editPhase: null,
    editDelta: null,
    showAssistant: false,
    assistantText: "",
    assistantPending: false,
  };
}
