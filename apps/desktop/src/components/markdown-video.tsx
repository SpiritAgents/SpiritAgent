import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";

import { isManagedGeneratedVideoRef } from "@/lib/managed-generated-asset";
import { cn } from "@/lib/utils";

export type ReadManagedVideoPreviewUrl = (reference: string) => Promise<string | null>;
type ManagedVideoLoadState = "idle" | "loading" | "unavailable";

export function MarkdownVideo({
  className,
  src,
  readManagedVideoPreviewUrl,
  ...props
}: ComponentPropsWithoutRef<"video"> & {
  readManagedVideoPreviewUrl?: ReadManagedVideoPreviewUrl;
}) {
  const { t } = useTranslation();
  const normalizedSrc = typeof src === "string" && src.trim().length > 0 ? src.trim() : null;
  const managedRef = normalizedSrc && isManagedGeneratedVideoRef(normalizedSrc) ? normalizedSrc : null;
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(managedRef ? null : normalizedSrc);
  const [managedLoadState, setManagedLoadState] = useState<ManagedVideoLoadState>("idle");

  useEffect(() => {
    let cancelled = false;

    if (!normalizedSrc) {
      setResolvedSrc(null);
      setManagedLoadState("idle");
      return () => {
        cancelled = true;
      };
    }

    if (!managedRef) {
      setResolvedSrc(normalizedSrc);
      setManagedLoadState("idle");
      return () => {
        cancelled = true;
      };
    }

    if (!readManagedVideoPreviewUrl) {
      setResolvedSrc(null);
      setManagedLoadState("unavailable");
      return () => {
        cancelled = true;
      };
    }

    setResolvedSrc(null);
    setManagedLoadState("loading");
    void readManagedVideoPreviewUrl(managedRef)
      .then((previewUrl: string | null) => {
        if (!cancelled) {
          if (previewUrl) {
            setResolvedSrc(previewUrl);
            setManagedLoadState("idle");
            return;
          }
          setResolvedSrc(null);
          setManagedLoadState("unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSrc(null);
          setManagedLoadState("unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [managedRef, normalizedSrc, readManagedVideoPreviewUrl]);

  const placeholderClassName =
    "my-3 flex min-h-28 w-full items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/20 px-3 text-xs text-muted-foreground";

  if (managedRef && !readManagedVideoPreviewUrl) {
    return (
      <span className={cn("block", placeholderClassName)}>
        {t("error.hostNotSupported")}
      </span>
    );
  }

  if (managedRef && managedLoadState === "loading") {
    return (
      <span className={cn("block", placeholderClassName)}>
        {t("error.loading")}
      </span>
    );
  }

  if (managedRef && managedLoadState === "unavailable") {
    return (
      <span className={cn("block", placeholderClassName)}>
        {t("error.unavailable")}
      </span>
    );
  }

  if (!resolvedSrc) {
    return null;
  }

  return (
    <video
      className={cn(
        "my-3 block max-h-[28rem] w-full max-w-full rounded-md border border-border/40 bg-background/40 object-contain shadow-sm",
        className,
      )}
      src={resolvedSrc}
      controls
      preload="metadata"
      {...props}
    />
  );
}
