import * as assert from 'node:assert/strict';

import { buildExplainErrorPrompt } from '../src/prompts/errorPrompt';

suite('LocalPilot error explainer prompt', () => {
  test('includes beginner-friendly required sections and context', () => {
    const prompt = buildExplainErrorPrompt({
      errorText: 'TypeError: Cannot read properties of undefined',
      languageId: 'typescript',
      selectedCode: 'user.name'
    });

    assert.match(prompt, /What the error means/);
    assert.match(prompt, /Most likely cause/);
    assert.match(prompt, /Step-by-step fix/);
    assert.match(prompt, /Corrected code snippet if possible/);
    assert.match(prompt, /Current file language: typescript/);
    assert.match(prompt, /TypeError/);
    assert.match(prompt, /user\.name/);
  });
});
