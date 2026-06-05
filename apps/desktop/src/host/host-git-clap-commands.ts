import i18n from '../lib/i18n-host.js';
import { gitClapActionToSkillName } from './builtin-skills.js';
import { buildActiveSkillPayload, buildActivateSkillUserTurn } from './skills.js';
import type { HostExtensionCommandContext } from './host-extension-commands.js';
import type {
  DesktopGitSnapshot,
  DesktopSnapshot,
  GitClapAction,
  SubmitGitClapRequest,
} from '../types.js';

function gitClapDisplayText(action: GitClapAction): string {
  switch (action) {
    case 'commit':
      return i18n.t('gitClap.display.commit');
    case 'push':
      return i18n.t('gitClap.display.push');
    case 'merge':
      return i18n.t('gitClap.display.merge');
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function assertMergeAllowed(git: DesktopGitSnapshot): void {
  if (git.isWorktreeSession !== true || !git.worktreeBranch?.trim() || !git.primaryRepoRoot?.trim()) {
    throw new Error(i18n.t('error.notInWorktree'));
  }
}

export async function submitGitClapCommand(
  ctx: HostExtensionCommandContext,
  request: SubmitGitClapRequest,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized(undefined, { fastPath: true });
    const runtime = ctx.requireRuntime();
    if (runtime.isBusy()) {
      throw new Error(i18n.t('error.runtimeBusy'));
    }

    const action = request.action;
    const state = ctx.requireState();
    if (action === 'merge') {
      assertMergeAllowed(state.git);
    }
    if (action === 'commit') {
      if (!state.git.isRepository) {
        throw new Error(i18n.t('error.notGitRepo'));
      }
      if (state.git.hasChanges !== true) {
        throw new Error(i18n.t('error.noChangesToCommit'));
      }
    }
    if (action === 'push') {
      if (!state.git.isRepository) {
        throw new Error(i18n.t('error.notGitRepo'));
      }
      if (state.git.needsPush !== true) {
        throw new Error(i18n.t('error.nothingToPush'));
      }
    }

    const skillName = gitClapActionToSkillName(action);
    const skill = ctx.requireEnabledSkillEntry(skillName);
    const payload = await buildActiveSkillPayload(skill);
    const extraNote = request.extraNote?.trim() ?? '';
    const text = extraNote || buildActivateSkillUserTurn(skillName, '');

    return ctx.submitUserTurnAfterInitialized(text, {
      displayText: gitClapDisplayText(action),
      turnSkills: [payload],
    });
  });
}
