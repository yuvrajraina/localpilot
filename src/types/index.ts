export type LocalPilotMode = 'auto' | 'micro' | 'lite' | 'standard' | 'custom';
export type InlineCompletionMode = 'line' | 'full';

export type LocalPilotConfig = {
  ollamaHost: string;
  inlineModel: string;
  chatModel: string;
  lowRamModel: string;
  mode: LocalPilotMode;
  inlineCompletionMode: InlineCompletionMode;
  enableInlineSuggestions: boolean;
  maxContextLines: number;
  maxOutputTokens: number;
  temperature: number;
  inlineDebounceMs: number;
  disableInlineForLargeFiles: boolean;
  maxFileSizeKb: number;
  enableLowRamWarnings: boolean;
};
