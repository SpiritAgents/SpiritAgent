import type { HostToolRequest } from '@spirit-agent/host-internal';

import {
  actOnWindowsUi,
  listWindowsViaComputerUse,
  snapshotWindowsUi,
  type WinComputerUseHelperResponse,
} from '../../electron/win-computer-use.js';

function assertWindowsElectronHost(): void {
  if (process.platform !== 'win32') {
    throw new Error('Computer Use tools are only available on the Windows Electron desktop host.');
  }
}

function formatHelperResponse(response: WinComputerUseHelperResponse): string {
  return JSON.stringify(response, null, 2);
}

export async function executeComputerUseSnapshot(
  request: Extract<HostToolRequest, { name: 'computer_use_snapshot' }>,
): Promise<string> {
  assertWindowsElectronHost();

  if (request.mode === 'list_windows') {
    const response = await listWindowsViaComputerUse();
    return formatHelperResponse(response);
  }

  if (!request.process_name?.trim() && !request.window_title?.trim()) {
    throw new Error('computer_use_snapshot mode=tree requires process_name and/or window_title.');
  }

  const response = await snapshotWindowsUi({
    process_name: request.process_name,
    window_title: request.window_title,
    max_depth: request.max_depth,
    max_nodes: request.max_nodes,
  });
  return formatHelperResponse(response);
}

export async function executeComputerUseAction(
  request: Extract<HostToolRequest, { name: 'computer_use_action' }>,
): Promise<string> {
  assertWindowsElectronHost();

  const response = await actOnWindowsUi({
    ref: request.ref,
    action: request.action,
    text: request.text,
    invoke_timeout_ms: request.invoke_timeout_ms,
  });
  return formatHelperResponse(response);
}

export function isComputerUseToolRequest(
  request: HostToolRequest,
): request is Extract<HostToolRequest, { name: 'computer_use_snapshot' | 'computer_use_action' }> {
  return request.name === 'computer_use_snapshot' || request.name === 'computer_use_action';
}
