import * as assert from 'node:assert/strict';

import * as vscode from 'vscode';

import {
  getSelectedRange,
  NO_ACTIVE_EDITOR_MESSAGE,
  stripCodeFences,
  type LocalPilotCommandOptions
} from '../src/commands/commandUtils';
import { getSelectedErrorText } from '../src/commands/explainError';
import { getInlineModePicks } from '../src/commands/switchInlineCompletionMode';

const TEST_COMMAND_OPTIONS: LocalPilotCommandOptions = {
  commandId: 'localpilot.testCommand',
  title: 'LocalPilot: Test Command',
  intent: 'explainSelection',
  allowBlockFallback: false,
  applyToEditor: false,
  noSelectionMessage: 'Select code before running this test command.',
  buildPrompt: () => 'test prompt'
};

suite('LocalPilot command helpers', () => {
  test('has a clear no active editor message', () => {
    assert.equal(NO_ACTIVE_EDITOR_MESSAGE, 'Open a source file before running LocalPilot.');
  });

  test('returns no selected range for empty selection when fallback is disabled', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const value = 1;',
      language: 'typescript'
    });
    const editor = await vscode.window.showTextDocument(document);

    editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

    assert.equal(getSelectedRange(editor, TEST_COMMAND_OPTIONS.allowBlockFallback), undefined);
    assert.equal(
      TEST_COMMAND_OPTIONS.noSelectionMessage,
      'Select code before running this test command.'
    );
  });

  test('extracts the current brace block when no code is selected', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: ['function add(a: number, b: number) {', '  return a + b;', '}'].join('\n'),
      language: 'typescript'
    });
    const editor = await vscode.window.showTextDocument(document);

    editor.selection = new vscode.Selection(new vscode.Position(1, 4), new vscode.Position(1, 4));

    const selectedRange = getSelectedRange(editor, true);

    assert.ok(selectedRange);
    assert.equal(document.getText(selectedRange.range), document.getText());
    assert.equal(selectedRange.usedFallbackBlock, true);
  });

  test('keeps explicit selections instead of using fallback blocks', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: ['const value = 1;', 'const other = 2;'].join('\n'),
      language: 'typescript'
    });
    const editor = await vscode.window.showTextDocument(document);

    editor.selection = new vscode.Selection(new vscode.Position(0, 6), new vscode.Position(0, 11));

    const selectedRange = getSelectedRange(editor, true);

    assert.ok(selectedRange);
    assert.equal(document.getText(selectedRange.range), 'value');
    assert.equal(selectedRange.usedFallbackBlock, false);
  });

  test('extracts fenced code for apply-to-editor actions', () => {
    assert.equal(stripCodeFences('Here is the fix:\n```ts\nreturn value + 1;\n```'), 'return value + 1;');
  });

  test('offers full and line inline completion modes', () => {
    assert.deepEqual(
      getInlineModePicks().map((pick) => pick.mode),
      ['full', 'line']
    );
  });

  test('does not read selected error text from blocked documents', () => {
    const document = {
      fileName: 'C:/project/.env',
      uri: vscode.Uri.file('C:/project/.env'),
      getText: () => {
        throw new Error('blocked document text should not be read');
      }
    } as unknown as vscode.TextDocument;
    const editor = {
      document,
      selection: new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 10))
    } as vscode.TextEditor;

    assert.equal(getSelectedErrorText(editor), undefined);
  });
});
