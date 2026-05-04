import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import { getDocumentFilterDecision } from '../context/documentFilters';
import { redactSecrets } from '../context/secretFilter';
import { generateChat } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import { getTokenBudget } from '../performance/tokenBudget';
import { buildExplainErrorPrompt } from '../prompts/errorPrompt';
import { RequestCancelledError } from '../utils/errors';
import type { Logger } from '../utils/logger';

const MAX_ERROR_EXPLAIN_TOKENS = 900;

export function registerExplainErrorCommand(logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand('localpilot.explainError', async () => {
    await runExplainError(logger);
  });
}

export async function runExplainError(logger: Logger): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const selectedText = getSelectedErrorText(editor);
  const errorText = selectedText ?? (await askForErrorText());

  if (!errorText) {
    return;
  }

  const config = getConfig();

  if (!(await checkOllamaHealth(config.ollamaHost))) {
    await vscode.window.showInformationMessage(
      `LocalPilot could not reach Ollama at ${config.ollamaHost}. Start Ollama and try again.`
    );
    return;
  }

  const languageId = editor?.document.languageId ?? 'text';
  const selectedCode = getSafeSelectedCodeContext(editor, selectedText);
  const redactedError = redactSecrets(errorText).text;
  const redactedCode = selectedCode ? redactSecrets(selectedCode).text : undefined;
  const prompt = buildExplainErrorPrompt({
    errorText: redactedError,
    languageId,
    selectedCode: redactedCode
  });
  const response = await requestErrorExplanation(prompt, logger);

  if (!response) {
    return;
  }

  await showErrorExplanation(response);
}

export function getSelectedErrorText(editor: vscode.TextEditor | undefined): string | undefined {
  if (!editor || editor.selection.isEmpty) {
    return undefined;
  }

  const decision = getDocumentFilterDecision(editor.document);

  if (!decision.allowed) {
    return undefined;
  }

  const text = editor.document.getText(editor.selection).trim();

  return text.length > 0 ? text : undefined;
}

async function askForErrorText(): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    prompt: 'Paste the error message for LocalPilot to explain',
    placeHolder: 'Example: TypeError: Cannot read properties of undefined...',
    ignoreFocusOut: true
  });
  const trimmedValue = value?.trim();

  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}

function getSafeSelectedCodeContext(
  editor: vscode.TextEditor | undefined,
  selectedText: string | undefined
): string | undefined {
  if (!editor || !selectedText) {
    return undefined;
  }

  const decision = getDocumentFilterDecision(editor.document);

  if (!decision.allowed) {
    return undefined;
  }

  return selectedText;
}

async function requestErrorExplanation(
  prompt: string,
  logger: Logger
): Promise<string | undefined> {
  const config = getConfig();

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'LocalPilot: Explain Error',
      cancellable: true
    },
    async (_progress, token) => {
      const controller = new AbortController();
      const cancellation = token.onCancellationRequested(() => {
        controller.abort();
      });

      try {
        return await generateChat({
          host: config.ollamaHost,
          model: config.chatModel,
          signal: controller.signal,
          options: {
            temperature: config.temperature,
            num_predict: Math.min(getTokenBudget(config).maxOutputTokens, MAX_ERROR_EXPLAIN_TOKENS)
          },
          messages: [
            {
              role: 'system',
              content:
                'You are LocalPilot, a private local coding assistant. Explain errors clearly for beginners using only the provided context.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        });
      } catch (error) {
        if (error instanceof RequestCancelledError) {
          return undefined;
        }

        logger.warn(error instanceof Error ? error.message : 'LocalPilot error explanation failed.');
        await vscode.window.showInformationMessage(
          'LocalPilot could not explain the error. Check that Ollama and the configured model are available.'
        );

        return undefined;
      } finally {
        cancellation.dispose();
      }
    }
  );
}

async function showErrorExplanation(content: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language: 'markdown'
  });

  await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
}
