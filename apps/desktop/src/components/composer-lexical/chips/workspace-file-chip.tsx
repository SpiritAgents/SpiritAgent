import { WorkspaceFileIcon } from "@/components/workspace-file-icon";
import { ChipShell } from "@/components/composer-lexical/chips/chip-shell";
import { workspaceFileBasename } from "@/lib/file-picker-path";
import {
  resolveWorkspaceFileChipPresentation,
  WORKSPACE_FILE_CHIP_CLASS,
  WORKSPACE_FILE_CHIP_ICON_CLASS,
} from "@/lib/workspace-file-chip-styles";
import { WORKSPACE_FILE_ICON_CHIP_SIZE_PX } from "@/lib/workspace-file-icon-svg";

type WorkspaceFileChipProps = {
  path: string;
};

export function WorkspaceFileChip({ path }: WorkspaceFileChipProps) {
  const normalized = path.replace(/\\/gu, "/");
  const presentation = resolveWorkspaceFileChipPresentation(normalized);
  return (
    <ChipShell
      data-chip-kind="workspaceFile"
      className={WORKSPACE_FILE_CHIP_CLASS}
      title={normalized}
      aria-label={normalized}
    >
      <WorkspaceFileIcon
        path={presentation.iconPath}
        kind={presentation.iconKind}
        size={WORKSPACE_FILE_ICON_CHIP_SIZE_PX}
        className={WORKSPACE_FILE_CHIP_ICON_CLASS}
        colorMode="inherit"
      />
      {workspaceFileBasename(normalized)}
    </ChipShell>
  );
}
