export function buildWorktreeNamingPrompt(input: {
  userPrompt: string;
  baseBranch: string;
  repoRoot: string;
}): string {
  return [
    'Generate Git worktree and branch names for the user task below.',
    'Return JSON only: {"worktreeName":"...","branchName":"..."}. No Markdown, no explanations, no extra keys.',
    'Naming rules:',
    '- worktreeName must use kebab-case segments and start with "spirit-", e.g. spirit-add-worktree-ui',
    '- branchName must start with "spirit/" and use kebab-case segments after the slash, e.g. spirit/add-worktree-ui',
    '- Both names should summarize the user task in short English tokens.',
    '',
    `repository: ${input.repoRoot}`,
    `baseBranch: ${input.baseBranch}`,
    '',
    '[user task]',
    input.userPrompt.trim() || '(empty)',
  ].join('\n');
}

export interface GeneratedWorktreeNames {
  worktreeName: string;
  branchName: string;
}
