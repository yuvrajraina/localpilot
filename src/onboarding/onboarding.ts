import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import { listLocalModels } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import type { OllamaModel } from '../ollama/ollamaTypes';
import type { Logger } from '../utils/logger';
import { offerModelPull, selectInstalledModels } from './modelSetup';

const ONBOARDING_COMPLETED_KEY = 'localpilot.onboardingCompleted';
const SETUP_GUIDE_URL = 'https://ollama.com/download';

type OnboardingMode = 'firstRun' | 'manual';

export function registerRunSetupCommand(
  context: vscode.ExtensionContext,
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand('localpilot.runSetup', async () => {
    await runOnboarding(context, logger, 'manual');
  });
}

export async function maybeRunOnboarding(
  context: vscode.ExtensionContext,
  logger: Logger
): Promise<void> {
  if (context.globalState.get<boolean>(ONBOARDING_COMPLETED_KEY, false)) {
    return;
  }

  await runOnboarding(context, logger, 'firstRun');
}

export async function runOnboarding(
  context: vscode.ExtensionContext,
  logger: Logger,
  mode: OnboardingMode
): Promise<void> {
  const config = getConfig();
  const isHealthy = await checkOllamaHealth(config.ollamaHost);

  if (!isHealthy) {
    await handleMissingOllama(context, logger, mode);
    return;
  }

  let models: OllamaModel[] = [];

  try {
    models = await listLocalModels(config.ollamaHost);
  } catch (error) {
    logger.warn(error instanceof Error ? error.message : 'Could not list Ollama models.');
  }

  if (models.length === 0) {
    const pulled = await offerModelPull(config.ollamaHost, logger);

    if (pulled) {
      await context.globalState.update(ONBOARDING_COMPLETED_KEY, true);
    }

    return;
  }

  const selected = await selectInstalledModels(models);

  if (selected || mode === 'manual') {
    await context.globalState.update(ONBOARDING_COMPLETED_KEY, true);
  }
}

async function handleMissingOllama(
  context: vscode.ExtensionContext,
  logger: Logger,
  mode: OnboardingMode
): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    'LocalPilot needs Ollama running locally.',
    'Open setup guide',
    'Retry',
    'Dismiss'
  );

  if (choice === 'Open setup guide') {
    await vscode.env.openExternal(vscode.Uri.parse(SETUP_GUIDE_URL));
    return;
  }

  if (choice === 'Retry') {
    await runOnboarding(context, logger, mode);
    return;
  }

  if (mode === 'manual') {
    return;
  }

  if (choice === 'Dismiss') {
    await context.globalState.update(ONBOARDING_COMPLETED_KEY, true);
  }
}

export { ONBOARDING_COMPLETED_KEY };
