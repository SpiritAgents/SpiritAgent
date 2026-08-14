import type { ReactNode } from "react";

import {
  LANDING_FEATURE_DEMO_BOX_FRAME_CLASS,
  LANDING_FEATURE_DEMO_BOX_INNER_CLASS,
  LANDING_FEATURE_DEMO_BOX_INSET_BORDER_CLASS,
} from "@/lib/site-layout";
import { cn } from "@/lib/utils";

type LandingFeatureDemoBoxProps = {
  children?: ReactNode;
  className?: string;
  frameClassName?: string;
  innerClassName?: string;
};

/** Hero-shaped demo shell without mesh — gray frame, inset padding shrinks the inner window. */
export function LandingFeatureDemoBox({
  children,
  className,
  frameClassName = LANDING_FEATURE_DEMO_BOX_FRAME_CLASS,
  innerClassName,
}: LandingFeatureDemoBoxProps) {
  return (
    <div className={cn(frameClassName, className)}>
      <div className={cn(LANDING_FEATURE_DEMO_BOX_INNER_CLASS, innerClassName)}>{children}</div>
      <div className={LANDING_FEATURE_DEMO_BOX_INSET_BORDER_CLASS} aria-hidden />
    </div>
  );
}
