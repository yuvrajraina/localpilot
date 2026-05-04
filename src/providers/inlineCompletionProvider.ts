import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import { buildContext } from '../context/contextBuilder';
import { getDocumentFilterDecision, isLargeDocument } from '../context/documentFilters';
import { generateCompletion } from '../ollama/ollamaClient';
import { checkOllamaHealth } from '../ollama/ollamaHealth';
import { buildCompletionCacheKey, CompletionCache } from '../performance/completionCache';
import { LocalPilotRequestLimiter } from '../performance/requestLimiter';
import { getInlineTokenBudget } from '../performance/tokenBudget';
import { buildAutocompletePrompt } from '../prompts/autocompletePrompt';
import type { InlineCompletionMode, LocalPilotConfig } from '../types';
import { LocalPilotError } from '../utils/errors';
import type { Logger } from '../utils/logger';

const MAX_INLINE_LINES = 8;
const HEALTH_TTL_MS = 10000;
const INLINE_STOP_MARKERS = [
  '```',
  '<LOCALPILOT_PREFIX>',
  '<LOCALPILOT_SUFFIX>',
  '<LOCALPILOT_CURSOR>',
  '<LOCALPILOT_COMPLETION>',
  '</LOCALPILOT_COMPLETION>'
];
const SUPPORTED_INLINE_LANGUAGES = [
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
export const INLINE_SELECTOR: vscode.DocumentSelector = SUPPORTED_INLINE_LANGUAGES.flatMap((language) => [
  { language, scheme: 'file' },
  { language, scheme: 'untitled' }
]);

type HealthCache = {
  host: string;
  reachable: boolean;
  checkedAt: number;
};

export class LocalPilotInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider, vscode.Disposable
{
  private readonly cache = new CompletionCache();
  private readonly requestLimiter = new LocalPilotRequestLimiter();
  private readonly warnedLargeFiles = new Set<string>();
  private healthCache: HealthCache | undefined;

  public constructor(private readonly logger: Logger) {}

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[]> {
    const config = getConfig();

    if (!this.canProvide(document, config) || token.isCancellationRequested) {
      return [];
    }

    const tokenBudget = getInlineTokenBudget(config);
    const context = buildContext({
      document,
      position,
      intent: 'inlineCompletion',
      maxContextLines: tokenBudget.maxContextLines
    });

    if (!context.allowed || context.prefix === undefined || context.suffix === undefined) {
      return [];
    }

    const cacheKey = buildCompletionCacheKey({
      fileUri: document.uri.toString(),
      line: position.line + 1,
      character: position.character,
      prefix: context.prefix,
      suffix: context.suffix,
      model: config.inlineModel
    });
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return [createInlineItem(cached, position)];
    }

    const shouldContinue = await waitForDebounce(config.inlineDebounceMs, token);

    if (!shouldContinue || token.isCancellationRequested) {
      return [];
    }

    const isReachable = await this.isOllamaReachable(config.ollamaHost);

    if (!isReachable || token.isCancellationRequested) {
      return [];
    }

    try {
      const controller = this.requestLimiter.startInlineRequest();
      const cancellation = token.onCancellationRequested(() => {
        controller.abort();
      });
      let suggestion = '';

      try {
        const completion = await generateCompletion({
          host: config.ollamaHost,
          model: config.inlineModel,
          prompt: buildAutocompletePrompt({
            context,
            completionMode: config.inlineCompletionMode
          }),
          suffix: context.suffix,
          signal: controller.signal,
          options: {
            num_predict: getInlineMaxOutputTokens(tokenBudget.maxOutputTokens, config.inlineCompletionMode),
            temperature: Math.min(config.temperature, 0.1),
            stop: INLINE_STOP_MARKERS
          }
        });

        suggestion = sanitizeInlineSuggestion(completion, {
          prefix: context.prefix,
          suffix: context.suffix,
          languageId: context.languageId,
          completionMode: config.inlineCompletionMode
        });
      } finally {
        cancellation.dispose();
        this.requestLimiter.finish('inline', controller);
      }

      if (suggestion) {
        this.cache.set(cacheKey, suggestion);
      }

      return suggestion ? [createInlineItem(suggestion, position)] : [];
    } catch (error) {
      this.logQuietFailure(error);

      return [];
    }
  }

  public dispose(): void {
    this.requestLimiter.dispose();
    this.cache.clear();
    this.healthCache = undefined;
    this.warnedLargeFiles.clear();
  }

  private canProvide(document: vscode.TextDocument, config: LocalPilotConfig): boolean {
    if (!config.enableInlineSuggestions) {
      return false;
    }

    const decision = getDocumentFilterDecision(document);

    if (!decision.allowed) {
      return false;
    }

    if (config.disableInlineForLargeFiles && isLargeDocument(document, config.maxFileSizeKb)) {
      this.warnLargeFileOnce(document, config);
      return false;
    }

    return true;
  }

  private async isOllamaReachable(host: string): Promise<boolean> {
    const now = Date.now();

    if (
      this.healthCache &&
      this.healthCache.host === host &&
      now - this.healthCache.checkedAt < HEALTH_TTL_MS
    ) {
      return this.healthCache.reachable;
    }

    const reachable = await checkOllamaHealth(host);
    this.healthCache = {
      host,
      reachable,
      checkedAt: now
    };

    return reachable;
  }

  private logQuietFailure(error: unknown): void {
    if (error instanceof LocalPilotError) {
      this.logger.warn(error.message);
      return;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }

    this.logger.warn('Inline completion request failed.');
  }

  private warnLargeFileOnce(document: vscode.TextDocument, config: LocalPilotConfig): void {
    if (!config.enableLowRamWarnings) {
      return;
    }

    const key = document.uri.toString();

    if (this.warnedLargeFiles.has(key)) {
      return;
    }

    this.warnedLargeFiles.add(key);
    this.logger.warn(
      `Inline suggestions skipped for a file over ${config.maxFileSizeKb}KB to keep LocalPilot responsive.`
    );
  }
}

type InlineSuggestionContext = {
  prefix: string;
  suffix: string;
  languageId?: string;
  completionMode?: InlineCompletionMode;
};

export function sanitizeInlineSuggestion(
  text: string,
  context: InlineSuggestionContext = { prefix: '', suffix: '' }
): string {
  let suggestion = normalizeNewlines(text);

  suggestion = stripCodeFences(suggestion);
  suggestion = stripPromptMarkers(suggestion);
  suggestion = stripProsePrefixes(suggestion);
  const shouldPreserveLeadingNewline =
    context.completionMode === 'line' && suggestion.startsWith('\n');
  suggestion = trimOuterBlankLines(suggestion);
  suggestion = removeEchoedPrefix(suggestion, context.prefix);
  suggestion = trimOuterBlankLines(suggestion);
  suggestion = removeEchoedSuffix(suggestion, context.suffix);
  suggestion = trimOuterBlankLines(suggestion);
  suggestion = shouldUsePythonRules(context)
    ? normalizeLanguageSpecificSuggestion(suggestion, context)
    : reindentLeftAlignedMultiline(suggestion, context.prefix);
  if (shouldPreserveLeadingNewline && !suggestion.startsWith('\n')) {
    suggestion = `\n${suggestion}`;
  }
  suggestion = limitInlineSuggestion(suggestion, context.completionMode ?? 'full');
  suggestion = removeEchoedSuffix(suggestion, context.suffix);
  suggestion = shouldUsePythonRules(context) || context.completionMode === 'line'
    ? trimTrailingBlankLines(suggestion)
    : trimOuterBlankLines(suggestion);

  return isInvalidInlineSuggestion(suggestion, context) ? '' : suggestion;
}

export function getMaxOutputTokens(config: Pick<LocalPilotConfig, 'mode' | 'maxOutputTokens'>): number {
  switch (config.mode) {
    case 'micro':
      return 32;
    case 'lite':
    case 'auto':
      return 64;
    case 'standard':
      return 96;
    case 'custom':
      return config.maxOutputTokens;
  }
}

function getInlineMaxOutputTokens(maxOutputTokens: number, completionMode: InlineCompletionMode): number {
  if (completionMode === 'line') {
    return Math.min(maxOutputTokens, 48);
  }

  return maxOutputTokens;
}

function createInlineItem(text: string, position: vscode.Position): vscode.InlineCompletionItem {
  const range = new vscode.Range(position, position);

  return new vscode.InlineCompletionItem(text, range);
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripCodeFences(text: string): string {
  const fencedMatch = text.match(/```[^\n]*\n([\s\S]*?)\n?```/);

  if (fencedMatch) {
    return normalizeNewlines(fencedMatch[1] ?? '');
  }

  return text
    .replace(/^\s*```[^\n]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .split('```')[0] ?? '';
}

function stripPromptMarkers(text: string): string {
  let result = text;

  for (const marker of INLINE_STOP_MARKERS) {
    result = result.split(marker).join('');
  }

  return result.replace(/^\s*(?:Prefix|Suffix|Completion|Response|Output):\s*$/gim, '');
}

function stripProsePrefixes(text: string): string {
  let result = text.replace(/^`+|`+$/g, '');
  const prosePrefix =
    /^\s*(?:(?:here(?:'s| is)(?: the)?(?: missing)? code)|sure|answer|completion|suggestion|output|insert(?: this)?|missing code|code)\s*(?:is)?\s*[:\-\n]*/i;

  for (let index = 0; index < 3; index += 1) {
    const next = result.replace(prosePrefix, '');

    if (next === result) {
      break;
    }

    result = next;
  }

  return result;
}

function trimOuterBlankLines(text: string): string {
  const lines = text.split('\n');

  while (lines.length > 0 && lines[0]?.trim().length === 0) {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1]?.trim().length === 0) {
    lines.pop();
  }

  return lines.join('\n').trimEnd();
}

function trimTrailingBlankLines(text: string): string {
  const lines = text.split('\n');

  while (lines.length > 0 && lines[lines.length - 1]?.trim().length === 0) {
    lines.pop();
  }

  return lines.join('\n').trimEnd();
}

function removeEchoedPrefix(suggestion: string, prefix: string): string {
  const normalizedPrefix = normalizeNewlines(prefix);

  if (!normalizedPrefix || !suggestion) {
    return suggestion;
  }

  if (suggestion.startsWith(normalizedPrefix)) {
    return suggestion.slice(normalizedPrefix.length);
  }

  const overlap = findLargestOverlap(normalizedPrefix, suggestion);

  return overlap > 0 ? suggestion.slice(overlap) : suggestion;
}

function removeEchoedSuffix(suggestion: string, suffix: string): string {
  let result = suggestion;
  const variants = getSuffixVariants(suffix);

  for (const variant of variants) {
    if (!variant || !result) {
      continue;
    }

    if (variant.startsWith(result) || result.startsWith(variant)) {
      return '';
    }

    if (result.endsWith(variant)) {
      result = result.slice(0, -variant.length);
      continue;
    }

    const overlap = findLargestOverlap(result, variant);

    if (overlap > 0) {
      result = result.slice(0, -overlap);
    }
  }

  return result;
}

function getSuffixVariants(suffix: string): string[] {
  const normalizedSuffix = normalizeNewlines(suffix);
  const trimmedStart = normalizedSuffix.trimStart();

  if (trimmedStart.length > 0 && trimmedStart !== normalizedSuffix) {
    return [normalizedSuffix, trimmedStart];
  }

  return [normalizedSuffix];
}

function findLargestOverlap(left: string, right: string): number {
  const maxOverlap = Math.min(left.length, right.length, 4000);

  for (let length = maxOverlap; length > 0; length -= 1) {
    if (left.slice(-length) === right.slice(0, length)) {
      return length;
    }
  }

  return 0;
}

function reindentLeftAlignedMultiline(suggestion: string, prefix: string): string {
  const lines = suggestion.split('\n');

  if (lines.length <= 1) {
    return suggestion;
  }

  const currentLinePrefix = getCurrentLinePrefix(normalizeNewlines(prefix));
  const baseIndent = currentLinePrefix.match(/^\s*/)?.[0] ?? '';
  const firstLineIndent = getLeadingWhitespace(lines.find((line) => line.trim().length > 0) ?? '');
  const continuationIndent = baseIndent || firstLineIndent;

  if (continuationIndent.length === 0) {
    return suggestion;
  }

  return lines
    .map((line, index) => {
      if (index === 0 || line.trim().length === 0 || /^\s/.test(line)) {
        return line;
      }

      if (/^[}\])]/.test(line.trim())) {
        return line;
      }

      return continuationIndent + line;
    })
    .join('\n');
}

function normalizeLanguageSpecificSuggestion(
  suggestion: string,
  context: InlineSuggestionContext
): string {
  if (!shouldUsePythonRules(context)) {
    return suggestion;
  }

  return normalizePythonSuggestion(suggestion, context.prefix);
}

function normalizePythonSuggestion(suggestion: string, prefix: string): string {
  if (!suggestion) {
    return suggestion;
  }

  const normalizedPrefix = normalizeNewlines(prefix);
  const currentLinePrefix = getCurrentLinePrefix(normalizedPrefix);

  if (!pythonLineOpensBlock(currentLinePrefix)) {
    return suggestion;
  }

  const parentIndent = getLeadingWhitespace(currentLinePrefix);
  const indentUnit = inferPythonIndentUnit(normalizedPrefix);
  const expectedIndent = parentIndent + indentUnit;
  const body = suggestion.replace(/^\n+/, '');

  if (body.trim().length === 0) {
    return '';
  }

  return '\n' + normalizePythonBlockBodyIndent(body, parentIndent, expectedIndent);
}

function normalizePythonBlockBodyIndent(
  suggestion: string,
  parentIndent: string,
  expectedIndent: string
): string {
  const lines = suggestion.split('\n');
  const nonBlankIndents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => getLeadingWhitespace(line));
  const minimumIndentColumns = Math.min(
    ...nonBlankIndents.map((indent) => getIndentColumns(indent))
  );
  const parentIndentColumns = getIndentColumns(parentIndent);
  const expectedIndentColumns = getIndentColumns(expectedIndent);

  if (minimumIndentColumns >= expectedIndentColumns) {
    return suggestion;
  }

  if (minimumIndentColumns === 0 || minimumIndentColumns === parentIndentColumns) {
    return indentShallowPythonLines(lines, expectedIndent, expectedIndentColumns);
  }

  return suggestion;
}

function indentShallowPythonLines(
  lines: string[],
  expectedIndent: string,
  expectedIndentColumns: number
): string {
  return lines
    .map((line) => {
      if (
        line.trim().length === 0 ||
        getIndentColumns(getLeadingWhitespace(line)) >= expectedIndentColumns
      ) {
        return line;
      }

      return expectedIndent + line;
    })
    .join('\n');
}

function getCurrentLinePrefix(prefix: string): string {
  const lastNewline = prefix.lastIndexOf('\n');

  return lastNewline === -1 ? prefix : prefix.slice(lastNewline + 1);
}

function inferPythonIndentUnit(prefix: string): string {
  const indents = normalizeNewlines(prefix)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => getLeadingWhitespace(line));

  if (indents.some((indent) => indent.includes('\t'))) {
    return '\t';
  }

  const positiveIndentWidths = Array.from(
    new Set(indents.map((indent) => indent.length).filter((width) => width > 0))
  ).sort((first, second) => first - second);

  if (positiveIndentWidths.length === 0) {
    return '    ';
  }

  const indentDifferences = positiveIndentWidths
    .map((width, index) => width - (positiveIndentWidths[index - 1] ?? 0))
    .filter((width) => width > 0);
  const unitWidth = Math.min(...indentDifferences);

  return ' '.repeat(unitWidth || 4);
}

function getLeadingWhitespace(line: string): string {
  return line.match(/^\s*/)?.[0] ?? '';
}

function getIndentColumns(indent: string): number {
  return Array.from(indent).reduce((columns, character) => {
    if (character === '\t') {
      return columns + 4;
    }

    return columns + 1;
  }, 0);
}

function pythonLineOpensBlock(line: string): boolean {
  return line.trimEnd().endsWith(':');
}

function limitInlineSuggestion(
  suggestion: string,
  completionMode: InlineCompletionMode
): string {
  if (completionMode === 'line') {
    return limitToSingleLogicalLine(suggestion);
  }

  return suggestion.split('\n').slice(0, MAX_INLINE_LINES).join('\n').trimEnd();
}

function limitToSingleLogicalLine(suggestion: string): string {
  if (suggestion.startsWith('\n')) {
    const bodyLines = suggestion.slice(1).split('\n');
    const firstCodeLine = bodyLines.find((line) => line.trim().length > 0);

    return firstCodeLine ? `\n${firstCodeLine.trimEnd()}` : '';
  }

  return suggestion.split('\n')[0]?.trimEnd() ?? '';
}

function isInvalidInlineSuggestion(
  suggestion: string,
  context: InlineSuggestionContext
): boolean {
  const trimmed = suggestion.trim();

  if (trimmed.length === 0) {
    return true;
  }

  if (/```|<\/?LOCALPILOT_[A-Z_]+>/i.test(trimmed)) {
    return true;
  }

  if (/^\s*(?:Prefix|Suffix|Completion|Response|Output):/im.test(trimmed)) {
    return true;
  }

  if (shouldUsePythonRules(context) && isInvalidPythonSuggestion(suggestion, context.prefix)) {
    return true;
  }

  if (isCommentOnlySuggestion(trimmed, context.languageId)) {
    return true;
  }

  return isLikelyProseOnly(trimmed);
}

function isCommentOnlySuggestion(text: string, languageId: string | undefined): boolean {
  const nonBlankLines = text.split('\n').filter((line) => line.trim().length > 0);

  if (nonBlankLines.length === 0) {
    return false;
  }

  return nonBlankLines.every((line) => isCommentLine(line, languageId));
}

function isCommentLine(line: string, languageId: string | undefined): boolean {
  const trimmed = line.trimStart();

  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return true;
  }

  if (trimmed.startsWith('#')) {
    return languageId === undefined || languageId === 'python' || languageId === 'ruby';
  }

  return false;
}

function isInvalidPythonSuggestion(suggestion: string, prefix: string): boolean {
  if (/\\\s*(?:\n|$)/.test(suggestion)) {
    return true;
  }

  const normalizedPrefix = normalizeNewlines(prefix);
  const currentLinePrefix = getCurrentLinePrefix(normalizedPrefix);
  const body = suggestion.replace(/^\n+/, '');
  const lines = body.split('\n');
  const firstNonBlankLine = lines.find((line) => line.trim().length > 0);

  if (!firstNonBlankLine) {
    return true;
  }

  if (pythonLineOpensBlock(currentLinePrefix)) {
    const expectedIndentColumns =
      getIndentColumns(getLeadingWhitespace(currentLinePrefix)) +
      getIndentColumns(inferPythonIndentUnit(normalizedPrefix));

    if (getIndentColumns(getLeadingWhitespace(firstNonBlankLine)) < expectedIndentColumns) {
      return true;
    }

    if (lines.some((line) => line.trim().length > 0 && getIndentColumns(getLeadingWhitespace(line)) < expectedIndentColumns)) {
      return true;
    }
  }

  return hasInvalidPythonBlockIndentation(lines);
}

function hasInvalidPythonBlockIndentation(lines: string[]): boolean {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (!pythonLineOpensBlock(line)) {
      continue;
    }

    const nextNonBlankLine = lines.slice(index + 1).find((candidate) => candidate.trim().length > 0);

    if (!nextNonBlankLine) {
      return true;
    }

    if (
      getIndentColumns(getLeadingWhitespace(nextNonBlankLine)) <=
      getIndentColumns(getLeadingWhitespace(line))
    ) {
      return true;
    }
  }

  return false;
}

function shouldUsePythonRules(context: InlineSuggestionContext): boolean {
  return context.languageId === 'python';
}

function isLikelyProseOnly(text: string): boolean {
  if (/^(?:here|sure|this|the following|you can|i would|to complete|looks like)\b/i.test(text)) {
    return true;
  }

  const codeSignals =
    /[{}()[\];=<>+\-*/%]|\b(?:const|let|var|return|if|else|for|while|switch|case|break|continue|class|function|def|import|from|public|private|protected|async|await|try|catch|throw|new|type|interface|enum|using|package|func|struct|impl|match)\b/m;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const plainSentence = /^[A-Za-z][A-Za-z\s'",.?!:-]*[.!?]?$/.test(text);

  return wordCount >= 4 && plainSentence && !codeSignals.test(text);
}


function waitForDebounce(delayMs: number, token: vscode.CancellationToken): Promise<boolean> {
  return new Promise((resolve) => {
    if (token.isCancellationRequested) {
      resolve(false);
      return;
    }

    const timeout = setTimeout(() => {
      cancellation.dispose();
      resolve(true);
    }, delayMs);

    const cancellation = token.onCancellationRequested(() => {
      clearTimeout(timeout);
      cancellation.dispose();
      resolve(false);
    });
  });
}
