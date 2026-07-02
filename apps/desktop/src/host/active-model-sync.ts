import type { SessionBundle } from './session-bundle.js';

export interface HostActiveModelState {
  config: {
    activeModel: string;
    models: Array<{ name: string }>;
  };
}

export function resolveEffectivePaneActiveModel(
  bundle: Pick<SessionBundle, 'activeModel'>,
  state: HostActiveModelState,
): string {
  const fromBundle = bundle.activeModel?.trim();
  if (fromBundle && state.config.models.some((model) => model.name === fromBundle)) {
    return fromBundle;
  }
  return state.config.activeModel;
}

export function needsHostActiveModelSync(
  bundle: Pick<SessionBundle, 'activeModel'>,
  state: HostActiveModelState,
): boolean {
  const effective = resolveEffectivePaneActiveModel(bundle, state);
  return effective !== state.config.activeModel;
}

export function resolvePaneModelProjection(input: {
  bundle: SessionBundle;
  state: HostActiveModelState;
  isForegroundActive: boolean;
}): { activeModel: string } | undefined {
  if (input.isForegroundActive) {
    return undefined;
  }

  return {
    activeModel: resolveEffectivePaneActiveModel(input.bundle, input.state),
  };
}

/** Capture the current global model on a pane bundle before another pane mutates host config. */
export function freezePaneActiveModelIfNeeded(
  bundle: SessionBundle,
  state: HostActiveModelState,
): void {
  if (!bundle.activeModel?.trim()) {
    bundle.activeModel = state.config.activeModel;
  }
}

export function ensureVisiblePaneActiveModels(
  bundles: SessionBundle[],
  state: HostActiveModelState,
): void {
  for (const bundle of bundles) {
    freezePaneActiveModelIfNeeded(bundle, state);
  }
}
