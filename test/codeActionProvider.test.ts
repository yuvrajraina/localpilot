import * as assert from 'node:assert/strict';

import * as vscode from 'vscode';

import {
  LocalPilotCodeActionProvider,
  shouldShowCodeActions
} from '../src/providers/codeActionProvider';

suite('LocalPilot code action provider', () => {
  test('shows actions for selected code', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const value = 1;',
      language: 'typescript'
    });
    const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 5));

    assert.equal(shouldShowCodeActions(document, range), true);
  });

  test('shows actions for a non-empty current line', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const value = 1;',
      language: 'typescript'
    });
    const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

    assert.equal(shouldShowCodeActions(document, range), true);
  });

  test('hides actions for an empty current line', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: '',
      language: 'typescript'
    });
    const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0));

    assert.equal(shouldShowCodeActions(document, range), false);
  });

  test('routes actions to existing LocalPilot commands', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'const value = 1;',
      language: 'typescript'
    });
    const provider = new LocalPilotCodeActionProvider();
    const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 5));
    const actions = provider.provideCodeActions(document, range);

    assert.deepEqual(
      actions.map((action) => action.command?.command),
      [
        'localpilot.explainSelection',
        'localpilot.addComments',
        'localpilot.fixCode',
        'localpilot.generateTests'
      ]
    );
  });
});
