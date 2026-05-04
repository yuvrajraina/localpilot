import * as assert from 'node:assert/strict';

import { normalizeReplacement } from '../src/apply/applyToEditor';

suite('LocalPilot safe apply workflow', () => {
  test('normalizes fenced proposed code', () => {
    assert.equal(normalizeReplacement('```ts\nconst value = 1;\n```'), 'const value = 1;');
  });

  test('preserves meaningful indentation in proposed code', () => {
    assert.equal(normalizeReplacement('```ts\n  return value + 1;\n```'), '  return value + 1;');
  });

  test('rejects empty proposed code', () => {
    assert.equal(normalizeReplacement('```ts\n\n```'), '');
    assert.equal(normalizeReplacement('   '), '');
  });
});
