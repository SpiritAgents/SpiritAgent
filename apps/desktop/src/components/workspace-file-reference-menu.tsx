import { useTranslation } from "react-i18next";

import { ComposerSuggestionMenuItem } from "@/components/composer-suggestion-menu-item";
import { useComposerSuggestionMenuHighlight } from "@/hooks/useComposerSuggestionMenuHighlight";
import { WorkspaceFilePickerRow } from "@/components/workspace-file-picker-row";

type WorkspaceFileReferenceMenuProps = {
  suggestions: string[];
  selectedIndex: number;
  onApplySuggestion(path: string): void;
};

export function WorkspaceFileReferenceMenu({
  suggestions,
  selectedIndex,
  onApplySuggestion,
}: WorkspaceFileReferenceMenuProps) {
  const { t } = useTranslation();
  const { highlightedIndex, menuPointerHandlers, getItemPointerHandlers } =
    useComposerSuggestionMenuHighlight(selectedIndex, suggestions.length);

  if (suggestions.length === 0) {
    return <div className="px-2 py-2.5 text-xs text-muted-foreground">{t("app.noMatches")}</div>;
  }

  return (
    <div {...menuPointerHandlers}>
      {suggestions.map((path, index) => (
        <ComposerSuggestionMenuItem
          key={path}
          data-workspace-file-reference-index={index}
          selected={index === highlightedIndex}
          title={path}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onApplySuggestion(path)}
          {...getItemPointerHandlers(index)}
        >
          <WorkspaceFilePickerRow path={path} tone="menu" layout="stacked" />
        </ComposerSuggestionMenuItem>
      ))}
    </div>
  );
}
