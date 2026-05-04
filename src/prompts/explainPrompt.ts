import type { BuiltContext } from '../context/fileContext';

type PromptContext = Extract<BuiltContext, { allowed: true }>;

export function buildExplainPrompt(context: PromptContext): string {
  return [
    'Explain the selected code clearly and accurately.',
    'Focus on what it does, important control flow, inputs, outputs, and edge cases.',
    'Keep the answer readable for a developer working in VS Code.',
    'Do not invent project details that are not present in the context.',
    context.promptContext
  ].join('\n');
}
