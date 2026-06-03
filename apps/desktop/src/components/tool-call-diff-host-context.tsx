import { createContext, useContext, type ReactNode } from 'react';

import type { WorkspaceReadTextFileResult } from '@/types';

export type ToolCallDiffHostContextValue = {
  workspaceRoot: string;
  readWorkspaceTextFile: (relativePath: string) => Promise<WorkspaceReadTextFileResult>;
};

const ToolCallDiffHostContext = createContext<ToolCallDiffHostContextValue | null>(null);

export function ToolCallDiffHostProvider({
  value,
  children,
}: {
  value: ToolCallDiffHostContextValue;
  children: ReactNode;
}) {
  return (
    <ToolCallDiffHostContext.Provider value={value}>{children}</ToolCallDiffHostContext.Provider>
  );
}

export function useToolCallDiffHost(): ToolCallDiffHostContextValue | null {
  return useContext(ToolCallDiffHostContext);
}
