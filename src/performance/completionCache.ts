const DEFAULT_MAX_ENTRIES = 100;

export type CompletionCacheKeyParams = {
  fileUri: string;
  line: number;
  character: number;
  prefix: string;
  suffix: string;
  model: string;
};

export class CompletionCache {
  private readonly entries = new Map<string, string>();

  public constructor(private readonly maxEntries = DEFAULT_MAX_ENTRIES) {}

  public get(key: string): string | undefined {
    const value = this.entries.get(key);

    if (value === undefined) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, value);

    return value;
  }

  public set(key: string, value: string): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, value);

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;

      if (!oldestKey) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }

  public clear(): void {
    this.entries.clear();
  }

  public size(): number {
    return this.entries.size;
  }
}

export function buildCompletionCacheKey(params: CompletionCacheKeyParams): string {
  return [
    params.fileUri,
    params.line,
    params.character,
    hashString(params.prefix),
    hashString(params.suffix),
    params.model
  ].join('|');
}

export function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}
