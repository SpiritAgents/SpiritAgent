import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SubagentViewerBannerProps = {
  promptText: string;
  gutterClassName: string;
  maxWidthClassName: string;
  onExit: () => void;
};

export function SubagentViewerBanner({
  promptText,
  gutterClassName,
  maxWidthClassName,
  onExit,
}: SubagentViewerBannerProps) {
  const { t } = useTranslation();

  return (
    <div data-spirit-surface="subagent-viewer-banner" className="shrink-0 bg-background">
      <div
        className={cn(
          'mx-auto flex w-full flex-wrap items-center justify-between gap-2 py-2',
          gutterClassName,
          maxWidthClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t('app.subagentViewerTitle')}</span>
            {promptText ? (
              <>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{promptText}</span>
              </>
            ) : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onExit}>
          {t('app.exitSubagentViewer')}
        </Button>
      </div>
    </div>
  );
}
