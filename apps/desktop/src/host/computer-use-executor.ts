import type { HostToolRequest } from '@spirit-agent/host-internal';

import { actViaCdp, snapshotViaCdp } from '../../electron/win-computer-use-cdp.js';
import {
  actOnWindowsUi,
  listWindowsViaComputerUse,
  snapshotWindowsUi,
  type WinComputerUseHelperResponse,
} from '../../electron/win-computer-use.js';
import { isCdpComputerUseRef, pruneComputerUseTree } from '../lib/computer-use-tree.js';

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

  const uiaResponse = await snapshotWindowsUi({
    process_name: request.process_name,
    window_title: request.window_title,
    max_depth: request.max_depth,
    max_nodes: request.max_nodes,
  });

  if (!uiaResponse.ok) {
    return formatHelperResponse(uiaResponse);
  }

  const uiaData = uiaResponse.data as {
    host_kind?: string;
    window?: { hwnd: number; title: string; process_name: string };
    tree?: unknown;
  } | undefined;

  if (uiaData?.host_kind !== 'cef') {
    return formatHelperResponse({
      ...uiaResponse,
      data: {
        ...uiaData,
        transport: 'uia',
      },
    });
  }

  const debugPort = (request as { debug_port?: number }).debug_port;
  const cdpResponse = await snapshotViaCdp({
    debug_port: debugPort,
    window_title: request.window_title ?? uiaData.window?.title,
    process_name: request.process_name ?? uiaData.window?.process_name,
    max_depth: request.max_depth,
    max_nodes: request.max_nodes,
  });

  if (!cdpResponse.ok || !cdpResponse.data) {
    return formatHelperResponse(cdpResponse);
  }

  const prunedTree = cdpResponse.data.tree ? pruneComputerUseTree(cdpResponse.data.tree) : null;
  return formatHelperResponse({
    ok: true,
    data: {
      ...cdpResponse.data,
      host_kind: 'cef',
      tree: prunedTree,
      uia_window: uiaData.window,
    },
  });
}

export async function executeComputerUseAction(
  request: Extract<HostToolRequest, { name: 'computer_use_action' }>,
): Promise<string> {
  assertWindowsElectronHost();

  if (isCdpComputerUseRef(request.ref)) {
    const debugPort = (request as { debug_port?: number }).debug_port;
    const response = await actViaCdp({
      ref: request.ref,
      action: request.action,
      text: request.text,
      debug_port: debugPort,
      window_title: request.window_title,
      process_name: request.process_name,
    });
    return formatHelperResponse(response);
  }

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
