import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { AtSign, File, Plus } from 'lucide-react'

import { ActionPopover, type ActionPopoverItem } from '@/components/ui/action-popover'

type ComposerInsertMenuProps = {
  disabled?: boolean
  canPickLocalFile?: boolean
  onInsertWorkspaceReference(): void
  onPickLocalFile(): void | Promise<void>
  onInsertSkillTrigger(): void
}

function SlashBadge() {
  return (
    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted/65 text-[10px] font-semibold text-muted-foreground">
      /
    </span>
  )
}

export function ComposerInsertMenu({
  disabled = false,
  canPickLocalFile = false,
  onInsertWorkspaceReference,
  onPickLocalFile,
  onInsertSkillTrigger,
}: ComposerInsertMenuProps) {
  const { t } = useTranslation()
  const items = useMemo<readonly ActionPopoverItem[]>(
    () => [
      {
        id: 'workspace-file-reference',
        icon: <AtSign className="size-4 shrink-0 text-muted-foreground" aria-hidden />,
        label: t('composer.insertWorkspaceFile'),
        onSelect: onInsertWorkspaceReference,
      },
      {
        id: 'local-file-picker',
        icon: <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />,
        label: t('composer.selectLocalFile'),
        disabled: !canPickLocalFile,
        onSelect: onPickLocalFile,
      },
      {
        id: 'skill-trigger',
        icon: <SlashBadge />,
        label: t('composer.slashCommand'),
        onSelect: onInsertSkillTrigger,
      },
    ],
    [canPickLocalFile, onInsertSkillTrigger, onInsertWorkspaceReference, onPickLocalFile, t],
  )

  return (
    <ActionPopover
      ariaLabel={t('composer.openInsertPanel')}
      title={t('composer.insert')}
      heading={t('composer.insert')}
      disabled={disabled}
      triggerIcon={<Plus className="size-3.5" aria-hidden />}
      items={items}
    />
  )
}
