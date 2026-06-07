import { useTranslation } from 'react-i18next'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command'

type WorkspaceFilePickerDialogProps = {
  open: boolean
  onOpenChange(open: boolean): void
  workspaceRoot: string
  workspaceBinding: 'project' | 'none'
  onOpenWorkspaceFile(relativePath: string): void
  onOpenExternalFile(absolutePath: string): void
  listWorkspaceFileReferenceSuggestions(input: {
    input: string
    cursorChars: number
  }): Promise<{ suggestions: string[] } | null | undefined>
}

export function WorkspaceFilePickerDialog({
  open,
  onOpenChange,
}: WorkspaceFilePickerDialogProps) {
  const { t } = useTranslation()

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('workspace.filePickerTitle')}
      description={t('workspace.filePickerDescription')}
      className="max-w-2xl"
    >
      <Command shouldFilter={false} aria-label={t('workspace.filePickerTitle')}>
        <CommandInput placeholder={t('workspace.filePickerPlaceholder')} />
        <CommandList>
          <CommandEmpty>{t('workspace.filePickerEmpty')}</CommandEmpty>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
