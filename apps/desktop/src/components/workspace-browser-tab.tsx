import { useTranslation } from "react-i18next";

import { isBrowserNewTabUrl } from "@/lib/workspace-tool-tabs";

export type WorkspaceBrowserTabProps = {
  browserUrl: string | undefined;
  onBrowserUrlChange(url: string): void;
};

/** P1 stub — replaced with full WebView UI in P3. */
export function WorkspaceBrowserTab({ browserUrl }: WorkspaceBrowserTabProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 text-muted-foreground">
      <p>{t("workspace.browserPlaceholder")}</p>
      {!isBrowserNewTabUrl(browserUrl) ? (
        <p className="mt-2 truncate text-xs">{browserUrl}</p>
      ) : null}
    </div>
  );
}
