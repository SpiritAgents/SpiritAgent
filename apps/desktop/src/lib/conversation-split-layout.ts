export type SplitDirection = "horizontal" | "vertical";

export type SplitLayoutLeafNode = {
  kind: "leaf";
  paneId: string;
  sessionPath: string;
};

export type SplitLayoutSplitNode = {
  kind: "split";
  splitId: string;
  direction: SplitDirection;
  ratio: number;
  first: SplitLayoutNode;
  second: SplitLayoutNode;
};

export type SplitLayoutNode = SplitLayoutLeafNode | SplitLayoutSplitNode;

export const MAX_SPLIT_PANES = 4;
export const DEFAULT_SPLIT_RATIO = 0.5;
const MIN_SPLIT_RATIO = 0.15;
const MAX_SPLIT_RATIO = 0.85;

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return DEFAULT_SPLIT_RATIO;
  }
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

export function createLeafNode(paneId: string, sessionPath: string): SplitLayoutLeafNode {
  return {
    kind: "leaf",
    paneId,
    sessionPath,
  };
}

export function createSinglePaneLayout(paneId: string, sessionPath: string): SplitLayoutLeafNode {
  return createLeafNode(paneId, sessionPath);
}

export function countPanes(node: SplitLayoutNode): number {
  if (node.kind === "leaf") {
    return 1;
  }
  return countPanes(node.first) + countPanes(node.second);
}

export function collectPaneSessionPaths(node: SplitLayoutNode): string[] {
  if (node.kind === "leaf") {
    return [node.sessionPath];
  }
  return [...collectPaneSessionPaths(node.first), ...collectPaneSessionPaths(node.second)];
}

export function findLeafByPaneId(
  node: SplitLayoutNode,
  paneId: string,
): SplitLayoutLeafNode | undefined {
  if (node.kind === "leaf") {
    return node.paneId === paneId ? node : undefined;
  }
  return findLeafByPaneId(node.first, paneId) ?? findLeafByPaneId(node.second, paneId);
}

export function findWorkspaceToolsAnchorPaneId(node: SplitLayoutNode): string {
  if (node.kind === "leaf") {
    return node.paneId;
  }
  const child = node.direction === "horizontal" ? node.second : node.first;
  return findWorkspaceToolsAnchorPaneId(child);
}

export function updateLeafSessionPath(
  node: SplitLayoutNode,
  paneId: string,
  sessionPath: string,
): SplitLayoutNode {
  if (node.kind === "leaf") {
    return node.paneId === paneId ? { ...node, sessionPath } : node;
  }
  return {
    ...node,
    first: updateLeafSessionPath(node.first, paneId, sessionPath),
    second: updateLeafSessionPath(node.second, paneId, sessionPath),
  };
}

export function updateSplitRatio(
  node: SplitLayoutNode,
  splitId: string,
  ratio: number,
): SplitLayoutNode {
  if (node.kind === "leaf") {
    return node;
  }
  if (node.splitId === splitId) {
    return { ...node, ratio: clampSplitRatio(ratio) };
  }
  return {
    ...node,
    first: updateSplitRatio(node.first, splitId, ratio),
    second: updateSplitRatio(node.second, splitId, ratio),
  };
}

export function splitPaneAt(
  node: SplitLayoutNode,
  paneId: string,
  direction: SplitDirection,
  newPane: SplitLayoutLeafNode,
): SplitLayoutNode {
  if (countPanes(node) >= MAX_SPLIT_PANES) {
    return node;
  }
  if (node.kind === "leaf") {
    if (node.paneId !== paneId) {
      return node;
    }
    const splitId = `split-${paneId}-${newPane.paneId}`;
    return {
      kind: "split",
      splitId,
      direction,
      ratio: DEFAULT_SPLIT_RATIO,
      first: node,
      second: newPane,
    };
  }

  return {
    ...node,
    first: splitPaneAt(node.first, paneId, direction, newPane),
    second: splitPaneAt(node.second, paneId, direction, newPane),
  };
}

function promoteSingleChildSplit(node: SplitLayoutSplitNode): SplitLayoutNode {
  const firstCount = countPanes(node.first);
  const secondCount = countPanes(node.second);
  if (firstCount === 0) {
    return node.second;
  }
  if (secondCount === 0) {
    return node.first;
  }
  if (firstCount === 1 && secondCount > 1) {
    return node.second;
  }
  if (secondCount === 1 && firstCount > 1) {
    return node.first;
  }
  return node;
}

function removeLeaf(node: SplitLayoutNode, paneId: string): SplitLayoutNode | null {
  if (node.kind === "leaf") {
    return node.paneId === paneId ? null : node;
  }

  const nextFirst = removeLeaf(node.first, paneId);
  const nextSecond = removeLeaf(node.second, paneId);

  if (!nextFirst && !nextSecond) {
    return null;
  }
  if (!nextFirst) {
    return nextSecond;
  }
  if (!nextSecond) {
    return nextFirst;
  }

  const nextNode: SplitLayoutSplitNode = {
    ...node,
    first: nextFirst,
    second: nextSecond,
  };
  return promoteSingleChildSplit(nextNode);
}

export function closePane(node: SplitLayoutNode, paneId: string): SplitLayoutNode | null {
  if (node.kind === "leaf") {
    return node.paneId === paneId ? null : node;
  }
  return removeLeaf(node, paneId);
}

export type PaneRepositionZone = "before" | "after" | "above" | "below";

function wrapWithSplit(
  target: SplitLayoutNode,
  incoming: SplitLayoutLeafNode,
  zone: PaneRepositionZone,
): SplitLayoutSplitNode {
  const horizontal = zone === "before" || zone === "after";
  const placeIncomingFirst = zone === "before" || zone === "above";
  const splitId = `split-${incoming.paneId}-${target.kind === "leaf" ? target.paneId : target.splitId}`;
  return {
    kind: "split",
    splitId,
    direction: horizontal ? "horizontal" : "vertical",
    ratio: DEFAULT_SPLIT_RATIO,
    first: placeIncomingFirst ? incoming : target,
    second: placeIncomingFirst ? target : incoming,
  };
}

function replaceLeaf(
  node: SplitLayoutNode,
  paneId: string,
  replacement: SplitLayoutNode,
): SplitLayoutNode {
  if (node.kind === "leaf") {
    return node.paneId === paneId ? replacement : node;
  }
  return {
    ...node,
    first: replaceLeaf(node.first, paneId, replacement),
    second: replaceLeaf(node.second, paneId, replacement),
  };
}

export function repositionPane(
  node: SplitLayoutNode,
  sourcePaneId: string,
  targetPaneId: string,
  zone: PaneRepositionZone,
): SplitLayoutNode | null {
  if (sourcePaneId === targetPaneId) {
    return node;
  }

  const sourceLeaf = findLeafByPaneId(node, sourcePaneId);
  if (!sourceLeaf) {
    return node;
  }

  const withoutSource = closePane(node, sourcePaneId);
  if (!withoutSource) {
    return node;
  }

  const targetLeaf = findLeafByPaneId(withoutSource, targetPaneId);
  if (!targetLeaf) {
    return node;
  }

  const replacement = wrapWithSplit(targetLeaf, sourceLeaf, zone);
  return replaceLeaf(withoutSource, targetPaneId, replacement);
}

export function createPaneId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
