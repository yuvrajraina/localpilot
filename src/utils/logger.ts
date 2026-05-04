import * as vscode from 'vscode';

const CHANNEL_NAME = 'LocalPilot';

export class Logger {
  private readonly channel: vscode.OutputChannel;

  public constructor(channel = vscode.window.createOutputChannel(CHANNEL_NAME)) {
    this.channel = channel;
  }

  public info(message: string): void {
    this.write('info', message);
  }

  public warn(message: string): void {
    this.write('warn', message);
  }

  public error(message: string, error?: unknown): void {
    const details = error instanceof Error ? ` ${error.message}` : '';
    this.write('error', `${message}${details}`);
  }

  public dispose(): void {
    this.channel.dispose();
  }

  private write(level: 'info' | 'warn' | 'error', message: string): void {
    this.channel.appendLine(`[${new Date().toISOString()}] [${level}] ${message}`);
  }
}
