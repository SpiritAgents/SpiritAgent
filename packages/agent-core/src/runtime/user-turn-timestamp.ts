import {
  buildActiveSkillsBlockContent,
  type ToolAgentActiveSkill,
} from '../tool-agent.js';

/** Prefix user turn content with a local-time anchor for the LLM (plain text, no separate metadata field). */
const USER_MESSAGE_AT_OPEN = '<user_message_at>';
const USER_MESSAGE_AT_CLOSE = '</user_message_at>';
const ACTIVE_SKILL_OPEN = '<active_skill>';
const ACTIVE_SKILL_CLOSE = '</active_skill>';

export function formatActiveSkillUserMessageMeta(
  activeSkills: ToolAgentActiveSkill[],
): string | undefined {
  const block = buildActiveSkillsBlockContent(activeSkills);
  if (!block) {
    return undefined;
  }

  return `${ACTIVE_SKILL_OPEN}\n${block}\n${ACTIVE_SKILL_CLOSE}`;
}

export function formatUserMessageContentForLlm(
  body: string,
  activeSkills: ToolAgentActiveSkill[] = [],
): string {
  const lines: string[] = [];
  const activeSkillMeta = formatActiveSkillUserMessageMeta(activeSkills);
  if (activeSkillMeta) {
    lines.push(activeSkillMeta);
  }
  lines.push(`${USER_MESSAGE_AT_OPEN}${formatLocalIsoWithOffset(new Date())}${USER_MESSAGE_AT_CLOSE}`);
  lines.push(body);
  return lines.join('\n');
}

export function userMessageContentMatchesInput(content: string, input: string): boolean {
  if (content === input) {
    return true;
  }

  const body = bodyAfterUserMessageMeta(content);
  return body !== undefined && body === input;
}

function bodyAfterUserMessageMeta(content: string): string | undefined {
  let remaining = content;

  if (remaining.startsWith(ACTIVE_SKILL_OPEN)) {
    const closeIndex = remaining.indexOf(ACTIVE_SKILL_CLOSE);
    if (closeIndex < 0) {
      return undefined;
    }
    remaining = remaining.slice(closeIndex + ACTIVE_SKILL_CLOSE.length);
    if (remaining.startsWith('\n')) {
      remaining = remaining.slice(1);
    }
  }

  const firstLineEnd = remaining.indexOf('\n');
  if (firstLineEnd < 0) {
    return undefined;
  }

  const firstLine = remaining.slice(0, firstLineEnd);
  if (
    firstLine.startsWith(USER_MESSAGE_AT_OPEN)
    && firstLine.endsWith(USER_MESSAGE_AT_CLOSE)
    && firstLine.length > USER_MESSAGE_AT_OPEN.length + USER_MESSAGE_AT_CLOSE.length
  ) {
    return remaining.slice(firstLineEnd + 1);
  }

  return undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/** e.g. 2026-04-21T15:30:45.123+08:00 (local calendar + UTC offset). */
function formatLocalIsoWithOffset(d: Date): string {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  const ms = pad3(d.getMilliseconds());
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  const oh = pad2(Math.floor(abs / 60));
  const om = pad2(abs % 60);
  return `${y}-${mo}-${day}T${h}:${mi}:${s}.${ms}${sign}${oh}:${om}`;
}
