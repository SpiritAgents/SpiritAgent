export type DirectMediaTool = 'generate_image' | 'generate_video';

type ModelWithCapabilities = {
  name: string;
  capabilities?: readonly string[];
};

type ComposerDirectMediaConfig = {
  models: readonly ModelWithCapabilities[];
  imageGenerationModel?: string;
  videoGenerationModel?: string;
};

function supportsImageGeneration(model: ModelWithCapabilities): boolean {
  return model.capabilities?.includes('imageGeneration') === true;
}

function supportsVideoGeneration(model: ModelWithCapabilities): boolean {
  return model.capabilities?.includes('videoGeneration') === true;
}

export function resolveComposerDirectMediaTool(
  activeModel: string,
  config: ComposerDirectMediaConfig,
): DirectMediaTool | null {
  const trimmedActive = activeModel.trim();
  if (!trimmedActive) {
    return null;
  }

  const matchesVideoSlot = config.videoGenerationModel?.trim() === trimmedActive;
  const matchesImageSlot = config.imageGenerationModel?.trim() === trimmedActive;

  if (matchesVideoSlot && matchesImageSlot) {
    console.debug(
      '[desktop][composer-direct-media] active model matches both image and video default slots; preferring generate_video',
      { activeModel: trimmedActive },
    );
  }

  if (matchesVideoSlot) {
    const profile = config.models.find((model) => model.name === trimmedActive);
    if (profile && supportsVideoGeneration(profile)) {
      return 'generate_video';
    }
  }

  if (matchesImageSlot) {
    const profile = config.models.find((model) => model.name === trimmedActive);
    if (profile && supportsImageGeneration(profile)) {
      return 'generate_image';
    }
  }

  return null;
}
