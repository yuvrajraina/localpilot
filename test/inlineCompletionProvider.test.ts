import * as assert from 'node:assert/strict';

import {
  getMaxOutputTokens,
  sanitizeInlineSuggestion
} from '../src/providers/inlineCompletionProvider';

suite('Inline completion provider helpers', () => {
  test('caps generated output by LocalPilot mode', () => {
    assert.equal(getMaxOutputTokens({ mode: 'micro', maxOutputTokens: 512 }), 32);
    assert.equal(getMaxOutputTokens({ mode: 'lite', maxOutputTokens: 512 }), 64);
    assert.equal(getMaxOutputTokens({ mode: 'auto', maxOutputTokens: 512 }), 64);
    assert.equal(getMaxOutputTokens({ mode: 'standard', maxOutputTokens: 512 }), 96);
    assert.equal(getMaxOutputTokens({ mode: 'custom', maxOutputTokens: 128 }), 128);
  });

  test('removes markdown fences and keeps code indentation', () => {
    const suggestion = sanitizeInlineSuggestion('```ts\n  return value + 1;\n```', {
      prefix: 'function demo() {\n',
      suffix: '\n}'
    });

    assert.equal(suggestion, '  return value + 1;');
  });

  test('limits automatic suggestions to eight lines', () => {
    const suggestion = sanitizeInlineSuggestion(
      Array.from({ length: 10 }, (_, index) => `line${index + 1}`).join('\n'),
      { prefix: '', suffix: '' }
    );

    assert.equal(suggestion.split('\n').length, 8);
    assert.equal(suggestion.includes('line9'), false);
  });

  test('line mode keeps only the end of the current line', () => {
    const suggestion = sanitizeInlineSuggestion('count + 1\nconsole.log(count);', {
      prefix: 'const next = ',
      suffix: ';',
      languageId: 'typescript',
      completionMode: 'line'
    });

    assert.equal(suggestion, 'count + 1');
  });

  test('line mode keeps only one next line when completion starts on a new line', () => {
    const suggestion = sanitizeInlineSuggestion('\n  const value = compute();\n  return value;', {
      prefix: 'function demo() {',
      suffix: '\n}',
      languageId: 'typescript',
      completionMode: 'line'
    });

    assert.equal(suggestion, '\n  const value = compute();');
  });

  test('full mode preserves multiline suggestions', () => {
    const suggestion = sanitizeInlineSuggestion('  const value = compute();\n  return value;', {
      prefix: 'function demo() {\n',
      suffix: '\n}',
      languageId: 'typescript',
      completionMode: 'full'
    });

    assert.equal(suggestion, '  const value = compute();\n  return value;');
  });

  test('rejects comment-only autocomplete suggestions', () => {
    const suggestion = sanitizeInlineSuggestion('// calculate the next value', {
      prefix: '',
      suffix: '',
      languageId: 'typescript',
      completionMode: 'line'
    });

    assert.equal(suggestion, '');
  });

  test('strips prose wrappers and suffix punctuation', () => {
    const suggestion = sanitizeInlineSuggestion('Here is the missing code:\nvalue + 1;', {
      prefix: 'return ',
      suffix: ';'
    });

    assert.equal(suggestion, 'value + 1');
  });

  test('removes echoed prefix and suffix text', () => {
    const suggestion = sanitizeInlineSuggestion(
      'const total = count + 1;\nconsole.log(total);',
      {
        prefix: 'const total = ',
        suffix: ';\nconsole.log(total);'
      }
    );

    assert.equal(suggestion, 'count + 1');
  });

  test('reindents left-aligned multiline suggestions relative to cursor indentation', () => {
    const suggestion = sanitizeInlineSuggestion(
      '  const value = compute();\nreturn value;\n}',
      {
        prefix: 'function demo() {\n  ',
        suffix: '\n}'
      }
    );

    assert.equal(suggestion, 'const value = compute();\n  return value;');
  });

  test('preserves first-line indentation and repairs later left-aligned lines', () => {
    const suggestion = sanitizeInlineSuggestion(
      '  const value = compute();\nreturn value;\n}',
      {
        prefix: 'function demo() {\n',
        suffix: '\n}',
        languageId: 'typescript'
      }
    );

    assert.equal(suggestion, '  const value = compute();\n  return value;');
  });

  test('rejects suggestions that only echo the suffix', () => {
    const suggestion = sanitizeInlineSuggestion('existingValue;\n}', {
      prefix: 'return ',
      suffix: 'existingValue;\n}'
    });

    assert.equal(suggestion, '');
  });

  test('rejects prose-only suggestions', () => {
    const suggestion = sanitizeInlineSuggestion('Here is what I would insert.', {
      prefix: '',
      suffix: ''
    });

    assert.equal(suggestion, '');
  });

  test('rejects malformed Python two sum indentation', () => {
    const suggestion = sanitizeInlineSuggestion(
      [
        '        if num not in seen:',
        '    complement = target - num',
        '    if complement in seen and seen[complement] != idx:\\',
        '        return [seen[complement], idx]'
      ].join('\n'),
      {
        prefix: [
          'def two_sums(nums, target):',
          '    seen = {}',
          '    for idx, num in enumerate(nums):'
        ].join('\n'),
        suffix: '',
        languageId: 'python'
      }
    );

    assert.equal(suggestion, '');
  });

  test('keeps valid Python two sum loop body with a leading newline after a block opener', () => {
    const suggestion = sanitizeInlineSuggestion(
      [
        '        complement = target - num',
        '        if complement in seen:',
        '            return [seen[complement], idx]',
        '        seen[num] = idx'
      ].join('\n'),
      {
        prefix: [
          'def two_sums(nums, target):',
          '    seen = {}',
          '    for idx, num in enumerate(nums):'
        ].join('\n'),
        suffix: '',
        languageId: 'python'
      }
    );

    assert.equal(
      suggestion,
      [
        '',
        '        complement = target - num',
        '        if complement in seen:',
        '            return [seen[complement], idx]',
        '        seen[num] = idx'
      ].join('\n')
    );
  });

  test('line mode returns only the next Python line after a block opener', () => {
    const suggestion = sanitizeInlineSuggestion(
      [
        '        complement = target - num',
        '        if complement in seen:',
        '            return [seen[complement], idx]'
      ].join('\n'),
      {
        prefix: [
          'def two_sums(nums, target):',
          '    seen = {}',
          '    for idx, num in enumerate(nums):'
        ].join('\n'),
        suffix: '',
        languageId: 'python',
        completionMode: 'line'
      }
    );

    assert.equal(suggestion, '\n        complement = target - num');
  });

  test('preserves valid Python first-line indentation while repairing later left-aligned lines', () => {
    const suggestion = sanitizeInlineSuggestion(
      [
        '        complement = target - num',
        'if complement in seen:',
        '    return [seen[complement], idx]',
        'seen[num] = idx'
      ].join('\n'),
      {
        prefix: [
          'def two_sums(nums, target):',
          '    seen = {}',
          '    for idx, num in enumerate(nums):'
        ].join('\n'),
        suffix: '',
        languageId: 'python'
      }
    );

    assert.equal(
      suggestion,
      [
        '',
        '        complement = target - num',
        '        if complement in seen:',
        '            return [seen[complement], idx]',
        '        seen[num] = idx'
      ].join('\n')
    );
  });

  test('adds Python block-body indentation when a block opener is at the cursor', () => {
    const suggestion = sanitizeInlineSuggestion('print(value)', {
      prefix: 'if value:',
      suffix: '',
      languageId: 'python'
    });

    assert.equal(suggestion, '\n    print(value)');
  });

  test('normalizes nested Python completions with two-space indentation', () => {
    const suggestion = sanitizeInlineSuggestion(
      ['value = 1', 'if value:', '  return value'].join('\n'),
      {
        prefix: 'def demo():\n  if ready:',
        suffix: '',
        languageId: 'python'
      }
    );

    assert.equal(suggestion, '\n    value = 1\n    if value:\n      return value');
  });

  test('normalizes Python completions with tab indentation', () => {
    const suggestion = sanitizeInlineSuggestion('return value', {
      prefix: 'def demo():\n\tif ready:',
      suffix: '',
      languageId: 'python'
    });

    assert.equal(suggestion, '\n\t\treturn value');
  });

  test('does not apply Python block-newline rules to other languages', () => {
    const suggestion = sanitizeInlineSuggestion(' value;', {
      prefix: 'case "ready":',
      suffix: '',
      languageId: 'typescript'
    });

    assert.equal(suggestion, ' value;');
  });
});
