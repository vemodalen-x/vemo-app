export const generationPresets = {
  high: {
    label: '高清成片',
    model: 'gpt-image-2.5-sunburst',
    modelLabel: 'GPT Image 2.5 Sunburst',
    quality: 'high',
    edge: 3840,
    pixelLimit: 8_294_400,
    inputEdge: 2304,
  },
  standard: {
    label: '标准预览',
    model: 'gpt-image-2',
    modelLabel: 'GPT Image 2',
    quality: 'medium',
    edge: 1536,
    pixelLimit: 1536 * 1536,
    inputEdge: 1536,
  },
} as const;

export type GenerationPreset = keyof typeof generationPresets;
export const defaultGenerationPreset: GenerationPreset = 'high';
export const maxGenerationInputBytes = 5 * 1024 * 1024;

export function isGenerationPreset(value: unknown): value is GenerationPreset {
  return value === 'high' || value === 'standard';
}

export function generationSize(width: number, height: number, preset: GenerationPreset) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    return '1536x1024';
  }
  const { edge, pixelLimit } = generationPresets[preset];
  const ratio = Math.min(3, Math.max(width, height) / Math.min(width, height));
  const floor16 = (value: number) => Math.floor(value / 16) * 16;
  const long = floor16(Math.min(edge, Math.sqrt(pixelLimit * ratio)));
  const short = Math.min(floor16(pixelLimit / long), Math.max(
    Math.ceil(long / 48) * 16,
    Math.round(long / ratio / 16) * 16,
  ));
  return width >= height ? `${long}x${short}` : `${short}x${long}`;
}
