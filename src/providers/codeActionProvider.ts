import * as vscode from 'vscode';

import { getDocumentFilterDecision } from '../context/documentFilters';

const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php'
];

const ACTIONS: Array<{
  title: string;
  command: string;
}> = [
  {
    title: 'LocalPilot: Explain this code',
    command: 'localpilot.explainSelection'
  },
  {
    title: 'LocalPilot: Add comments',
    command: 'localpilot.addComments'
  },
  {
    title: 'LocalPilot: Fix possible issue',
    command: 'localpilot.fixCode'
  },
  {
    title: 'LocalPilot: Generate test',
    command: 'localpilot.generateTests'
  }
];

export class LocalPilotCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): vscode.CodeAction[] {
    if (!shouldShowCodeActions(document, range)) {
      return [];
    }

    return ACTIONS.map((action) => createCodeAction(action.title, action.command));
  }
}

export function registerCodeActionProvider(): vscode.Disposable {
  return vscode.languages.registerCodeActionsProvider(
    SUPPORTED_LANGUAGES.map((language) => ({ language, scheme: 'file' })),
    new LocalPilotCodeActionProvider(),
    {
      providedCodeActionKinds: LocalPilotCodeActionProvider.providedCodeActionKinds
    }
  );
}

export function shouldShowCodeActions(
  document: vscode.TextDocument,
  range: vscode.Range | vscode.Selection
): boolean {
  if (!getDocumentFilterDecision(document).allowed) {
    return false;
  }

  if (!range.isEmpty) {
    return true;
  }

  const line = document.lineAt(range.start.line);

  return line.text.trim().length > 0;
}

function createCodeAction(title: string, command: string): vscode.CodeAction {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);

  action.command = {
    title,
    command
  };

  return action;
}
