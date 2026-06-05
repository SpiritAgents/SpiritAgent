import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ChevronDown, GitMerge, LoaderCircle, Upload } from "lucide-react";

import { GitClapPopover } from "@/components/git-clap-popover";
import { ActionPopover, type ActionPopoverItem } from "@/components/ui/action-popover";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import {
  DESKTOP_GIT_ACTION_BTN,
  DESKTOP_GIT_ACTION_MENU_TRIGGER,
  DESKTOP_GIT_ACTION_SPLIT,
} from "@/lib/desktop-chrome";
import { buildGitChangesMenuItemIds } from "@/lib/git-changes-menu-items";
import type { GitClapAction, SubmitGitClapRequest } from "@/types";

export type GitChangesMenuLabels = {
  push: string;
  merge: string;
  merged: string;
};

export function buildGitChangesMenuItems(input: {
  needsPush: boolean;
  canMerge: boolean;
  mergeFlashMerged?: boolean;
  labels: GitChangesMenuLabels;
  onPush: () => void;
  onMerge: () => void;
}): ActionPopoverItem[] {
  return buildGitChangesMenuItemIds({
    needsPush: input.needsPush,
    canMerge: input.canMerge,
  }).map((id) => {
    if (id === "push") {
      return {
        id,
        icon: <Upload className="size-3 shrink-0 opacity-80" aria-hidden />,
        label: input.labels.push,
        onSelect: input.onPush,
      };
    }
    return {
      id,
      icon: <GitMerge className="size-3 shrink-0 opacity-80" aria-hidden />,
      label: input.mergeFlashMerged ? input.labels.merged : input.labels.merge,
      onSelect: input.onMerge,
    };
  });
}

export type GitChangesActionsProps = {
  isRepository: boolean;
  hasChanges: boolean;
  needsPush: boolean;
  canMerge: boolean;
  gitBusy: boolean;
  mergeFlashMerged?: boolean;
  pushDisabledTitle?: string;
  onGitClap(request: SubmitGitClapRequest): Promise<boolean>;
};

export function GitChangesActions({
  isRepository,
  hasChanges,
  needsPush,
  canMerge,
  gitBusy,
  mergeFlashMerged = false,
  pushDisabledTitle,
  onGitClap,
}: GitChangesActionsProps) {
  const { t } = useTranslation();

  const menuLabels = useMemo<GitChangesMenuLabels>(
    () => ({
      push: t("workspace.git.push"),
      merge: t("app.merge"),
      merged: "Merged",
    }),
    [t],
  );

  const runGitClap = useCallback(
    (action: GitClapAction) => {
      void onGitClap({ action });
    },
    [onGitClap],
  );

  const menuItems = useMemo(
    () =>
      buildGitChangesMenuItems({
        needsPush,
        canMerge,
        mergeFlashMerged,
        labels: menuLabels,
        onPush: () => runGitClap("push"),
        onMerge: () => runGitClap("merge"),
      }),
    [canMerge, mergeFlashMerged, menuLabels, needsPush, runGitClap],
  );

  if (!isRepository) {
    return null;
  }

  const busyIcon = gitBusy ? (
    <LoaderCircle className="size-3 animate-spin" aria-hidden />
  ) : null;

  if (!hasChanges) {
    return (
      <ButtonGroup>
        <GitClapPopover
          action="push"
          disabled={!needsPush || gitBusy}
          busy={gitBusy}
          triggerTitle={!needsPush ? pushDisabledTitle : undefined}
          onSubmit={onGitClap}
        />
      </ButtonGroup>
    );
  }

  return (
    <ButtonGroup>
      <GitClapPopover action="commit" disabled={gitBusy} busy={gitBusy} onSubmit={onGitClap} />
      {menuItems.length > 0 ? (
        <>
          <ButtonGroupSeparator className={DESKTOP_GIT_ACTION_SPLIT} />
          <ActionPopover
            ariaLabel={t("workspace.git.moreActions")}
            title={t("workspace.git.moreActions")}
            disabled={gitBusy}
            triggerVariant="default"
            triggerSize="xs"
            triggerIcon={<ChevronDown className="size-3" aria-hidden />}
            items={menuItems}
            triggerClassName={DESKTOP_GIT_ACTION_MENU_TRIGGER}
          />
        </>
      ) : null}
    </ButtonGroup>
  );
}
