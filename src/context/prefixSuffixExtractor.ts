import * as vscode from 'vscode';

import type { PrefixSuffixContext } from './fileContext';

export function extractPrefixSuffix(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxContextLines: number
): PrefixSuffixContext {
  const validPosition = document.validatePosition(position);
  const lineLimit = Math.max(1, Math.floor(maxContextLines));
  const prefixStartLine = Math.max(0, validPosition.line - lineLimit + 1);
  const suffixEndLine = Math.min(document.lineCount - 1, validPosition.line + lineLimit - 1);

  const prefixRange = new vscode.Range(
    new vscode.Position(prefixStartLine, 0),
    validPosition
  );
  const suffixRange = new vscode.Range(
    validPosition,
    new vscode.Position(suffixEndLine, document.lineAt(suffixEndLine).text.length)
  );

  return {
    prefix: document.getText(prefixRange),
    suffix: document.getText(suffixRange),
    languageId: document.languageId,
    fileName: document.fileName,
    lineNumber: validPosition.line + 1
  };
}
