import type { LocalPilotMode } from '../types';

const MICRO_MODEL = 'smollm2:360m';
const LITE_MODEL = 'qwen2.5-coder:1.5b';
const STANDARD_MODEL = 'qwen2.5-coder:7b';

export function getRecommendedModelForMode(
  mode: LocalPilotMode,
  userSettingValue?: string
): string {
  switch (mode) {
    case 'micro':
      return MICRO_MODEL;
    case 'lite':
      return LITE_MODEL;
    case 'standard':
      return STANDARD_MODEL;
    case 'custom':
      return getCustomModel(userSettingValue);
    case 'auto':
      return LITE_MODEL;
  }
}

function getCustomModel(userSettingValue?: string): string {
  const trimmedValue = userSettingValue?.trim();

  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : STANDARD_MODEL;
}
