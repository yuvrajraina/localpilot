import * as assert from 'node:assert/strict';

import * as vscode from 'vscode';

suite('LocalPilot extension', () => {
  test('registers the hello command', async () => {
    const extension = vscode.extensions.getExtension('localpilot.localpilot');

    await extension?.activate();

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('localpilot.hello'));
  });

  test('registers selected-code commands', async () => {
    const extension = vscode.extensions.getExtension('localpilot.localpilot');

    await extension?.activate();

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('localpilot.explainSelection'));
    assert.ok(commands.includes('localpilot.explainError'));
    assert.ok(commands.includes('localpilot.addComments'));
    assert.ok(commands.includes('localpilot.fixCode'));
    assert.ok(commands.includes('localpilot.generateTests'));
    assert.ok(commands.includes('localpilot.solveProblem'));
    assert.ok(commands.includes('localpilot.checkOllamaStatus'));
    assert.ok(commands.includes('localpilot.selectLocalModel'));
    assert.ok(commands.includes('localpilot.switchInlineCompletionMode'));
    assert.ok(commands.includes('localpilot.openStatusMenu'));
    assert.ok(commands.includes('localpilot.runSetup'));
  });

  test('contributes default configuration values', () => {
    const config = vscode.workspace.getConfiguration('localpilot');

    assert.equal(config.get('ollamaHost'), 'http://localhost:11434');
    assert.equal(config.get('mode'), 'auto');
    assert.equal(config.get('enableInlineSuggestions'), true);
    assert.equal(config.get('inlineCompletionMode'), 'full');
    assert.equal(config.get('inlineDebounceMs'), 250);
    assert.equal(config.get('disableInlineForLargeFiles'), true);
    assert.equal(config.get('maxFileSizeKb'), 500);
    assert.equal(config.get('enableLowRamWarnings'), true);
  });
});
