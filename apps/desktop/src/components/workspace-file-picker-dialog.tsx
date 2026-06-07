import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FolderOpen } from 'lucide-react'

import { WorkspaceFilePickerRow } from '@/components/workspace-file-picker-row'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  looksLikeAbsolutePath,
  normalizeAbsolutePathInput,
} from '@/lib/file-picker-path'
import { instantHoverMotionClass } from '@/lib/desktop-chrome'
import { cn } from '@/lib/utils'

const FILE_PICKER_SEARCH_DEBOUNCE_MS = 90

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
  statHostTextFile(absolutePath: string): Promise<{ exists: boolean; isFile: boolean }>
}

export function WorkspaceFilePickerDialog({
  open,
  onOpenChange,
  workspaceRoot,
  workspaceBinding,
  onOpenWorkspaceFile,
  onOpenExternalFile,
  listWorkspaceFileReferenceSuggestions,
  statHostTextFile,
}: WorkspaceFilePickerDialogProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [absolutePathExists, setAbsolutePathExists] = useState<boolean | null>(null)
  const requestIdRef = useRef(0)
  const absoluteStatRequestIdRef = useRef(0)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSuggestions([])
      setAbsolutePathExists(null)
      return
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const trimmed = query.trim()
    const workspaceSearchEnabled =
      workspaceBinding === 'project' && workspaceRoot.trim().length > 0

    if (!workspaceSearchEnabled) {
      setSuggestions([])
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const syntheticInput = trimmed ? `@${trimmed}` : '@'
    const cursorChars = trimmed.length + 1

    const timeout = window.setTimeout(() => {
      void listWorkspaceFileReferenceSuggestions({
        input: syntheticInput,
        cursorChars,
      })
        .then((result) => {
          if (requestIdRef.current !== requestId) {
            return
          }
          setSuggestions(result?.suggestions ?? [])
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) {
            return
          }
          setSuggestions([])
        })
    }, FILE_PICKER_SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    listWorkspaceFileReferenceSuggestions,
    open,
    query,
    workspaceBinding,
    workspaceRoot,
  ])

  const trimmedQuery = query.trim()
  const absolutePathCandidate = looksLikeAbsolutePath(trimmedQuery)
    ? normalizeAbsolutePathInput(trimmedQuery)
    : null

  useEffect(() => {
    if (!open || !absolutePathCandidate) {
      setAbsolutePathExists(null)
      return
    }

    const requestId = absoluteStatRequestIdRef.current + 1
    absoluteStatRequestIdRef.current = requestId
    const timeout = window.setTimeout(() => {
      void statHostTextFile(absolutePathCandidate)
        .then((result) => {
          if (absoluteStatRequestIdRef.current !== requestId) {
            return
          }
          setAbsolutePathExists(result.exists && result.isFile)
        })
        .catch(() => {
          if (absoluteStatRequestIdRef.current !== requestId) {
            return
          }
          setAbsolutePathExists(false)
        })
    }, FILE_PICKER_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [absolutePathCandidate, open, statHostTextFile])

  const closeAndOpenWorkspaceFile = (relativePath: string) => {
    onOpenChange(false)
    onOpenWorkspaceFile(relativePath)
  }

  const closeAndOpenExternalFile = (absolutePath: string) => {
    onOpenChange(false)
    onOpenExternalFile(absolutePath)
  }

  const showEmpty =
    suggestions.length === 0
    && (!absolutePathCandidate || absolutePathExists === false)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('workspace.filePickerTitle')}
      description={t('workspace.filePickerDescription')}
      className="max-w-2xl"
    >
      <Command shouldFilter={false} aria-label={t('workspace.filePickerTitle')}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t('workspace.filePickerPlaceholder')}
        />
        <CommandList>
          {absolutePathCandidate && absolutePathExists !== false ? (
            <CommandItem
              key={`absolute:${absolutePathCandidate}`}
              value={`absolute:${absolutePathCandidate}`}
              className={cn(
                'min-w-0 cursor-pointer [&>svg:last-child]:hidden',
                instantHoverMotionClass,
              )}
              onSelect={() => closeAndOpenExternalFile(absolutePathCandidate)}
            >
              <FolderOpen className="size-3.5 shrink-0 text-muted-foreground/75" aria-hidden />
              <span className="min-w-0 truncate text-sm text-popover-foreground">
                {t('workspace.filePickerOpenAbsolutePath', { path: absolutePathCandidate })}
              </span>
            </CommandItem>
          ) : null}
          {suggestions.map((path) => (
            <CommandItem
              key={path}
              value={path}
              className={cn(
                'min-w-0 cursor-pointer [&>svg:last-child]:hidden',
                instantHoverMotionClass,
              )}
              onSelect={() => closeAndOpenWorkspaceFile(path)}
            >
              <WorkspaceFilePickerRow path={path} />
            </CommandItem>
          ))}
          {showEmpty ? (
            <CommandEmpty>
              {absolutePathCandidate && absolutePathExists === false
                ? t('workspace.filePickerAbsolutePathNotFound')
                : t('workspace.filePickerEmpty')}
            </CommandEmpty>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
