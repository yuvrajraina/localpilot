import * as vscode from 'vscode';

import { pickModel, updateModelSetting } from '../commands/selectLocalModel';
import { pullModel } from '../ollama/ollamaClient';
import type { OllamaModel } from '../ollama/ollamaTypes';
import type { Logger } from '../utils/logger';

const PULL_ACTION = 'Pull model';

type RecommendedModelPick = vscode.QuickPickItem & {
  model?: string;
  custom?: boolean;
};

export async function offerModelPull(host: string, logger: Logger): Promise<boolean> {
  const selected = await vscode.window.showQuickPick<RecommendedModelPick>(
    getRecommendedModelPicks(),
    {
      placeHolder: 'Choose a local model to pull with Ollama'
    }
  );

  if (!selected) {
    return false;
  }

  const modelName = selected.custom
    ? await vscode.window.showInputBox({
        prompt: 'Enter the Ollama model name to pull',
        placeHolder: 'example: qwen2.5-coder:1.5b',
        ignoreFocusOut: true
      })
    : selected.model;

  if (!modelName) {
    return false;
  }

  const confirmation = await vscode.window.showWarningMessage(
    `Pulling "${modelName}" may download a large model. LocalPilot will never start downloads without your approval.`,
    PULL_ACTION,
    'Cancel'
  );

  if (confirmation !== PULL_ACTION) {
    return false;
  }

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Pulling ${modelName}`,
      cancellable: true
    },
    async (progress, token) => {
      const controller = new AbortController();
      const cancellation = token.onCancellationRequested(() => {
        controller.abort();
      });

      try {
        await pullModel({
          host,
          model: modelName,
          stream: true,
          signal: controller.signal,
          onProgress: (event) => {
            progress.report({
              message: event.status
            });
          }
        });
        await updateModelSetting('both', modelName);
        await vscode.window.showInformationMessage(`LocalPilot pulled and selected ${modelName}.`);

        return true;
      } catch (error) {
        logger.warn(error instanceof Error ? error.message : 'Model pull failed.');
        await vscode.window.showInformationMessage(
          `LocalPilot could not pull ${modelName}. Check Ollama and try again.`
        );

        return false;
      } finally {
        cancellation.dispose();
      }
    }
  );
}

export function getRecommendedModelPicks(): RecommendedModelPick[] {
  return [
    {
      label: 'Balanced: qwen2.5-coder:1.5b',
      description: 'Recommended local coder model for responsive Copilot-like autocomplete.',
      model: 'qwen2.5-coder:1.5b'
    },
    {
      label: 'Quality: qwen2.5-coder:7b',
      description: 'Stronger local coding help when your machine has enough memory.',
      model: 'qwen2.5-coder:7b'
    },
    {
      label: 'Micro: smollm2:360m',
      description: 'Smallest download and most conservative local model.',
      model: 'smollm2:360m'
    },
    {
      label: 'Lite: deepseek-coder:1.3b',
      description: 'Balanced starter model for low-end machines.',
      model: 'deepseek-coder:1.3b'
    },
    {
      label: 'Standard: codegemma:2b',
      description: 'Solid compact local coding model.',
      model: 'codegemma:2b'
    },
    {
      label: 'Custom model name',
      description: 'Enter any Ollama model name to pull.',
      custom: true
    }
  ];
}

export async function selectInstalledModels(models: OllamaModel[]): Promise<boolean> {
  const inlineModel = await pickModel(models);

  if (!inlineModel) {
    return false;
  }

  await updateModelSetting('inlineModel', inlineModel);

  const chatModel = await pickModel(models);

  if (!chatModel) {
    return false;
  }

  await updateModelSetting('chatModel', chatModel);
  await vscode.window.showInformationMessage(
    `LocalPilot selected ${inlineModel} for inline suggestions and ${chatModel} for chat.`
  );

  return true;
}
