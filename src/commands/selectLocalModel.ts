import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import { listLocalModels } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import type { OllamaModel } from '../ollama/ollamaTypes';
import type { Logger } from '../utils/logger';

export type ModelTarget = 'inlineModel' | 'chatModel' | 'both';

export function registerSelectLocalModelCommand(logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand('localpilot.selectLocalModel', async () => {
    const config = getConfig();

    if (!(await checkOllamaHealth(config.ollamaHost))) {
      await vscode.window.showInformationMessage(
        `LocalPilot could not reach Ollama at ${config.ollamaHost}. Start Ollama and try again.`
      );
      return;
    }

    let models: OllamaModel[];

    try {
      models = await listLocalModels(config.ollamaHost);
    } catch (error) {
      logger.warn(error instanceof Error ? error.message : 'Failed to list Ollama models.');
      await vscode.window.showInformationMessage('LocalPilot could not list local Ollama models.');
      return;
    }

    if (models.length === 0) {
      await vscode.window.showInformationMessage(
        'No local Ollama models found. Run LocalPilot: Run Setup or pull one with `ollama pull qwen2.5-coder:1.5b`.'
      );
      return;
    }

    const target = await pickModelTarget();

    if (!target) {
      return;
    }

    const selectedModel = await pickModel(models);

    if (!selectedModel) {
      return;
    }

    await updateModelSetting(target, selectedModel);
    await vscode.window.showInformationMessage(
      `LocalPilot model setting updated to ${selectedModel}.`
    );
  });
}

export async function pickModelTarget(): Promise<ModelTarget | undefined> {
  const items: Array<vscode.QuickPickItem & { target: ModelTarget }> = [
    {
      label: 'Inline suggestions model',
      description: 'Use this model for ghost-text completions.',
      target: 'inlineModel'
    },
    {
      label: 'Chat commands model',
      description: 'Use this model for explain, fix, comments, tests, and problem solving.',
      target: 'chatModel'
    },
    {
      label: 'Both inline and chat models',
      description: 'Use this model for all LocalPilot generation.',
      target: 'both'
    }
  ];
  const choice = await vscode.window.showQuickPick(
    items,
    {
      placeHolder: 'Choose which LocalPilot model setting to update'
    }
  );

  return choice?.target;
}

export async function pickModel(models: OllamaModel[]): Promise<string | undefined> {
  const selected = await vscode.window.showQuickPick(
    models.map((model) => ({
      label: model.name,
      description: typeof model.size === 'number' ? `${Math.round(model.size / 1024 / 1024)} MB` : undefined,
      detail: model.modifiedAt ? `Modified ${model.modifiedAt}` : undefined
    })),
    {
      placeHolder: 'Select an installed Ollama model'
    }
  );

  return selected?.label;
}

export async function updateModelSetting(target: ModelTarget, model: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('localpilot');

  if (target === 'inlineModel' || target === 'both') {
    await config.update('inlineModel', model, vscode.ConfigurationTarget.Global);
  }

  if (target === 'chatModel' || target === 'both') {
    await config.update('chatModel', model, vscode.ConfigurationTarget.Global);
  }
}
