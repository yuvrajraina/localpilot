import * as vscode from 'vscode';

import { reviewAndApplyToEditor } from '../apply/applyToEditor';
import { getConfig } from '../config/getConfig';
import { buildContext } from '../context/contextBuilder';
import { getDocumentFilterDecision } from '../context/documentFilters';
import type { BuiltContext, ContextIntent } from '../context/fileContext';
import { generateChat } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import { getTokenBudget } from '../performance/tokenBudget';
import type { LocalPilotConfig } from '../types';
import { RequestCancelledError } from '../utils/errors';
import type { Logger } from '../utils/logger';

const MAX_COMMAND_TOKENS = 700;
export const NO_ACTIVE_EDITOR_MESSAGE = 'Open a source file before running LocalPilot.';

type SelectedCodeRange = {
  range: vscode.Range;
  usedFallbackBlock: boolean;
};

export type TestFramework = 'Jest' | 'Vitest' | 'pytest' | 'Django TestCase or pytest-django';

export type LocalPilotCommandOptions = {
  commandId: string;
  title: string;
  intent: ContextIntent;
  allowBlockFallback: boolean;
  applyToEditor: boolean;
  noSelectionMessage: string;
  buildPrompt: (
    context: Extract<BuiltContext, { allowed: true }>,
    editor: vscode.TextEditor
  ) => string | Promise<string>;
};

export function registerLocalPilotCommand(
  options: LocalPilotCommandOptions,
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand(options.commandId, async () => {
    await runSelectedCodeCommand(options, logger);
  });
}

export async function runSelectedCodeCommand(
  options: LocalPilotCommandOptions,
  logger: Logger
): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    await vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_MESSAGE);
    return;
  }

  const decision = getDocumentFilterDecision(editor.document);

  if (!decision.allowed) {
    await vscode.window.showInformationMessage(
      `LocalPilot skipped this file. ${decision.reason ?? 'It is blocked by safety filters.'}`
    );
    return;
  }

  const selectedRange = getSelectedRange(editor, options.allowBlockFallback);

  if (!selectedRange) {
    await vscode.window.showInformationMessage(options.noSelectionMessage);
    return;
  }

  const config = getConfig();
  const tokenBudget = getTokenBudget(config);
  const reachable = await checkOllamaHealth(config.ollamaHost);

  if (!reachable) {
    await vscode.window.showInformationMessage(
      `LocalPilot could not reach Ollama at ${config.ollamaHost}. Start Ollama and try again.`
    );
    return;
  }

  const context = buildContext({
    document: editor.document,
    selection: new vscode.Selection(selectedRange.range.start, selectedRange.range.end),
    position: selectedRange.range.start,
    intent: options.intent,
    maxContextLines: tokenBudget.maxContextLines
  });

  if (!context.allowed) {
    await vscode.window.showInformationMessage(context.reason);
    return;
  }

  const prompt = await options.buildPrompt(context, editor);
  const response = await requestChatResponse(options.title, prompt, config, logger);

  if (!response) {
    return;
  }

  await showOutputPanel(options.title, response);

  if (options.applyToEditor) {
    await reviewAndApplyToEditor({
      title: options.title,
      editor,
      range: selectedRange.range,
      proposedCode: response
    });
  } else if (selectedRange.usedFallbackBlock) {
    await vscode.window.showInformationMessage(
      'LocalPilot used the current function or block because no code was selected.'
    );
  }
}

export function getSelectedRange(
  editor: vscode.TextEditor,
  allowBlockFallback: boolean
): SelectedCodeRange | undefined {
  if (!editor.selection.isEmpty) {
    return {
      range: normalizeRange(editor.selection),
      usedFallbackBlock: false
    };
  }

  if (!allowBlockFallback) {
    return undefined;
  }

  const fallbackRange = findCurrentBlockRange(editor.document, editor.selection.active);

  return fallbackRange
    ? {
        range: fallbackRange,
        usedFallbackBlock: true
      }
    : undefined;
}

export async function detectTestFramework(
  document: vscode.TextDocument
): Promise<TestFramework> {
  if (document.languageId === 'python') {
    return (await hasWorkspaceFile('**/{manage.py,settings.py,pytest.ini}'))
      ? 'Django TestCase or pytest-django'
      : 'pytest';
  }

  if (['javascript', 'javascriptreact', 'typescript', 'typescriptreact'].includes(document.languageId)) {
    return (await hasWorkspaceFile('**/{vitest.config.ts,vitest.config.js,vite.config.ts,vite.config.js}'))
      ? 'Vitest'
      : 'Jest';
  }

  return 'Jest';
}

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```[^\n]*\n([\s\S]*?)\n?```/);

  return fencedMatch ? fencedMatch[1]?.trimEnd() ?? '' : trimmed;
}

async function requestChatResponse(
  title: string,
  prompt: string,
  config: LocalPilotConfig,
  logger: Logger
): Promise<string | undefined> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
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
            num_predict: Math.min(getTokenBudget(config).maxOutputTokens, MAX_COMMAND_TOKENS)
          },
          messages: [
            {
              role: 'system',
              content:
                'You are LocalPilot, a private local coding assistant. Use only the provided code context.'
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

        logger.warn(error instanceof Error ? error.message : 'LocalPilot command failed.');
        await vscode.window.showInformationMessage(
          'LocalPilot could not complete the request. Check that Ollama and the configured model are available.'
        );

        return undefined;
      } finally {
        cancellation.dispose();
      }
    }
  );
}

async function showOutputPanel(title: string, content: string): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'localpilotOutput',
    title,
    vscode.ViewColumn.Beside,
    {
      enableScripts: false
    }
  );

  panel.webview.html = renderOutputHtml(title, content);
}

function findCurrentBlockRange(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Range | undefined {
  const blockRange = findBraceBlockRange(document, position) ?? findIndentedBlockRange(document, position);

  if (!blockRange || blockRange.isEmpty) {
    return undefined;
  }

  return blockRange;
}

function findBraceBlockRange(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Range | undefined {
  const cursorLine = position.line;
  let startLine: number | undefined;
  let reverseBalance = 0;

  for (let line = cursorLine; line >= 0; line -= 1) {
    const text = document.lineAt(line).text;
    reverseBalance += countChar(text, '}');
    reverseBalance -= countChar(text, '{');

    if (reverseBalance < 0 || (text.includes('{') && line === cursorLine)) {
      startLine = line;
      break;
    }
  }

  if (startLine === undefined) {
    return undefined;
  }

  let forwardBalance = 0;

  for (let line = startLine; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;
    forwardBalance += countChar(text, '{');
    forwardBalance -= countChar(text, '}');

    if (forwardBalance <= 0 && line > startLine) {
      return new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(line, document.lineAt(line).text.length)
      );
    }
  }

  return undefined;
}

function findIndentedBlockRange(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Range | undefined {
  const cursorLine = position.line;
  const currentIndent = getIndent(document.lineAt(cursorLine).text);
  let startLine = cursorLine;
  let endLine = cursorLine;

  for (let line = cursorLine; line >= 0; line -= 1) {
    const text = document.lineAt(line).text;

    if (text.trim().length === 0) {
      continue;
    }

    const indent = getIndent(text);

    if (indent < currentIndent || /:\s*$/.test(text.trim())) {
      startLine = line;
      break;
    }

    startLine = line;
  }

  for (let line = cursorLine + 1; line < document.lineCount; line += 1) {
    const text = document.lineAt(line).text;

    if (text.trim().length === 0) {
      endLine = line;
      continue;
    }

    if (getIndent(text) < currentIndent) {
      break;
    }

    endLine = line;
  }

  return new vscode.Range(
    new vscode.Position(startLine, 0),
    new vscode.Position(endLine, document.lineAt(endLine).text.length)
  );
}

function normalizeRange(range: vscode.Range): vscode.Range {
  return range.start.isBeforeOrEqual(range.end)
    ? range
    : new vscode.Range(range.end, range.start);
}

function countChar(text: string, char: string): number {
  return [...text].filter((value) => value === char).length;
}

function getIndent(text: string): number {
  return text.match(/^\s*/)?.[0].length ?? 0;
}

async function hasWorkspaceFile(globPattern: string): Promise<boolean> {
  const files = await vscode.workspace.findFiles(
    globPattern,
    '**/{node_modules,dist,build,coverage}/**',
    1
  );

  return files.length > 0;
}

function renderOutputHtml(title: string, content: string): string {
  const escapedTitle = escapeHtml(title);
  const escapedContent = escapeHtml(content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style>
    body {
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      line-height: 1.5;
      margin: 0;
      padding: 20px;
    }

    h1 {
      font-size: 18px;
      margin: 0 0 16px;
    }

    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
  </style>
</head>
<body>
  <h1>${escapedTitle}</h1>
  <pre>${escapedContent}</pre>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
