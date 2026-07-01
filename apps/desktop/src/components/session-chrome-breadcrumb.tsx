import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DESKTOP_CHROME_ACTIVE_TEXT,
  DESKTOP_CHROME_MUTED_TEXT,
} from '@/lib/desktop-chrome';
import { cn } from '@/lib/utils';

type SessionChromeBreadcrumbProps = {
  sessionTitle: string;
  subagentPromptText?: string | null;
  onExitSubagentViewer?: () => void;
};

export function SessionChromeBreadcrumb({
  sessionTitle,
  subagentPromptText,
  onExitSubagentViewer,
}: SessionChromeBreadcrumbProps) {
  const trimmedSessionTitle = sessionTitle.trim();
  const trimmedSubagentPromptText = subagentPromptText?.trim() ?? '';

  if (!trimmedSessionTitle) {
    return null;
  }

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1.5 text-xs font-medium sm:gap-2">
        <BreadcrumbItem
          className={cn(
            'min-w-0',
            trimmedSubagentPromptText
              ? 'max-w-[min(12rem,30vw)] shrink'
              : 'max-w-[min(20rem,40vw)]',
          )}
        >
          {trimmedSubagentPromptText ? (
            <BreadcrumbLink asChild>
              <button
                type="button"
                className={cn(
                  "electron-no-drag min-w-0 truncate",
                  DESKTOP_CHROME_MUTED_TEXT,
                  "hover:text-sidebar-foreground focus-visible:text-sidebar-foreground",
                )}
                title={trimmedSessionTitle}
                onClick={onExitSubagentViewer}
              >
                {trimmedSessionTitle}
              </button>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage
              className={cn("min-w-0 truncate font-medium", DESKTOP_CHROME_MUTED_TEXT)}
              title={trimmedSessionTitle}
            >
              {trimmedSessionTitle}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {trimmedSubagentPromptText ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0 max-w-[min(20rem,40vw)] flex-1">
              <BreadcrumbPage
                className={cn("min-w-0 truncate font-medium", DESKTOP_CHROME_ACTIVE_TEXT)}
                title={trimmedSubagentPromptText}
              >
                {trimmedSubagentPromptText}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
