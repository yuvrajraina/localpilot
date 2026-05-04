import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import type { Logger } from '../utils/logger';
import { getChatHtml } from './chatHtml';
import { LocalPilotMessageRouter } from './messageRouter';

export class LocalPilotChatPanel implements vscode.Disposable {
  private static currentPanel: LocalPilotChatPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly router: LocalPilotMessageRouter;
  private isDisposed = false;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    logger: Logger
  ) {
    this.router = new LocalPilotMessageRouter(panel.webview, logger);

    this.disposables.push(
      this.panel.onDidDispose(() => {
        this.disposeInternal(false);
      }),
      this.panel.webview.onDidReceiveMessage((message) => {
        void this.router.handleMessage(message);
      })
    );
  }

  public static async show(logger: Logger): Promise<void> {
    if (LocalPilotChatPanel.currentPanel) {
      LocalPilotChatPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'localpilotChat',
      'LocalPilot Chat',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    const chatPanel = new LocalPilotChatPanel(panel, logger);
    LocalPilotChatPanel.currentPanel = chatPanel;
    panel.webview.html = await createInitialHtml();
  }

  public static disposeCurrent(): void {
    LocalPilotChatPanel.currentPanel?.dispose();
  }

  public dispose(): void {
    this.disposeInternal(true);
  }

  private disposeInternal(disposePanel: boolean): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    if (LocalPilotChatPanel.currentPanel === this) {
      LocalPilotChatPanel.currentPanel = undefined;
    }

    this.router.dispose();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.length = 0;

    if (disposePanel) {
      this.panel.dispose();
    }
  }
}

export function registerOpenChatCommand(logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand('localpilot.openChat', async () => {
    await LocalPilotChatPanel.show(logger);
  });
}

async function createInitialHtml(): Promise<string> {
  const config = getConfig();
  const connected = await checkOllamaHealth(config.ollamaHost);

  return getChatHtml({
    nonce: getNonce(),
    connected,
    model: config.chatModel
  });
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}
