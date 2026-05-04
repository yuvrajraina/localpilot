import * as vscode from 'vscode';

export type DiffPreviewParams = {
  title: string;
  originalText: string;
  proposedText: string;
  languageId: string;
};

export async function showDiffPreview(params: DiffPreviewParams): Promise<void> {
  const original = await vscode.workspace.openTextDocument({
    content: params.originalText,
    language: params.languageId
  });
  const proposed = await vscode.workspace.openTextDocument({
    content: params.proposedText,
    language: params.languageId
  });

  await vscode.commands.executeCommand(
    'vscode.diff',
    original.uri,
    proposed.uri,
    `${params.title}: Review Proposed Change`,
    {
      preview: true,
      viewColumn: vscode.ViewColumn.Beside
    }
  );
}
