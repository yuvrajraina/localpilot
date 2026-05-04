import * as assert from 'node:assert/strict';

import { checkOllamaHealth } from '../src/ollama/ollamaHealth';

suite('Ollama health', () => {
  test('returns true when Ollama tags endpoint responds successfully', async () => {
    await withMockedFetch(async () => new Response(JSON.stringify({ models: [] }), { status: 200 }), async () => {
      assert.equal(await checkOllamaHealth('http://localhost:11434'), true);
    });
  });

  test('returns false when Ollama tags endpoint fails', async () => {
    await withMockedFetch(async () => {
      throw new TypeError('connection refused');
    }, async () => {
      assert.equal(await checkOllamaHealth('http://localhost:11434'), false);
    });
  });

  test('returns false instead of throwing for an invalid host', async () => {
    await assert.doesNotReject(async () => {
      assert.equal(await checkOllamaHealth('not-a-valid-url'), false);
    });
  });
});

async function withMockedFetch<T>(mockFetch: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = mockFetch;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
