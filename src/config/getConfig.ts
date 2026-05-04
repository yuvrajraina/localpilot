import * as vscode from 'vscode';

import type { InlineCompletionMode, LocalPilotConfig, LocalPilotMode } from '../types';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
const DEFAULT_INLINE_MODEL = 'qwen2.5-coder:1.5b';
const DEFAULT_CHAT_MODEL = 'qwen2.5-coder:7b';
const DEFAULT_LOW_RAM_MODEL = 'qwen2.5-coder:0.5b';
const DEFAULT_MODE: LocalPilotMode = 'auto';
const DEFAULT_INLINE_COMPLETION_MODE: InlineCompletionMode = 'full';

const MODES = new Set<LocalPilotMode>(['auto', 'micro', 'lite', 'standard', 'custom']);
const INLINE_COMPLETION_MODES = new Set<InlineCompletionMode>(['line', 'full']);

export function getConfig(): LocalPilotConfig {
  const config = vscode.workspace.getConfiguration('localpilot');
  const mode = config.get<LocalPilotMode>('mode', DEFAULT_MODE);
  const inlineCompletionMode = config.get<InlineCompletionMode>(
    'inlineCompletionMode',
    DEFAULT_INLINE_COMPLETION_MODE
  );

  return {
    ollamaHost: normalizeHost(config.get<string>('ollamaHost', DEFAULT_OLLAMA_HOST)),
    inlineModel: config.get<string>('inlineModel', DEFAULT_INLINE_MODEL),
    chatModel: config.get<string>('chatModel', DEFAULT_CHAT_MODEL),
    lowRamModel: config.get<string>('lowRamModel', DEFAULT_LOW_RAM_MODEL),
    mode: MODES.has(mode) ? mode : DEFAULT_MODE,
    inlineCompletionMode: INLINE_COMPLETION_MODES.has(inlineCompletionMode)
      ? inlineCompletionMode
      : DEFAULT_INLINE_COMPLETION_MODE,
    enableInlineSuggestions: config.get<boolean>('enableInlineSuggestions', true),
    maxContextLines: clamp(config.get<number>('maxContextLines', 80), 10, 400),
    maxOutputTokens: clamp(config.get<number>('maxOutputTokens', 160), 16, 1024),
    temperature: clamp(config.get<number>('temperature', 0.2), 0, 1),
    inlineDebounceMs: clamp(config.get<number>('inlineDebounceMs', 250), 50, 2000),
    disableInlineForLargeFiles: config.get<boolean>('disableInlineForLargeFiles', true),
    maxFileSizeKb: clamp(config.get<number>('maxFileSizeKb', 500), 50, 500),
    enableLowRamWarnings: config.get<boolean>('enableLowRamWarnings', true)
  };
}

function normalizeHost(host: string): string {
  const trimmedHost = host.trim();

  if (trimmedHost.length === 0) {
    return DEFAULT_OLLAMA_HOST;
  }

  return trimmedHost.replace(/\/+$/, '');
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
