import type { BuiltContext } from '../context/fileContext';

type PromptContext = Extract<BuiltContext, { allowed: true }>;

export function buildFixPrompt(context: PromptContext, errorText?: string): string {
  return [
    'Fix bugs or obvious issues in the selected code.',
    'Return the full corrected code only.',
    'Do not wrap the answer in markdown or code fences.',
    'Do not explain the fix in the returned text.',
    'Preserve style, indentation, names, and public behavior unless a change is needed.',
    errorText ? 'Known error or symptom:' : undefined,
    errorText,
    context.promptContext
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}
