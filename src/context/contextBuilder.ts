import * as vscode from 'vscode';

import { getDocumentFilterDecision } from './documentFilters';
import type { BuildContextParams, BuiltContext, ContextIntent } from './fileContext';
import { extractPrefixSuffix } from './prefixSuffixExtractor';
import { redactSecrets } from './secretFilter';

const CURSOR_MARKER = '<LOCALPILOT_CURSOR>';

export function buildContext(params: BuildContextParams): BuiltContext {
  const decision = getDocumentFilterDecision(params.document);

  if (!decision.allowed) {
    return {
      allowed: false,
      reason: decision.reason ?? 'This document is blocked by LocalPilot safety filters.'
    };
  }

  switch (params.intent) {
    case 'inlineCompletion':
      return buildInlineCompletionContext(params);
    case 'explainSelection':
    case 'fixCode':
    case 'generateComments':
    case 'generateTests':
    case 'solveProblem':
      return buildSelectedCodeContext(params);
  }
}

export function buildInlineCompletionContext(params: BuildContextParams): BuiltContext {
  if (!params.position) {
    return { allowed: false, reason: 'Inline completion context requires a cursor position.' };
  }

  const extracted = extractPrefixSuffix(params.document, params.position, params.maxContextLines);
  const prefix = redactSecrets(extracted.prefix);
  const suffix = redactSecrets(extracted.suffix);
  const promptContext = compactLines([
    `Intent: inline completion`,
    `File: ${safeFileLabel(extracted.fileName)}`,
    `Language: ${extracted.languageId}`,
    `Line: ${extracted.lineNumber}`,
    `Prefix:`,
    fenced(extracted.languageId, prefix.text),
    `Suffix:`,
    fenced(extracted.languageId, suffix.text)
  ]);

  return {
    allowed: true,
    intent: 'inlineCompletion',
    promptContext,
    redacted: prefix.redacted || suffix.redacted,
    languageId: extracted.languageId,
    fileName: extracted.fileName,
    lineNumber: extracted.lineNumber,
    prefix: prefix.text,
    suffix: suffix.text
  };
}

function buildSelectedCodeContext(params: BuildContextParams): BuiltContext {
  const selectedText = getSelectedOrNearbyText(params);
  const redacted = redactSecrets(selectedText.text);
  const promptContext = compactLines([
    `Intent: ${describeIntent(params.intent)}`,
    `File: ${safeFileLabel(params.document.fileName)}`,
    `Language: ${params.document.languageId}`,
    selectedText.lineNumber ? `Line: ${selectedText.lineNumber}` : undefined,
    selectedText.source,
    fenced(params.document.languageId, redacted.text)
  ]);

  return {
    allowed: true,
    intent: params.intent,
    promptContext,
    redacted: redacted.redacted,
    languageId: params.document.languageId,
    fileName: params.document.fileName,
    lineNumber: selectedText.lineNumber
  };
}

function getSelectedOrNearbyText(params: BuildContextParams): {
  text: string;
  source: string;
  lineNumber?: number;
} {
  const selection = params.selection;

  if (selection && !selection.isEmpty) {
    const safeSelection = new vscode.Range(
      params.document.validatePosition(selection.start),
      params.document.validatePosition(selection.end)
    );

    return {
      text: limitTextByLines(params.document.getText(safeSelection), params.maxContextLines),
      source: 'Selected code:',
      lineNumber: safeSelection.start.line + 1
    };
  }

  if (params.position) {
    const extracted = extractPrefixSuffix(params.document, params.position, params.maxContextLines);

    return {
      text: `${extracted.prefix}\n${CURSOR_MARKER}\n${extracted.suffix}`,
      source: 'Nearby code:',
      lineNumber: extracted.lineNumber
    };
  }

  return {
    text: getDocumentStartExcerpt(params.document, params.maxContextLines),
    source: 'Document excerpt:'
  };
}

function describeIntent(intent: ContextIntent): string {
  switch (intent) {
    case 'explainSelection':
      return 'explain selected code';
    case 'fixCode':
      return 'fix code';
    case 'generateComments':
      return 'generate comments';
    case 'generateTests':
      return 'generate tests';
    case 'solveProblem':
      return 'solve coding problem';
    case 'inlineCompletion':
      return 'inline completion';
  }
}

function limitTextByLines(text: string, maxContextLines: number): string {
  const lineLimit = Math.max(1, Math.floor(maxContextLines));
  const lines = text.split(/\r?\n/);

  return lines.slice(0, lineLimit).join('\n');
}

function getDocumentStartExcerpt(document: vscode.TextDocument, maxContextLines: number): string {
  const lineLimit = Math.min(document.lineCount, Math.max(1, Math.floor(maxContextLines)));
  const endLine = lineLimit - 1;
  const end = new vscode.Position(endLine, document.lineAt(endLine).text.length);

  // Read only the bounded range needed for prompts instead of materializing the whole file.
  return document.getText(new vscode.Range(new vscode.Position(0, 0), end));
}

function fenced(languageId: string, text: string): string {
  return ['```' + languageId, text, '```'].join('\n');
}

function compactLines(lines: Array<string | undefined>): string {
  return lines.filter((line): line is string => Boolean(line)).join('\n');
}

function safeFileLabel(fileName: string): string {
  return fileName.replace(/\\/g, '/').split('/').pop() ?? fileName;
}
