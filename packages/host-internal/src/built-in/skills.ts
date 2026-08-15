import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SKILL_FILE_NAME, SKILLS_DIR_NAME } from "../storage.js";

export const BUILT_IN_SKILL_NAMES = ["create-rule", "create-skill", "create-hook"] as const;

export type BuiltInSkillName = (typeof BUILT_IN_SKILL_NAMES)[number];

export function resolveBuiltInSkillsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/built-in and dist/built-in are the same depth relative to package root.
  const candidate = path.join(here, "../../built-in/skills");
  if (existsSync(path.join(candidate, "create-skill", SKILL_FILE_NAME))) {
    return candidate;
  }
  return candidate;
}

export async function ensureBuiltInSkills(
  spiritDataDir: string,
  skillNames: readonly BuiltInSkillName[] = BUILT_IN_SKILL_NAMES,
): Promise<void> {
  const templateRoot = resolveBuiltInSkillsRoot();
  const userSkillsRoot = path.join(spiritDataDir, SKILLS_DIR_NAME);

  await mkdir(userSkillsRoot, { recursive: true });

  for (const skillName of skillNames) {
    const templateSkillDir = path.join(templateRoot, skillName);
    const templateSkillFile = path.join(templateSkillDir, SKILL_FILE_NAME);
    if (!existsSync(templateSkillFile)) {
      continue;
    }

    const targetSkillDir = path.join(userSkillsRoot, skillName);
    const targetSkillFile = path.join(targetSkillDir, SKILL_FILE_NAME);
    if (existsSync(targetSkillFile)) {
      continue;
    }

    await mkdir(targetSkillDir, { recursive: true });
    await cp(templateSkillFile, targetSkillFile);
  }
}
