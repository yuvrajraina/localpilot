import type { BuiltContext } from '../context/fileContext';

type PromptContext = Extract<BuiltContext, { allowed: true }>;

export function buildCommentPrompt(context: PromptContext): string {
  return [
    'Add useful comments to the selected code.',
    'Return the full selected code with comments added.',
    'Do not wrap the answer in markdown or code fences.',
    'Keep comments concise and explain intent, edge cases, or non-obvious logic.',
    'Do not change runtime behavior unless a comment requires no code change.',
    context.promptContext
  ].join('\n');
}
