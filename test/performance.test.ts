import * as assert from 'node:assert/strict';

import { CompletionCache, buildCompletionCacheKey } from '../src/performance/completionCache';
import { resolveLocalPilotMode } from '../src/performance/modeResolver';
import { LocalPilotRequestLimiter } from '../src/performance/requestLimiter';
import { getTokenBudget } from '../src/performance/tokenBudget';
import type { LocalPilotConfig } from '../src/types';

const BASE_CONFIG: LocalPilotConfig = {
  ollamaHost: 'http://localhost:11434',
  inlineModel: 'qwen2.5-coder:1.5b',
  chatModel: 'qwen2.5-coder:7b',
  lowRamModel: 'qwen2.5-coder:0.5b',
  mode: 'auto',
  inlineCompletionMode: 'full',
  enableInlineSuggestions: true,
  maxContextLines: 200,
  maxOutputTokens: 300,
  temperature: 0.2,
  inlineDebounceMs: 250,
  disableInlineForLargeFiles: true,
  maxFileSizeKb: 500,
  enableLowRamWarnings: true
};

suite('LocalPilot performance modes', () => {
  test('resolves auto mode to conservative lite behavior', () => {
    assert.equal(resolveLocalPilotMode({ mode: 'auto' }), 'lite');
  });

  test('returns fixed token budgets for built-in modes', () => {
    assert.deepEqual(getTokenBudget({ ...BASE_CONFIG, mode: 'micro' }), {
      maxContextLines: 40,
      maxOutputTokens: 32
    });
    assert.deepEqual(getTokenBudget({ ...BASE_CONFIG, mode: 'lite' }), {
      maxContextLines: 80,
      maxOutputTokens: 64
    });
    assert.deepEqual(getTokenBudget({ ...BASE_CONFIG, mode: 'standard' }), {
      maxContextLines: 140,
      maxOutputTokens: 96
    });
  });

  test('uses user settings in custom mode', () => {
    assert.deepEqual(getTokenBudget({ ...BASE_CONFIG, mode: 'custom' }), {
      maxContextLines: 200,
      maxOutputTokens: 300
    });
  });
});

suite('LocalPilot request limiter', () => {
  test('cancels stale inline requests', () => {
    const limiter = new LocalPilotRequestLimiter();
    const first = limiter.startInlineRequest();
    const second = limiter.startInlineRequest();

    assert.equal(first.signal.aborted, true);
    assert.equal(second.signal.aborted, false);

    limiter.dispose();
  });

  test('allows chat and inline requests separately', () => {
    const limiter = new LocalPilotRequestLimiter();
    const inline = limiter.startInlineRequest();
    const chat = limiter.startChatRequest();

    assert.equal(inline.signal.aborted, false);
    assert.equal(chat.signal.aborted, false);

    limiter.dispose();
  });
});

suite('LocalPilot completion cache', () => {
  test('keys completions by model as well as file, line, and prefix', () => {
    const first = buildCompletionCacheKey({
      fileUri: 'file:///src/app.ts',
      line: 3,
      character: 12,
      prefix: 'const value =',
      suffix: ';',
      model: 'model-a'
    });
    const second = buildCompletionCacheKey({
      fileUri: 'file:///src/app.ts',
      line: 3,
      character: 12,
      prefix: 'const value =',
      suffix: ';',
      model: 'model-b'
    });

    assert.notEqual(first, second);
  });

  test('keys completions by cursor character and suffix to avoid stale inline suggestions', () => {
    const first = buildCompletionCacheKey({
      fileUri: 'file:///src/app.ts',
      line: 3,
      character: 12,
      prefix: 'const value =',
      suffix: ';',
      model: 'model-a'
    });
    const differentCharacter = buildCompletionCacheKey({
      fileUri: 'file:///src/app.ts',
      line: 3,
      character: 13,
      prefix: 'const value =',
      suffix: ';',
      model: 'model-a'
    });
    const differentSuffix = buildCompletionCacheKey({
      fileUri: 'file:///src/app.ts',
      line: 3,
      character: 12,
      prefix: 'const value =',
      suffix: ';\nconsole.log(value);',
      model: 'model-a'
    });

    assert.notEqual(first, differentCharacter);
    assert.notEqual(first, differentSuffix);
  });

  test('evicts least recently used entries', () => {
    const cache = new CompletionCache(2);

    cache.set('a', 'first');
    cache.set('b', 'second');
    assert.equal(cache.get('a'), 'first');
    cache.set('c', 'third');

    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 'first');
    assert.equal(cache.get('c'), 'third');
  });
});
