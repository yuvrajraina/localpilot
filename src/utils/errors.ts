export class LocalPilotError extends Error {
  public readonly originalCause?: unknown;

  public constructor(
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = 'LocalPilotError';
    this.originalCause = cause;
  }
}

export class OllamaNotRunningError extends LocalPilotError {
  public constructor(host: string, cause?: unknown) {
    super(`Ollama is not available at ${host}. Start Ollama and try again.`, cause);
    this.name = 'OllamaNotRunningError';
  }
}

export class OllamaUnavailableError extends OllamaNotRunningError {
  public constructor(host: string, cause?: unknown) {
    super(host, cause);
    this.name = 'OllamaUnavailableError';
  }
}

export class ModelNotFoundError extends LocalPilotError {
  public constructor(model: string, cause?: unknown) {
    super(`Ollama model "${model}" was not found locally. Pull the model and try again.`, cause);
    this.name = 'ModelNotFoundError';
  }
}

export class RequestCancelledError extends LocalPilotError {
  public constructor(cause?: unknown) {
    super('The Ollama request was cancelled.', cause);
    this.name = 'RequestCancelledError';
  }
}

export class InvalidOllamaResponseError extends LocalPilotError {
  public constructor(context: string, cause?: unknown) {
    super(`Ollama returned an invalid response while ${context}.`, cause);
    this.name = 'InvalidOllamaResponseError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown LocalPilot error occurred.';
}
