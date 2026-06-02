import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT_MAX_BUFFER = 4 * 1024 * 1024;
const FIELD_SEP = '\x1f';
const DEFAULT_MAX_COMMITS = 200;

export interface GitCommitRecord {
  oid: string;
  parents: string[];
  subject: string;
  author: string;
  authoredAt: string;
  refs: string[];
}

export interface GitCommitGraphRow {
  commit: GitCommitRecord;
  /** Primary lane index for this commit's node (0-based). */
  lane: number;
  /** Number of lanes active at this row. */
  laneCount: number;
  /** Lane indices with a vertical connector passing through this row (excluding this commit's node lane when only passing). */
  passingLanes: number[];
  /** For merge commits: parent lanes that connect into this commit (excluding primary parent lane). */
  mergeLanes: number[];
  /** Lane index this commit branched from (first commit on a new lane). */
  branchFromLane?: number;
}

export interface GitCommitHistorySnapshot {
  isRepository: boolean;
  commits: GitCommitRecord[];
  rows: GitCommitGraphRow[];
}

export interface ReadGitCommitHistoryOptions {
  maxCount?: number;
}

function renderGitError(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return String(error);
  }
  const stdout = typeof (error as { stdout?: unknown }).stdout === 'string'
    ? (error as { stdout: string }).stdout.trim()
    : '';
  const stderr = typeof (error as { stderr?: unknown }).stderr === 'string'
    ? (error as { stderr: string }).stderr.trim()
    : '';
  const message = error instanceof Error ? error.message.trim() : String(error);
  return stderr || stdout || message;
}

async function runGit(
  workspaceRoot: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync('git', args, {
      cwd: workspaceRoot,
      windowsHide: true,
      maxBuffer: GIT_MAX_BUFFER,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const message = renderGitError(error);
    throw new Error(`git ${args.join(' ')} failed: ${message}`);
  }
}

export function parseGitLogDecorations(decorations: string): string[] {
  if (!decorations.trim()) {
    return [];
  }
  const refs: string[] = [];
  const parts = decorations.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const headMatch = /^HEAD -> (.+)$/u.exec(trimmed);
    if (headMatch?.[1]) {
      refs.push(headMatch[1].trim());
      continue;
    }
    if (trimmed.startsWith('tag: ')) {
      refs.push(trimmed.slice('tag: '.length).trim());
      continue;
    }
    refs.push(trimmed);
  }
  return refs;
}

export function parseGitLogRecordLine(line: string): GitCommitRecord | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }
  const fields = trimmed.split(FIELD_SEP);
  if (fields.length < 5) {
    return undefined;
  }
  const [oid, parentsRaw, subject, author, authoredAt, decorations = ''] = fields;
  if (!oid?.trim()) {
    return undefined;
  }
  const parents = parentsRaw?.trim()
    ? parentsRaw.trim().split(/\s+/u).filter(Boolean)
    : [];
  return {
    oid: oid.trim(),
    parents,
    subject: subject?.trim() ?? '',
    author: author?.trim() ?? '',
    authoredAt: authoredAt?.trim() ?? '',
    refs: parseGitLogDecorations(decorations),
  };
}

export function layoutGitCommitGraph(commits: readonly GitCommitRecord[]): GitCommitGraphRow[] {
  if (commits.length === 0) {
    return [];
  }

  /** lane index -> next expected commit oid on that lane */
  const lanes: Array<string | null> = [];
  const oidToLane = new Map<string, number>();
  let maxLaneCount = 1;

  const ensureLane = (index: number): void => {
    while (lanes.length <= index) {
      lanes.push(null);
    }
  };

  const findFreeLane = (): number => {
    const empty = lanes.findIndex((value) => value === null);
    if (empty >= 0) {
      return empty;
    }
    const next = lanes.length;
    lanes.push(null);
    return next;
  };

  const rows: GitCommitGraphRow[] = [];

  for (const commit of commits) {
    let lane = lanes.findIndex((expected) => expected === commit.oid);
    let branchFromLane: number | undefined;

    if (lane < 0) {
      const emptyLane = lanes.findIndex((value) => value === null);
      if (emptyLane >= 0) {
        lane = emptyLane;
      } else {
        lane = lanes.length;
        lanes.push(null);
        if (rows.length > 0) {
          branchFromLane = 0;
        }
      }
    }

    ensureLane(lane);
    oidToLane.set(commit.oid, lane);

    const passingLanes: number[] = [];
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
      if (laneIndex === lane) {
        continue;
      }
      if (lanes[laneIndex] !== null) {
        passingLanes.push(laneIndex);
      }
    }

    const mergeLanes: number[] = [];
    const parents = commit.parents;

    lanes[lane] = null;

    if (parents.length > 0) {
      const primaryParent = parents[0]!;
      lanes[lane] = primaryParent;
      oidToLane.set(primaryParent, lane);
    }

    for (let parentIndex = 1; parentIndex < parents.length; parentIndex += 1) {
      const parentOid = parents[parentIndex]!;
      let parentLane = lanes.findIndex((expected) => expected === parentOid);
      if (parentLane < 0) {
        parentLane = findFreeLane();
        ensureLane(parentLane);
        lanes[parentLane] = parentOid;
      }
      if (parentLane !== lane && !mergeLanes.includes(parentLane)) {
        mergeLanes.push(parentLane);
      }
      oidToLane.set(parentOid, parentLane);
    }

    maxLaneCount = Math.max(maxLaneCount, lanes.length);
    rows.push({
      commit,
      lane,
      laneCount: maxLaneCount,
      passingLanes: [...passingLanes].sort((a, b) => a - b),
      mergeLanes: [...mergeLanes].sort((a, b) => a - b),
      ...(branchFromLane !== undefined ? { branchFromLane } : {}),
    });
  }

  const finalLaneCount = Math.max(1, maxLaneCount);
  return rows.map((row) => ({
    ...row,
    laneCount: finalLaneCount,
  }));
}

export async function readGitCommitHistory(
  repoRoot: string,
  options: ReadGitCommitHistoryOptions = {},
): Promise<GitCommitHistorySnapshot> {
  const maxCount = options.maxCount ?? DEFAULT_MAX_COMMITS;
  try {
    const { stdout: repoFlag } = await runGit(repoRoot, ['rev-parse', '--is-inside-work-tree']);
    if (repoFlag.trim() !== 'true') {
      return { isRepository: false, commits: [], rows: [] };
    }

    const { stdout } = await runGit(repoRoot, [
      'log',
      '--all',
      '--date-order',
      `-n${String(maxCount)}`,
      `--format=format:%H${FIELD_SEP}%P${FIELD_SEP}%s${FIELD_SEP}%an${FIELD_SEP}%ai${FIELD_SEP}%D`,
    ]);

    const commits = stdout
      .split(/\r?\n/u)
      .map((line) => parseGitLogRecordLine(line))
      .filter((record): record is GitCommitRecord => record !== undefined);

    const rows = layoutGitCommitGraph(commits);
    return { isRepository: true, commits, rows };
  } catch {
    return { isRepository: false, commits: [], rows: [] };
  }
}
