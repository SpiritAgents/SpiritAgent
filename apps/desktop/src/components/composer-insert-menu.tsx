import { useRef, useState } from 'react'

import { AtSign, File, Plus } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

type InsertActionButtonProps = {
  disabled?: boolean
  icon: React.ReactNode
  label: string
  onClick(): void
}

function InsertActionButton({ disabled = false, icon, label, onClick }: InsertActionButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        'flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none',
        'text-foreground hover:bg-accent hover:text-accent-foreground',
        'focus-visible:bg-accent focus-visible:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

export function ComposerInsertMenu({
  disabled = false,
  canPickLocalFile = false,
  onInsertWorkspaceReference,
  onPickLocalFile,
  onInsertSkillTrigger,
}: ComposerInsertMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  // Radix 在 trigger 的 pointerdown / click 与 outside-dismiss 之间会打架；
  // 这里记一拍，避免手动 toggle 后又被同次 click 反向切回去。
  const suppressTriggerClickRef = useRef(false)

  const closeAndRun = (action: () => void | Promise<void>) => {
    setOpen(false)
    void action()
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="打开插入面板"
          disabled={disabled}
          className="size-7 shrink-0 rounded-full p-0 text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground"
          title="插入"
          onPointerDown={(event) => {
            if (event.button !== 0 || event.ctrlKey || disabled) {
              return
            }
            suppressTriggerClickRef.current = true
            event.preventDefault()
            setOpen((current) => !current)
          }}
          onClick={(event) => {
            if (!suppressTriggerClickRef.current) {
              return
            }
            suppressTriggerClickRef.current = false
            event.preventDefault()
          }}
        >
          <Plus className="size-3.5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-max min-w-[11rem] max-w-[min(15rem,calc(100vw-1.25rem))] p-1"
        onPointerDownOutside={(event) => {
          const target = event.target
          if (!(target instanceof Node)) {
            return
          }
          if (triggerRef.current?.contains(target)) {
            // 点已打开的 trigger 时，应表现为一次正常 toggle；
            // 不要先在 pointerdown 阶段当 outside 关闭，再在 click 阶段重新打开。
            event.preventDefault()
          }
        }}
      >
        <div role="menu" aria-label="插入面板">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">插入</div>
          <div className="grid gap-0.5">
            <InsertActionButton
              icon={<AtSign className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              label="引用工作区文件"
              onClick={() => closeAndRun(onInsertWorkspaceReference)}
            />
            <InsertActionButton
              disabled={!canPickLocalFile}
              icon={<File className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              label="选择本地文件"
              onClick={() => closeAndRun(onPickLocalFile)}
            />
            <InsertActionButton
              icon={<SlashBadge />}
              label="引用 Skill"
              onClick={() => closeAndRun(onInsertSkillTrigger)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
