import type * as vscode from 'vscode';

export type PrefixSuffixContext = {
  prefix: string;
  suffix: string;
  languageId: string;
  fileName: string;
  lineNumber: number;
};

export type DocumentFilterDecision = {
  allowed: boolean;
  reason?: string;
};

export type ContextIntent =
  | 'inlineCompletion'
  | 'explainSelection'
  | 'fixCode'
  | 'generateComments'
  | 'generateTests'
  | 'solveProblem';

export type BuildContextParams = {
  document: vscode.TextDocument;
  maxContextLines: number;
  intent: ContextIntent;
  position?: vscode.Position;
  selection?: vscode.Selection;
};

export type BuiltContext =
  | {
      allowed: true;
      intent: ContextIntent;
      promptContext: string;
      redacted: boolean;
      languageId: string;
      fileName: string;
      lineNumber?: number;
      prefix?: string;
      suffix?: string;
    }
  | {
      allowed: false;
      reason: string;
    };
