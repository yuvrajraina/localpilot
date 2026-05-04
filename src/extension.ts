import * as vscode from 'vscode';

import { registerAddCommentsCommand } from './commands/addComments';
import { registerCheckOllamaStatusCommand } from './commands/checkOllamaStatus';
import { registerExplainErrorCommand } from './commands/explainError';
import { registerExplainSelectionCommand } from './commands/explainSelection';
import { registerFixCodeCommand } from './commands/fixCode';
import { registerGenerateTestsCommand } from './commands/generateTests';
import { registerSelectLocalModelCommand } from './commands/selectLocalModel';
import { registerSwitchInlineCompletionModeCommand } from './commands/switchInlineCompletionMode';
import { registerSolveProblemCommand } from './commands/solveProblem';
import { getConfig } from './config/getConfig';
import { maybeRunOnboarding, registerRunSetupCommand } from './onboarding/onboarding';
import { registerCodeActionProvider } from './providers/codeActionProvider';
import { INLINE_SELECTOR, LocalPilotInlineCompletionProvider } from './providers/inlineCompletionProvider';
import { registerLocalPilotStatusBar } from './status/statusBar';
import { Logger } from './utils/logger';
import { LocalPilotChatPanel, registerOpenChatCommand } from './webview/chatPanel';

const HELLO_MESSAGE = 'LocalPilot is active. Ollama-powered local coding assistance is ready.';

let inlineProvider: LocalPilotInlineCompletionProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger();
  const config = getConfig();

  logger.info(`Activated with Ollama host ${config.ollamaHost}.`);

  const helloCommand = vscode.commands.registerCommand('localpilot.hello', async () => {
    await vscode.window.showInformationMessage(HELLO_MESSAGE);
  });

  inlineProvider = new LocalPilotInlineCompletionProvider(logger);
  const inlineProviderRegistration = vscode.languages.registerInlineCompletionItemProvider(
    INLINE_SELECTOR,
    inlineProvider
  );

  // All disposables are registered with VS Code so reloads and shutdowns clean up reliably.
  context.subscriptions.push(
    logger,
    helloCommand,
    inlineProvider,
    inlineProviderRegistration,
    registerCodeActionProvider()
  );
  context.subscriptions.push(
    registerExplainSelectionCommand(logger),
    registerExplainErrorCommand(logger),
    registerAddCommentsCommand(logger),
    registerFixCodeCommand(logger),
    registerGenerateTestsCommand(logger),
    registerSolveProblemCommand(logger),
    registerCheckOllamaStatusCommand(logger),
    registerSelectLocalModelCommand(logger),
    registerSwitchInlineCompletionModeCommand(),
    registerOpenChatCommand(logger),
    registerRunSetupCommand(context, logger),
    registerLocalPilotStatusBar(logger)
  );

  // Defer first-run checks so activation stays quick when VS Code opens a supported file.
  const onboardingTimer = setTimeout(() => {
    void maybeRunOnboarding(context, logger);
  }, 750);

  context.subscriptions.push({
    dispose: () => {
      clearTimeout(onboardingTimer);
    }
  });
}

export function deactivate(): void {
  inlineProvider?.dispose();
  inlineProvider = undefined;
  LocalPilotChatPanel.disposeCurrent();
}
