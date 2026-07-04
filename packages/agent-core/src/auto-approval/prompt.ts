import type { ToolAutoReviewInput } from './types.js';

function formatJsonSection(label: string, value: unknown): string {
  if (value === undefined) {
    return `${label}: (unknown)`;
  }
  return `${label}:\n${JSON.stringify(value, null, 2)}`;
}

export function buildAutoApprovalReviewPrompt(input: ToolAutoReviewInput): string {
  let parsedArguments: unknown = input.argumentsJson;
  try {
    parsedArguments = JSON.parse(input.argumentsJson) as unknown;
  } catch {
    parsedArguments = input.argumentsJson;
  }

  return [
    'Review the pending host tool call and decide whether it is safe to allow without human approval.',
    'Return JSON only: {"allow":boolean,"reason":"..."}.',
    'Set allow=true only when the call clearly matches a low-risk pattern below.',
    'Set allow=false when the call is ambiguous, destructive, exfiltrates secrets, or matches a block pattern.',
    '',
    formatJsonSection('tool_name', input.toolName),
    formatJsonSection('arguments', parsedArguments),
    formatJsonSection('input_schema', input.inputSchema),
    ...(input.targetMcpToolSchema !== undefined
      ? [formatJsonSection('target_mcp_tool_schema', input.targetMcpToolSchema)]
      : []),
    formatJsonSection('host_approval_context', input.hostApprovalContext),
    '',
    'Examples that are usually safe to allow:',
    '- Read-only workspace operations (read_file, grep, glob, list_directory_files inside the project)',
    '- git commit or git push to a non-main feature branch',
    '- web_fetch of official documentation or other clearly trusted project URLs',
    '- Read-only MCP queries with a clear, bounded purpose',
    '',
    'Examples that should be blocked:',
    '- Destructive database operations (drop database, delete production data)',
    '- git push to main/master or any --force / --force-with-lease push',
    '- npm install, pnpm install, or similar installs of unknown dependencies',
    '- npm pack or publishing artifacts to local/untrusted destinations',
    '- web_fetch or MCP calls to untrusted third-party sites',
    '- Commands or tools that may read and echo secrets (.env, tokens, credentials, private keys)',
  ].join('\n');
}
