import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { ConversationContextUsageSnapshot } from '@/types';

const RING_SIZE_PX = 18;
const RING_STROKE_PX = 2.25;
const RING_RADIUS = (RING_SIZE_PX - RING_STROKE_PX) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ComposerContextUsageRing({
  usage,
  busy = false,
}: {
  usage?: ConversationContextUsageSnapshot;
  busy?: boolean;
}) {
  const { t } = useTranslation();

  if (!usage) {
    return null;
  }

  const dashOffset = RING_CIRCUMFERENCE * (1 - usage.percent / 100);
  const ariaLabel = t('composer.contextUsageAria', {
    percent: usage.percent,
    inputTokens: usage.inputTokens,
    contextLength: usage.contextLength,
  });

  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <svg
        width={RING_SIZE_PX}
        height={RING_SIZE_PX}
        viewBox={`0 0 ${RING_SIZE_PX} ${RING_SIZE_PX}`}
        className={cn('shrink-0', busy && 'animate-spin')}
        aria-hidden
      >
        <circle
          cx={RING_SIZE_PX / 2}
          cy={RING_SIZE_PX / 2}
          r={RING_RADIUS}
          fill="none"
          className="stroke-muted-foreground/25"
          strokeWidth={RING_STROKE_PX}
        />
        <circle
          cx={RING_SIZE_PX / 2}
          cy={RING_SIZE_PX / 2}
          r={RING_RADIUS}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={RING_STROKE_PX}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_SIZE_PX / 2} ${RING_SIZE_PX / 2})`}
        />
      </svg>
      <span className="text-xs tabular-nums text-muted-foreground">{usage.percent}%</span>
    </div>
  );
}
