import type { BuiltContext } from '../context/fileContext';
import type { InlineCompletionMode } from '../types';

type AutocompletePromptParams = {
  context: Extract<BuiltContext, { allowed: true }>;
  completionMode?: InlineCompletionMode;
};

export function buildAutocompletePrompt(params: AutocompletePromptParams): string {
  const prefix = params.context.prefix ?? '';
  const completionMode = params.completionMode ?? 'full';
  const metadata = [
    `File: ${safeFileLabel(params.context.fileName)}`,
    `Language: ${params.context.languageId}`,
    params.context.lineNumber ? `Line: ${params.context.lineNumber}` : undefined
  ].filter((line): line is string => Boolean(line));

  return [
    'You are LocalPilot, a fill-in-the-middle code autocomplete engine.',
    'Return only the exact code to insert at <LOCALPILOT_CURSOR>.',
    'Do not return markdown, explanations, labels, code fences, or repeated existing code.',
    'Use the suffix provided separately by the API as the code after the cursor; do not repeat it.',
    'Match the current file indentation, language, naming, and style.',
    'Do not return comments or comment-only suggestions.',
    'For Python, every block opener ending in ":" must include a correctly indented body.',
    'Return nothing if the only possible completion would be malformed or incomplete code.',
    completionMode === 'line'
      ? 'Return at most one logical code line: finish the current line or provide only the next line.'
      : 'Keep the completion short and no longer than 8 lines.',
    ...metadata,
    '<LOCALPILOT_PREFIX>',
    prefix,
    '<LOCALPILOT_CURSOR>',
    '<LOCALPILOT_COMPLETION>'
  ].join('\n');
}

function safeFileLabel(fileName: string): string {
  return fileName.replace(/\\/g, '/').split('/').pop() ?? fileName;
}
