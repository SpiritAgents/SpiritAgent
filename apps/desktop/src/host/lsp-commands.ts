import { findLspProvider, installLspProvider } from '@spirit-agent/host-internal/lsp';

import type { DesktopSnapshot, InstallLspProviderRequest } from '../types.js';
import { buildDesktopLspSnapshot } from './lsp-snapshot.js';
import type { HostModelCommandContext } from './host-model-commands.js';

export async function installLspProviderCommand(
  ctx: HostModelCommandContext,
  request: InstallLspProviderRequest,
): Promise<DesktopSnapshot> {
  return ctx.runSerialized(async () => {
    await ctx.ensureInitialized();
    const providerId = request.providerId.trim();
    const provider = findLspProvider(providerId);
    if (!provider) {
      throw new Error(`Unknown LSP provider: ${request.providerId}`);
    }

    await installLspProvider(provider.id);
    await ctx.disposeAllLspServices();
    ctx.invalidateToolExecutors();
    await ctx.refreshLspSnapshot();

    const wasBusy = ctx.isRuntimeBusy();
    if (wasBusy) {
      ctx.activeBundle().deferredRuntimeRefreshWhileBusy = true;
    } else {
      ctx.activeBundle().deferredRuntimeRefreshWhileBusy = false;
      await ctx.refreshRuntime();
    }
    await ctx.flushDeferredRuntimeRefreshIfIdle();
    return ctx.buildSnapshot();
  });
}
