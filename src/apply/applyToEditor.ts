import * as vscode from 'vscode';

import { stripCodeFences } from '../commands/commandUtils';
import { showDiffPreview } from './diffPreview';

const APPLY_ACTION = 'Apply';
const COPY_ACTION = 'Copy';
const CANCEL_ACTION = 'Cancel';

export type SafeApplyParams = {
  title: string;
  editor: vscode.TextEditor;
  range: vscode.Range;
  proposedCode: string;
};

export async function reviewAndApplyToEditor(params: SafeApplyParams): Promise<void> {
  const replacement = normalizeReplacement(params.proposedCode);

  if (!replacement) {
    await vscode.window.showInformationMessage('LocalPilot returned an empty result, so nothing was applied.');
    return;
  }

  const originalText = params.editor.document.getText(params.range);

  if (originalText.length === 0) {
    await vscode.window.showInformationMessage('LocalPilot will only apply changes to a selected range.');
    return;
  }

  await showDiffPreview({
    title: params.title,
    originalText,
    proposedText: replacement,
    languageId: params.editor.document.languageId
  });

  const choice = await vscode.window.showInformationMessage(
    'Review the LocalPilot diff before applying changes.',
    APPLY_ACTION,
    COPY_ACTION,
    CANCEL_ACTION
  );

  if (choice === COPY_ACTION) {
    await vscode.env.clipboard.writeText(replacement);
    await vscode.window.showInformationMessage('LocalPilot result copied to clipboard.');
    return;
  }

  if (choice !== APPLY_ACTION) {
    return;
  }

  const edit = new vscode.WorkspaceEdit();

  edit.replace(params.editor.document.uri, params.range, replacement);
  await vscode.workspace.applyEdit(edit);
}

export function normalizeReplacement(proposedCode: string): string {
  const replacement = trimOuterBlankLines(stripCodeFences(proposedCode));

  return replacement.trim().length > 0 ? replacement : '';
}

function trimOuterBlankLines(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  while (lines.length > 0 && lines[0]?.trim().length === 0) {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1]?.trim().length === 0) {
    lines.pop();
  }

  return lines.join('\n');
}
