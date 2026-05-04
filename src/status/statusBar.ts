import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import { listLocalModels } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import type { OllamaModel } from '../ollama/ollamaTypes';
import type { Logger } from '../utils/logger';

const STATUS_REFRESH_MS = 30000;

type StatusAction =
  | 'checkStatus'
  | 'switchInlineMode'
  | 'selectModel'
  | 'openChat'
  | 'runSetup'
  | 'toggleInline';

type StatusActionPick = vscode.QuickPickItem & {
  action: StatusAction;
};

export class LocalPilotStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  private readonly disposables: vscode.Disposable[] = [];
  private refreshTimer: NodeJS.Timeout | undefined;
  private isDisposed = false;

  public constructor(private readonly logger: Logger) {
    this.item.command = 'localpilot.openStatusMenu';
    this.item.name = 'LocalPilot';
    this.item.show();
    this.updateStatus(false);

    this.disposables.push(
      this.item,
      vscode.commands.registerCommand('localpilot.openStatusMenu', async () => {
        await this.showMenu();
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('localpilot')) {
          void this.refresh();
        }
      })
    );

    void this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, STATUS_REFRESH_MS);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.length = 0;
  }

  private async refresh(): Promise<void> {
    const config = getConfig();
    const connected = await checkOllamaHealth(config.ollamaHost);

    this.updateStatus(connected);
  }

  private updateStatus(connected: boolean): void {
    const config = getConfig();
    const state = connected ? 'Ready' : 'Offline';
    const icon = connected ? '$(check)' : '$(warning)';

    this.item.text = `${icon} LocalPilot ${state} · ${config.inlineCompletionMode}`;
    this.item.tooltip = [
      `LocalPilot ${state}`,
      `Host: ${config.ollamaHost}`,
      `Inline: ${config.inlineModel}`,
      `Chat: ${config.chatModel}`,
      `Autocomplete: ${config.inlineCompletionMode}`,
      `Inline suggestions: ${config.enableInlineSuggestions ? 'enabled' : 'disabled'}`
    ].join('\n');
  }

  private async showMenu(): Promise<void> {
    const config = getConfig();
    const connected = await checkOllamaHealth(config.ollamaHost);
    const models = connected ? await this.safeListModels(config.ollamaHost) : [];
    const selected = await vscode.window.showQuickPick(getStatusActionPicks({
      connected,
      inlineEnabled: config.enableInlineSuggestions,
      modelCount: models.length
    }), {
      placeHolder: 'LocalPilot local assistant'
    });

    if (!selected) {
      await this.refresh();
      return;
    }

    await this.runAction(selected.action, config.enableInlineSuggestions);
    await this.refresh();
  }

  private async runAction(action: StatusAction, inlineEnabled: boolean): Promise<void> {
    switch (action) {
      case 'checkStatus':
        await vscode.commands.executeCommand('localpilot.checkOllamaStatus');
        break;
      case 'switchInlineMode':
        await vscode.commands.executeCommand('localpilot.switchInlineCompletionMode');
        break;
      case 'selectModel':
        await vscode.commands.executeCommand('localpilot.selectLocalModel');
        break;
      case 'openChat':
        await vscode.commands.executeCommand('localpilot.openChat');
        break;
      case 'runSetup':
        await vscode.commands.executeCommand('localpilot.runSetup');
        break;
      case 'toggleInline':
        await vscode.workspace
          .getConfiguration('localpilot')
          .update('enableInlineSuggestions', !inlineEnabled, vscode.ConfigurationTarget.Global);
        await vscode.window.showInformationMessage(
          `LocalPilot inline suggestions ${inlineEnabled ? 'disabled' : 'enabled'}.`
        );
        break;
    }
  }

  private async safeListModels(host: string): Promise<OllamaModel[]> {
    try {
      return await listLocalModels(host);
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Failed to list Ollama models.');
      return [];
    }
  }
}

export function registerLocalPilotStatusBar(logger: Logger): vscode.Disposable {
  return new LocalPilotStatusBar(logger);
}

export function getStatusActionPicks(params: {
  connected: boolean;
  inlineEnabled: boolean;
  modelCount: number;
}): StatusActionPick[] {
  return [
    {
      label: params.connected ? 'Ollama connected' : 'Ollama offline',
      description: `${params.modelCount} local model${params.modelCount === 1 ? '' : 's'} found`,
      action: 'checkStatus'
    },
    {
      label: 'Switch inline completion mode',
      description: 'Choose full or line autocomplete.',
      action: 'switchInlineMode'
    },
    {
      label: 'Select local model',
      description: 'Pick installed Ollama models for inline and chat.',
      action: 'selectModel'
    },
    {
      label: 'Open chat',
      description: 'Ask LocalPilot about the active editor.',
      action: 'openChat'
    },
    {
      label: 'Run setup',
      description: 'Check Ollama and choose or pull a local model.',
      action: 'runSetup'
    },
    {
      label: params.inlineEnabled ? 'Disable inline suggestions' : 'Enable inline suggestions',
      description: 'Toggle LocalPilot ghost text.',
      action: 'toggleInline'
    }
  ];
}
