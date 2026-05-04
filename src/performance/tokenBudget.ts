import { getConfig } from '../config/getConfig';
import type { LocalPilotConfig } from '../types';
import { resolveLocalPilotMode } from './modeResolver';

export type TokenBudget = {
  maxContextLines: number;
  maxOutputTokens: number;
};

export function getTokenBudget(config: LocalPilotConfig = getConfig()): TokenBudget {
  const mode = resolveLocalPilotMode(config);

  switch (mode) {
    case 'micro':
      return {
        maxContextLines: 40,
        maxOutputTokens: 32
      };
    case 'lite':
      return {
        maxContextLines: 80,
        maxOutputTokens: 64
      };
    case 'standard':
      return {
        maxContextLines: 140,
        maxOutputTokens: 96
      };
    case 'custom':
      return {
        maxContextLines: config.maxContextLines,
        maxOutputTokens: config.maxOutputTokens
      };
  }
}

export function getInlineTokenBudget(config: LocalPilotConfig = getConfig()): TokenBudget {
  const budget = getTokenBudget(config);

  return {
    maxContextLines: budget.maxContextLines,
    maxOutputTokens: budget.maxOutputTokens
  };
}
