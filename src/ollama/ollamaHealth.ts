import { normalizeOllamaHost } from './ollamaClient';

const HEALTH_CHECK_TIMEOUT_MS = 2500;

export async function checkOllamaHealth(host: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, HEALTH_CHECK_TIMEOUT_MS);

  try {
    const url = new URL('/api/tags', `${normalizeOllamaHost(host)}/`);
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });

    return response.ok;
  } catch {
    // Health checks are used by UI entry points, so offline Ollama must be quiet and recoverable.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
