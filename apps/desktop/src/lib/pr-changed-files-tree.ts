import type { GitHubPullRequestChangedFile } from "@/types";

export type PrChangedFilesTreeDirNode = {
  kind: "dir";
  name: string;
  path: string;
  children: PrChangedFilesTreeNode[];
};

export type PrChangedFilesTreeFileNode = {
  kind: "file";
  name: string;
  path: string;
  file: GitHubPullRequestChangedFile;
};

export type PrChangedFilesTreeNode = PrChangedFilesTreeDirNode | PrChangedFilesTreeFileNode;

function sortTreeNodes(nodes: PrChangedFilesTreeNode[]): PrChangedFilesTreeNode[] {
  return [...nodes]
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "dir" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })
    .map((node) =>
      node.kind === "dir" ? { ...node, children: sortTreeNodes(node.children) } : node,
    );
}

export function buildPrChangedFilesTree(
  files: GitHubPullRequestChangedFile[],
): PrChangedFilesTreeNode[] {
  const root: PrChangedFilesTreeDirNode = { kind: "dir", name: "", path: "", children: [] };

  for (const file of files) {
    const parts = file.filename.replace(/\\/gu, "/").split("/").filter(Boolean);
    let current = root;
    let path = "";

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? "";
      if (!part) {
        continue;
      }
      path = path ? `${path}/${part}` : part;
      const isLast = index === parts.length - 1;

      if (isLast) {
        current.children.push({
          kind: "file",
          name: part,
          path: file.filename,
          file,
        });
        continue;
      }

      let childDir = current.children.find(
        (node): node is PrChangedFilesTreeDirNode => node.kind === "dir" && node.name === part,
      );
      if (!childDir) {
        childDir = { kind: "dir", name: part, path, children: [] };
        current.children.push(childDir);
      }
      current = childDir;
    }
  }

  return sortTreeNodes(root.children).map((node) =>
    node.kind === "dir" ? collapseSingleChildDirChain(node) : node,
  );
}

function isPassthroughDir(node: PrChangedFilesTreeDirNode): boolean {
  return node.children.length > 0 && node.children.every((child) => child.kind === "dir");
}

function collapseSingleChildDirChain(node: PrChangedFilesTreeDirNode): PrChangedFilesTreeDirNode {
  const children = node.children.map((child) =>
    child.kind === "dir" ? collapseSingleChildDirChain(child) : child,
  );

  let current: PrChangedFilesTreeDirNode = { ...node, children };

  while (
    current.children.length === 1 &&
    current.children[0]?.kind === "dir" &&
    isPassthroughDir(current.children[0])
  ) {
    const child = current.children[0];
    current = {
      kind: "dir",
      name: `${current.name}/${child.name}`,
      path: child.path,
      children: child.children,
    };
  }

  return current;
}
