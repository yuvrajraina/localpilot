import { basename } from 'node:path';

import * as vscode from 'vscode';

import { detectTestFramework } from '../commands/commandUtils';
import { getConfig } from '../config/getConfig';
import { buildContext } from '../context/contextBuilder';
import { getDocumentFilterDecision } from '../context/documentFilters';
import { redactSecrets } from '../context/secretFilter';
import { generateChat } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import type { OllamaChatMessage } from '../ollama/ollamaTypes';
import { getTokenBudget } from '../performance/tokenBudget';
import { buildCommentPrompt } from '../prompts/commentPrompt';
import { buildExplainPrompt } from '../prompts/explainPrompt';
import { buildFixPrompt } from '../prompts/fixPrompt';
import { buildTestPrompt } from '../prompts/testPrompt';
import type { LocalPilotConfig } from '../types';
import type { ContextIntent } from '../context/fileContext';
import { RequestCancelledError } from '../utils/errors';
import type { Logger } from '../utils/logger';
import { renderChatMarkdown } from './chatHtml';

const HISTORY_LIMIT = 8;
const MAX_CHAT_TOKENS = 900;

type WebviewRole = 'user' | 'assistant' | 'system';
export type QuickAction =
  | 'explainFile'
  | 'explainSelection'
  | 'findBugs'
  | 'fixSelection'
  | 'addComments'
  | 'generateTests';

export type IncomingMessage =
  | { type: 'ready' }
  | { type: 'clearChat' }
  | { type: 'cancelRequest' }
  | { type: 'sendMessage'; text: string }
  | { type: 'quickAction'; action: QuickAction };

export class LocalPilotMessageRouter implements vscode.Disposable {
  private readonly history: OllamaChatMessage[] = [];
  private readonly disposables: vscode.Disposable[] = [];
  private abortController: AbortController | undefined;
  private busy = false;

  public constructor(
    private readonly webview: vscode.Webview,
    private readonly logger: Logger
  ) {}

  public async handleMessage(message: unknown): Promise<void> {
    const incoming = parseIncomingMessage(message);

    if (!incoming) {
      return;
    }

    switch (incoming.type) {
      case 'ready':
        await this.syncStatus();
        this.postMessage('system', 'Ask LocalPilot about the active file or selected code.');
        break;
      case 'clearChat':
        this.history.length = 0;
        this.webview.postMessage({ type: 'clearChat' });
        this.postMessage('system', 'Chat cleared.');
        break;
      case 'cancelRequest':
        this.cancelRequest();
        break;
      case 'sendMessage':
        await this.sendUserMessage(incoming.text);
        break;
      case 'quickAction':
        await this.runQuickAction(incoming.action);
        break;
    }
  }

  public dispose(): void {
    this.abortController?.abort();
    this.abortController = undefined;

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async sendUserMessage(text: string): Promise<void> {
    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      return;
    }

    await this.requestAssistant(trimmedText, await this.buildFreeformPrompt(trimmedText));
  }

  private async runQuickAction(action: QuickAction): Promise<void> {
    const prompt = await this.buildQuickActionPrompt(action);

    if (!prompt) {
      return;
    }

    await this.requestAssistant(getQuickActionLabel(action), prompt);
  }

  private async requestAssistant(displayText: string, prompt: string): Promise<void> {
    if (this.busy) {
      this.postMessage('assistant', 'LocalPilot is still working on the previous message.');
      return;
    }

    const config = getConfig();
    const tokenBudget = getTokenBudget(config);
    const redactedPrompt = redactSecrets(prompt).text;

    this.postMessage('user', displayText);
    this.setBusy(true);

    if (!(await this.ensureOllamaReachable(config))) {
      this.postMessage(
        'assistant',
        `Ollama is disconnected at ${config.ollamaHost}. Start Ollama and try again.`
      );
      this.setBusy(false);
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;

    try {
      const response = await generateChat({
        host: config.ollamaHost,
        model: config.chatModel,
        signal: controller.signal,
        options: {
          temperature: config.temperature,
          num_predict: Math.min(tokenBudget.maxOutputTokens, MAX_CHAT_TOKENS)
        },
        messages: [
          {
            role: 'system',
            content:
              'You are LocalPilot, a private local coding assistant inside VS Code. Use only local context provided by the extension.'
          },
          ...this.history,
          {
            role: 'user',
            content: redactedPrompt
          }
        ]
      });

      this.remember({ role: 'user', content: displayText });
      this.remember({ role: 'assistant', content: response });
      this.postMessage('assistant', response);
    } catch (error) {
      if (!(error instanceof RequestCancelledError)) {
        this.logger.warn(error instanceof Error ? error.message : 'LocalPilot chat failed.');
        this.postMessage(
          'assistant',
          'LocalPilot could not complete the chat request. Check that Ollama and the configured model are available.'
        );
      }
    } finally {
      this.abortController = undefined;
      this.setBusy(false);
      await this.syncStatus();
    }
  }

  private async buildFreeformPrompt(text: string): Promise<string> {
    return [
      `User message: ${text}`,
      '',
      await this.getOptionalEditorContext('chat')
    ].join('\n');
  }

  private async buildQuickActionPrompt(action: QuickAction): Promise<string | undefined> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      this.postMessage('assistant', 'Open a source file before using this quick action.');
      return undefined;
    }

    if (action === 'explainFile') {
      return this.buildCurrentFilePrompt(editor, 'Explain the current file.');
    }

    if (action === 'findBugs') {
      return this.buildCurrentFilePrompt(
        editor,
        'Find likely bugs, edge cases, and risky assumptions in this code.'
      );
    }

    if (editor.selection.isEmpty) {
      this.postMessage('assistant', 'Select code before using this quick action.');
      return undefined;
    }

    const context = buildContext({
      document: editor.document,
      selection: editor.selection,
      position: editor.selection.start,
      intent: getIntentForQuickAction(action),
      maxContextLines: getTokenBudget(getConfig()).maxContextLines
    });

    if (!context.allowed) {
      this.postMessage('assistant', context.reason);
      return undefined;
    }

    switch (action) {
      case 'explainSelection':
        return buildExplainPrompt(context);
      case 'fixSelection':
        return buildFixPrompt(context);
      case 'addComments':
        return buildCommentPrompt(context);
      case 'generateTests':
        return buildTestPrompt(context, await detectTestFramework(editor.document));
    }
  }

  private buildCurrentFilePrompt(editor: vscode.TextEditor, instruction: string): string | undefined {
    const context = buildContext({
      document: editor.document,
      intent: 'explainSelection',
      maxContextLines: getTokenBudget(getConfig()).maxContextLines
    });

    if (!context.allowed) {
      this.postMessage('assistant', context.reason);
      return undefined;
    }

    return [instruction, '', buildExplainPrompt(context)].join('\n');
  }

  private async getOptionalEditorContext(reason: 'chat'): Promise<string> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return 'No active editor context.';
    }

    const decision = getDocumentFilterDecision(editor.document);
    const summary = [
      `Active language: ${editor.document.languageId}`,
      `Current file: ${basename(editor.document.fileName)}`,
      `Line count: ${editor.document.lineCount}`
    ];

    if (!decision.allowed) {
      return [
        ...summary,
        `Code context: omitted because ${decision.reason ?? 'the file is blocked by safety filters.'}`
      ].join('\n');
    }

    if (editor.selection.isEmpty) {
      return [...summary, 'Selected code: none'].join('\n');
    }

    const context = buildContext({
      document: editor.document,
      selection: editor.selection,
      position: editor.selection.start,
      intent: reason === 'chat' ? 'explainSelection' : 'explainSelection',
      maxContextLines: getTokenBudget(getConfig()).maxContextLines
    });

    if (!context.allowed) {
      return [...summary, `Code context: omitted because ${context.reason}`].join('\n');
    }

    return [...summary, context.promptContext].join('\n');
  }

  private async ensureOllamaReachable(config: LocalPilotConfig): Promise<boolean> {
    const connected = await checkOllamaHealth(config.ollamaHost);

    this.webview.postMessage({
      type: 'setStatus',
      connected,
      model: config.chatModel
    });

    return connected;
  }

  private async syncStatus(): Promise<void> {
    const config = getConfig();
    const connected = await checkOllamaHealth(config.ollamaHost);

    this.webview.postMessage({
      type: 'setStatus',
      connected,
      model: config.chatModel
    });
  }

  private remember(message: OllamaChatMessage): void {
    this.history.push(message);

    while (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }
  }

  private postMessage(role: WebviewRole, content: string): void {
    this.webview.postMessage({
      type: 'addMessage',
      message: {
        role,
        content,
        html: renderChatMarkdown(content)
      }
    });
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.webview.postMessage({
      type: 'setBusy',
      busy
    });
  }

  private cancelRequest(): void {
    if (!this.abortController) {
      return;
    }

    this.abortController.abort();
    this.abortController = undefined;
    this.setBusy(false);
    this.postMessage('system', 'Request stopped.');
  }
}

export function parseIncomingMessage(message: unknown): IncomingMessage | undefined {
  if (!isRecord(message) || typeof message.type !== 'string') {
    return undefined;
  }

  if (message.type === 'ready' || message.type === 'clearChat' || message.type === 'cancelRequest') {
    return { type: message.type };
  }

  if (message.type === 'sendMessage' && typeof message.text === 'string') {
    return { type: 'sendMessage', text: message.text };
  }

  if (message.type === 'quickAction' && isQuickAction(message.action)) {
    return { type: 'quickAction', action: message.action };
  }

  return undefined;
}

export function getIntentForQuickAction(action: QuickAction): ContextIntent {
  switch (action) {
    case 'addComments':
      return 'generateComments';
    case 'fixSelection':
      return 'fixCode';
    case 'generateTests':
      return 'generateTests';
    case 'explainSelection':
    case 'explainFile':
    case 'findBugs':
      return 'explainSelection';
  }
}

export function getQuickActionLabel(action: QuickAction): string {
  switch (action) {
    case 'explainFile':
      return 'Explain current file';
    case 'explainSelection':
      return 'Explain selection';
    case 'findBugs':
      return 'Find bugs';
    case 'fixSelection':
      return 'Fix selection';
    case 'addComments':
      return 'Add comments';
    case 'generateTests':
      return 'Generate tests';
  }
}

export function isQuickAction(action: unknown): action is QuickAction {
  return (
    action === 'explainFile' ||
    action === 'explainSelection' ||
    action === 'findBugs' ||
    action === 'fixSelection' ||
    action === 'addComments' ||
    action === 'generateTests'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
