import {
  InvalidOllamaResponseError,
  LocalPilotError,
  ModelNotFoundError,
  OllamaNotRunningError,
  RequestCancelledError
} from '../utils/errors';
import type {
  GenerateChatParams,
  GenerateCompletionParams,
  OllamaChatMessage,
  OllamaModel,
  OllamaModelDetails,
  OllamaPullProgress,
  PullModelParams
} from './ollamaTypes';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

export async function listLocalModels(host: string): Promise<OllamaModel[]> {
  const response = await fetchOllama(host, '/api/tags', { method: 'GET' });
  const payload = await readJsonResponse(response, 'listing local models');

  return parseOllamaModelList(payload);
}

export async function generateCompletion(params: GenerateCompletionParams): Promise<string> {
  const response = await fetchOllama(params.host, '/api/generate', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(removeUndefinedValues({
      model: params.model,
      prompt: params.prompt,
      suffix: params.suffix,
      stream: false,
      options: params.options
    })),
    signal: params.signal
  });

  const payload = await readJsonResponse(response, 'generating a completion', params.model);

  return parseGenerateResponse(payload, params.model);
}

export async function generateChat(params: GenerateChatParams): Promise<string> {
  const response = await fetchOllama(params.host, '/api/chat', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(removeUndefinedValues({
      model: params.model,
      messages: params.messages,
      stream: false,
      options: params.options
    })),
    signal: params.signal
  });

  const payload = await readJsonResponse(response, 'generating a chat response', params.model);

  return parseChatResponse(payload, params.model);
}

export async function pullModel(params: PullModelParams): Promise<OllamaPullProgress> {
  const shouldStream = params.stream ?? Boolean(params.onProgress);
  const response = await fetchOllama(params.host, '/api/pull', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(removeUndefinedValues({
      name: params.model,
      insecure: params.insecure,
      stream: shouldStream
    })),
    signal: params.signal
  });

  if (!response.ok) {
    await throwForBadResponse(response, params.model);
  }

  if (!shouldStream) {
    const payload = await readJsonResponse(response, 'pulling a model', params.model);
    const progress = parsePullProgress(payload);

    params.onProgress?.(progress);

    return progress;
  }

  return readPullStream(response, params);
}

export function parseOllamaModelList(payload: unknown): OllamaModel[] {
  const record = expectRecord(payload, 'listing local models');
  const models = record.models;

  if (!Array.isArray(models)) {
    throw new InvalidOllamaResponseError('listing local models');
  }

  return models.map((model) => parseOllamaModel(model));
}

export function parseGenerateResponse(payload: unknown, model: string): string {
  const record = expectRecord(payload, 'parsing a completion response');
  throwIfModelError(record, model);

  if (typeof record.response !== 'string') {
    throw new InvalidOllamaResponseError('parsing a completion response');
  }

  return record.response;
}

export function parseChatResponse(payload: unknown, model: string): string {
  const record = expectRecord(payload, 'parsing a chat response');
  throwIfModelError(record, model);

  const message = expectRecord(record.message, 'parsing a chat response');

  if (!isOllamaChatMessage(message)) {
    throw new InvalidOllamaResponseError('parsing a chat response');
  }

  return message.content;
}

export function normalizeOllamaHost(host: string): string {
  const trimmedHost = host.trim();

  if (trimmedHost.length === 0) {
    return DEFAULT_OLLAMA_HOST;
  }

  return trimmedHost.replace(/\/+$/, '');
}

async function fetchOllama(host: string, path: string, init: RequestInit): Promise<Response> {
  let url: URL;

  try {
    url = new URL(path, `${normalizeOllamaHost(host)}/`);
  } catch (cause) {
    throw new OllamaNotRunningError(host, cause);
  }

  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      await throwForBadResponse(response);
    }

    return response;
  } catch (cause) {
    throw toOllamaError(host, cause);
  }
}

async function readJsonResponse(
  response: Response,
  context: string,
  model?: string
): Promise<unknown> {
  if (!response.ok) {
    await throwForBadResponse(response, model);
  }

  try {
    return await response.json();
  } catch (cause) {
    if (isCancellation(cause)) {
      throw new RequestCancelledError(cause);
    }

    throw new InvalidOllamaResponseError(context, cause);
  }
}

async function throwForBadResponse(response: Response, model?: string): Promise<never> {
  const message = await readErrorMessage(response);
  const requestedModel = model ?? findModelName(message);

  if (response.status === 404 || isModelNotFoundMessage(message)) {
    throw new ModelNotFoundError(requestedModel ?? 'unknown', message);
  }

  throw new LocalPilotError(
    `Ollama request failed with ${response.status} ${response.statusText}: ${message}`
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();

    if (text.trim().length === 0) {
      return 'No error details were returned.';
    }

    try {
      const payload: unknown = JSON.parse(text);
      const record = isRecord(payload) ? payload : undefined;

      return typeof record?.error === 'string' ? record.error : text;
    } catch {
      return text;
    }
  } catch {
    return 'Unable to read error details.';
  }
}

async function readPullStream(
  response: Response,
  params: PullModelParams
): Promise<OllamaPullProgress> {
  if (!response.body) {
    throw new InvalidOllamaResponseError('reading a model pull stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastProgress: OllamaPullProgress | undefined;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = parseBufferedPullLines(buffer);

      buffer = parsed.remaining;

      for (const progress of parsed.progress) {
        lastProgress = progress;
        params.onProgress?.(progress);
      }

      if (done) {
        break;
      }
    }
  } catch (cause) {
    if (isCancellation(cause)) {
      throw new RequestCancelledError(cause);
    }

    throw cause;
  }

  const finalLine = buffer.trim();

  if (finalLine.length > 0) {
    lastProgress = parsePullProgressLine(finalLine);
    params.onProgress?.(lastProgress);
  }

  return lastProgress ?? { status: 'completed' };
}

function parseBufferedPullLines(buffer: string): {
  progress: OllamaPullProgress[];
  remaining: string;
} {
  const lines = buffer.split('\n');
  const remaining = lines.pop() ?? '';
  const progress = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parsePullProgressLine(line));

  return { progress, remaining };
}

function parsePullProgressLine(line: string): OllamaPullProgress {
  try {
    return parsePullProgress(JSON.parse(line));
  } catch (cause) {
    throw new InvalidOllamaResponseError('reading a model pull stream', cause);
  }
}

function parsePullProgress(payload: unknown): OllamaPullProgress {
  const record = expectRecord(payload, 'pulling a model');

  if (typeof record.error === 'string') {
    throw new LocalPilotError(record.error);
  }

  if (typeof record.status !== 'string') {
    throw new InvalidOllamaResponseError('pulling a model');
  }

  return removeUndefinedValues({
    status: record.status,
    digest: getString(record.digest),
    total: getFiniteNumber(record.total),
    completed: getFiniteNumber(record.completed)
  });
}

function parseOllamaModel(payload: unknown): OllamaModel {
  const record = expectRecord(payload, 'parsing a model entry');
  const name = getString(record.name) ?? getString(record.model);

  if (!name) {
    throw new InvalidOllamaResponseError('parsing a model entry');
  }

  return removeUndefinedValues({
    name,
    model: getString(record.model),
    size: getFiniteNumber(record.size),
    modifiedAt: getString(record.modified_at) ?? getString(record.modifiedAt),
    digest: getString(record.digest),
    details: parseModelDetails(record.details)
  });
}

function parseModelDetails(payload: unknown): OllamaModelDetails | undefined {
  if (payload === undefined) {
    return undefined;
  }

  const record = expectRecord(payload, 'parsing model details');

  return removeUndefinedValues({
    parentModel: getString(record.parent_model) ?? getString(record.parentModel),
    format: getString(record.format),
    family: getString(record.family),
    families: getStringArray(record.families),
    parameterSize: getString(record.parameter_size) ?? getString(record.parameterSize),
    quantizationLevel: getString(record.quantization_level) ?? getString(record.quantizationLevel)
  });
}

function isOllamaChatMessage(payload: Record<string, unknown>): payload is OllamaChatMessage {
  const role = payload.role;

  return (
    typeof role === 'string' &&
    ['system', 'user', 'assistant', 'tool'].includes(role) &&
    typeof payload.content === 'string'
  );
}

function throwIfModelError(record: Record<string, unknown>, model: string): void {
  if (typeof record.error === 'string' && isModelNotFoundMessage(record.error)) {
    throw new ModelNotFoundError(model, record.error);
  }
}

function isModelNotFoundMessage(message: string): boolean {
  return /model .*not found/i.test(message) || /pull model/i.test(message);
}

function findModelName(message: string): string | undefined {
  return message.match(/model ['"]?([^'"\s]+)['"]? not found/i)?.[1];
}

function expectRecord(payload: unknown, context: string): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new InvalidOllamaResponseError(context);
  }

  return payload;
}

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function removeUndefinedValues<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as T;
}

function toOllamaError(host: string, cause: unknown): Error {
  if (cause instanceof LocalPilotError) {
    return cause;
  }

  if (isCancellation(cause)) {
    return new RequestCancelledError(cause);
  }

  return new OllamaNotRunningError(host, cause);
}

function isCancellation(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}
