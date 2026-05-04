import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import { listLocalModels } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import type { OllamaModel } from '../ollama/ollamaTypes';
import type { Logger } from '../utils/logger';

export function registerCheckOllamaStatusCommand(logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand('localpilot.checkOllamaStatus', async () => {
    const config = getConfig();
    const isReachable = await checkOllamaHealth(config.ollamaHost);
    let models: OllamaModel[] = [];

    if (isReachable) {
      try {
        models = await listLocalModels(config.ollamaHost);
      } catch (error) {
        logger.warn(error instanceof Error ? error.message : 'Failed to list Ollama models.');
      }
    }

    await showStatusDocument({
      host: config.ollamaHost,
      isReachable,
      models,
      inlineModel: config.inlineModel,
      chatModel: config.chatModel,
      inlineMode: config.inlineCompletionMode
    });

    if (!isReachable) {
      await vscode.window.showInformationMessage(
        `LocalPilot could not reach Ollama at ${config.ollamaHost}.`
      );
    }
  });
}

async function showStatusDocument(params: {
  host: string;
  isReachable: boolean;
  models: OllamaModel[];
  inlineModel: string;
  chatModel: string;
  inlineMode: string;
}): Promise<vscode.TextEditor> {
  const content = buildStatusMarkdown(params);

  const document = await vscode.workspace.openTextDocument({
    content,
    language: 'markdown'
  });

  return vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
}

export function buildStatusMarkdown(params: {
  host: string;
  isReachable: boolean;
  models: OllamaModel[];
  inlineModel: string;
  chatModel: string;
  inlineMode: string;
}): string {
  const modelLines =
    params.models.length > 0
      ? params.models.map(formatModelLine).join('\n')
      : '- No local models found.';
  const installedModelNames = new Set(params.models.map((model) => model.name));
  const inlineModelState = installedModelNames.has(params.inlineModel) ? 'installed' : 'missing';
  const chatModelState = installedModelNames.has(params.chatModel) ? 'installed' : 'missing';

  return [
    '# LocalPilot Ollama Status',
    '',
    `- Host: ${params.host}`,
    `- Status: ${params.isReachable ? 'Online' : 'Offline'}`,
    `- Inline model: ${params.inlineModel} (${inlineModelState})`,
    `- Chat model: ${params.chatModel} (${chatModelState})`,
    `- Inline autocomplete mode: ${params.inlineMode}`,
    `- Inline suggestions: managed by the LocalPilot status menu and VS Code inline suggestion settings`,
    '',
    '## Local Models',
    '',
    modelLines,
    '',
    '## Troubleshooting',
    '',
    params.isReachable
      ? '- Ollama is reachable. If suggestions fail, confirm the selected models are installed.'
      : '- Start Ollama locally, then run LocalPilot: Run Setup.',
    '- To install a model manually, run `ollama pull <model>` in a terminal.',
    '- Use LocalPilot: Select Local Model to choose installed local models.',
    '- Use LocalPilot: Switch Inline Completion Mode to choose full or line autocomplete.'
  ].join('\n');
}

function formatModelLine(model: OllamaModel): string {
  const size = typeof model.size === 'number' ? `, ${formatBytes(model.size)}` : '';
  const modifiedAt = model.modifiedAt ? `, modified ${model.modifiedAt}` : '';

  return `- ${model.name}${size}${modifiedAt}`;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
