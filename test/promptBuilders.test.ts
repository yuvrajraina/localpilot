import * as assert from 'node:assert/strict';

import type { BuiltContext } from '../src/context/fileContext';
import { buildAutocompletePrompt } from '../src/prompts/autocompletePrompt';
import { buildExplainPrompt } from '../src/prompts/explainPrompt';
import { buildFixPrompt } from '../src/prompts/fixPrompt';

const CONTEXT: Extract<BuiltContext, { allowed: true }> = {
  allowed: true,
  intent: 'fixCode',
  promptContext: ['Selected code:', '```ts', 'const result = user.name;', '```'].join('\n'),
  redacted: false,
  languageId: 'typescript',
  fileName: 'example.ts',
  lineNumber: 1
};

const INLINE_CONTEXT: Extract<BuiltContext, { allowed: true }> = {
  allowed: true,
  intent: 'inlineCompletion',
  promptContext: [
    'Prefix:',
    'const total = ',
    'Suffix:',
    'return total;'
  ].join('\n'),
  redacted: false,
  languageId: 'typescript',
  fileName: 'example.ts',
  lineNumber: 12,
  prefix: 'const total = ',
  suffix: 'return total;'
};

suite('LocalPilot prompt builders', () => {
  test('autocomplete prompt explicitly forbids markdown output', () => {
    const prompt = buildAutocompletePrompt({ context: INLINE_CONTEXT });

    assert.match(prompt, /Do not return markdown/);
    assert.match(prompt, /code fences/);
  });

  test('autocomplete prompt uses only the prefix because suffix is sent separately', () => {
    const prompt = buildAutocompletePrompt({ context: INLINE_CONTEXT });

    assert.match(prompt, /<LOCALPILOT_PREFIX>/);
    assert.match(prompt, /const total = /);
    assert.doesNotMatch(prompt, /```/);
    assert.doesNotMatch(prompt, /return total;/);
  });

  test('autocomplete prompt asks for valid Python block indentation', () => {
    const prompt = buildAutocompletePrompt({
      context: {
        ...INLINE_CONTEXT,
        languageId: 'python',
        prefix: 'if value:',
        suffix: ''
      }
    });

    assert.match(prompt, /For Python/);
    assert.match(prompt, /correctly indented body/);
    assert.match(prompt, /malformed or incomplete code/);
  });

  test('autocomplete prompt supports one-line and full completion modes', () => {
    const linePrompt = buildAutocompletePrompt({
      context: INLINE_CONTEXT,
      completionMode: 'line'
    });
    const fullPrompt = buildAutocompletePrompt({
      context: INLINE_CONTEXT,
      completionMode: 'full'
    });

    assert.match(linePrompt, /at most one logical code line/);
    assert.match(fullPrompt, /no longer than 8 lines/);
    assert.match(linePrompt, /Do not return comments/);
  });

  test('explain prompt includes selected code context', () => {
    const prompt = buildExplainPrompt(CONTEXT);

    assert.match(prompt, /Explain the selected code/);
    assert.match(prompt, /const result = user\.name;/);
  });

  test('fix prompt includes known error and selected code', () => {
    const prompt = buildFixPrompt(CONTEXT, 'TypeError: Cannot read properties of undefined');

    assert.match(prompt, /Known error or symptom/);
    assert.match(prompt, /TypeError/);
    assert.match(prompt, /const result = user\.name;/);
  });
});
