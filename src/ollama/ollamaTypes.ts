export type OllamaModelDetails = {
  parentModel?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameterSize?: string;
  quantizationLevel?: string;
};

export type OllamaModel = {
  name: string;
  model?: string;
  size?: number;
  modifiedAt?: string;
  digest?: string;
  details?: OllamaModelDetails;
};

export type OllamaOptionValue = string | number | boolean | string[] | number[] | null;

export type OllamaRequestOptions = Record<string, OllamaOptionValue>;

export type GenerateCompletionParams = {
  host: string;
  model: string;
  prompt: string;
  suffix?: string;
  options?: OllamaRequestOptions;
  signal?: AbortSignal;
};

export type OllamaChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type OllamaChatMessage = {
  role: OllamaChatRole;
  content: string;
  images?: string[];
};

export type GenerateChatParams = {
  host: string;
  model: string;
  messages: OllamaChatMessage[];
  options?: OllamaRequestOptions;
  signal?: AbortSignal;
};

export type OllamaPullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
};

export type PullModelParams = {
  host: string;
  model: string;
  insecure?: boolean;
  stream?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: OllamaPullProgress) => void;
};
