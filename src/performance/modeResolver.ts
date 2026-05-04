import { getConfig } from '../config/getConfig';
import type { LocalPilotConfig, LocalPilotMode } from '../types';

export type ResolvedLocalPilotMode = Exclude<LocalPilotMode, 'auto'>;

export function resolveLocalPilotMode(
  config: Pick<LocalPilotConfig, 'mode'> = getConfig()
): ResolvedLocalPilotMode {
  if (config.mode === 'auto') {
    return 'lite';
  }

  return config.mode;
}

export function isLowRamMode(mode: LocalPilotMode | ResolvedLocalPilotMode): boolean {
  return mode === 'auto' || mode === 'micro' || mode === 'lite';
}
