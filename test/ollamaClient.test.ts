import * as assert from 'node:assert/strict';

import {
  generateCompletion,
  parseChatResponse,
  parseGenerateResponse,
  parseOllamaModelList
} from '../src/ollama/ollamaClient';
import { getRecommendedModelForMode } from '../src/ollama/modelManager';
import { InvalidOllamaResponseError, ModelNotFoundError } from '../src/utils/errors';

suite('Ollama client parsing', () => {
  test('parses model names, sizes, and modified dates', () => {
    const models = parseOllamaModelList({
      models: [
        {
          name: 'codegemma:2b',
          model: 'codegemma:2b',
          modified_at: '2026-05-01T12:00:00Z',
          size: 1600000000,
          digest: 'abc123',
          details: {
            family: 'gemma',
            families: ['gemma'],
            parameter_size: '2B',
            quantization_level: 'Q4_K_M'
          }
        }
      ]
    });

    assert.deepEqual(models, [
      {
        name: 'codegemma:2b',
        model: 'codegemma:2b',
        modifiedAt: '2026-05-01T12:00:00Z',
        size: 1600000000,
        digest: 'abc123',
        details: {
          family: 'gemma',
          families: ['gemma'],
          parameterSize: '2B',
          quantizationLevel: 'Q4_K_M'
        }
      }
    ]);
  });

  test('rejects malformed model lists', () => {
    assert.throws(() => parseOllamaModelList({ models: [{}] }), InvalidOllamaResponseError);
  });

  test('parses completion response text only', () => {
    assert.equal(parseGenerateResponse({ response: 'const value = 1;', done: true }, 'codegemma:2b'), 'const value = 1;');
  });

  test('parses assistant chat content only', () => {
    assert.equal(
      parseChatResponse(
        {
          message: {
            role: 'assistant',
            content: 'The function validates input before returning.'
          },
          done: true
        },
        'codegemma:2b'
      ),
      'The function validates input before returning.'
    );
  });

  test('turns model errors into ModelNotFoundError', () => {
    assert.throws(
      () => parseGenerateResponse({ error: 'model "missing:latest" not found' }, 'missing:latest'),
      ModelNotFoundError
    );
  });

  test('throws InvalidOllamaResponseError for invalid JSON responses', async () => {
    await withMockedFetch(async () => new Response('not-json', { status: 200 }), async () => {
      await assert.rejects(
        () =>
          generateCompletion({
            host: 'http://localhost:11434',
            model: 'codegemma:2b',
            prompt: 'complete this'
          }),
        InvalidOllamaResponseError
      );
    });
  });

  test('throws ModelNotFoundError when Ollama reports a missing model', async () => {
    await withMockedFetch(
      async () =>
        new Response(JSON.stringify({ error: 'model "missing:latest" not found' }), {
          status: 404
        }),
      async () => {
        await assert.rejects(
          () =>
            generateCompletion({
              host: 'http://localhost:11434',
              model: 'missing:latest',
              prompt: 'complete this'
            }),
          ModelNotFoundError
        );
      }
    );
  });
});

suite('Ollama model manager', () => {
  test('returns safe defaults for built-in modes', () => {
    assert.equal(getRecommendedModelForMode('micro'), 'smollm2:360m');
    assert.equal(getRecommendedModelForMode('lite'), 'qwen2.5-coder:1.5b');
    assert.equal(getRecommendedModelForMode('standard'), 'qwen2.5-coder:7b');
    assert.equal(getRecommendedModelForMode('auto'), 'qwen2.5-coder:1.5b');
  });

  test('returns the user setting for custom mode', () => {
    assert.equal(getRecommendedModelForMode('custom', 'qwen2.5-coder:1.5b'), 'qwen2.5-coder:1.5b');
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
