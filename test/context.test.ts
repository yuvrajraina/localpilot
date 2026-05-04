import * as assert from 'node:assert/strict';

import * as vscode from 'vscode';

import { buildContext } from '../src/context/contextBuilder';
import { getPathFilterDecision } from '../src/context/documentFilters';
import { extractPrefixSuffix } from '../src/context/prefixSuffixExtractor';
import { redactSecrets } from '../src/context/secretFilter';

suite('Document filters', () => {
  test('blocks sensitive and generated file paths', () => {
    const blockedPaths = [
      'C:/project/.env',
      'C:/project/.env.local',
      'C:/project/server.pem',
      'C:/project/deploy.key',
      'C:/Users/test/.ssh/id_rsa',
      'C:/project/node_modules/pkg/index.ts',
      'C:/project/dist/index.js',
      'C:/project/build/index.js',
      'C:/project/coverage/lcov.info',
      'C:/project/package-lock.json',
      'C:/project/yarn.lock',
      'C:/project/pnpm-lock.yaml',
      'C:/project/app.min.js'
    ];

    for (const fileName of blockedPaths) {
      assert.equal(getPathFilterDecision(fileName).allowed, false, fileName);
    }
  });

  test('allows normal source files', () => {
    assert.equal(getPathFilterDecision('C:/project/src/extension.ts').allowed, true);
    assert.equal(getPathFilterDecision('C:/project/test/context.test.ts').allowed, true);
  });

  test('does not read blocked documents while building context', () => {
    const document = {
      fileName: 'C:/project/.env',
      uri: vscode.Uri.file('C:/project/.env'),
      getText: () => {
        throw new Error('blocked document text should not be read');
      }
    } as unknown as vscode.TextDocument;

    const result = buildContext({
      document,
      intent: 'generateTests',
      maxContextLines: 20
    });

    assert.equal(result.allowed, false);
  });
});

suite('Prefix and suffix extraction', () => {
  test('limits context by line count while preserving formatting', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: [
        'const one = 1;',
        'function demo() {',
        '  return one + 1;',
        '}',
        'console.log(demo());'
      ].join('\n'),
      language: 'typescript'
    });

    const context = extractPrefixSuffix(document, new vscode.Position(2, 9), 2);

    assert.equal(context.prefix, 'function demo() {\n  return ');
    assert.equal(context.suffix, 'one + 1;\n}');
    assert.equal(context.languageId, 'typescript');
    assert.equal(context.lineNumber, 3);
  });

  test('respects max context lines on both sides of the cursor', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: ['line 1', 'line 2', 'line 3', 'line 4', 'line 5'].join('\n'),
      language: 'plaintext'
    });

    const context = extractPrefixSuffix(document, new vscode.Position(2, 4), 1);

    assert.equal(context.prefix, 'line');
    assert.equal(context.suffix, ' 3');
  });
});

suite('Secret filter', () => {
  test('redacts obvious secret-like strings', () => {
    const result = redactSecrets(
      [
        'const apiKey = "1234567890abcdef1234567890abcdef";',
        'const aws = "AKIA1234567890ABCDEF";',
        'const normal = "visible";'
      ].join('\n')
    );

    assert.equal(result.redacted, true);
    assert.match(result.text, /\[REDACTED_SECRET\]/);
    assert.equal(result.text.includes('AKIA1234567890ABCDEF'), false);
    assert.equal(result.text.includes('visible'), true);
  });

  test('redacts secrets inside built context before prompt use', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const apiKey = "1234567890abcdef1234567890abcdef";',
      language: 'typescript'
    });
    const context = buildContext({
      document,
      selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 53)),
      intent: 'explainSelection',
      maxContextLines: 10
    });

    assert.equal(context.allowed, true);

    if (!context.allowed) {
      return;
    }

    assert.equal(context.redacted, true);
    assert.match(context.promptContext, /\[REDACTED_SECRET\]/);
    assert.equal(context.promptContext.includes('1234567890abcdef1234567890abcdef'), false);
  });
});
