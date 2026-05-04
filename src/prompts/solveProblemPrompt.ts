import type { BuiltContext } from '../context/fileContext';

type PromptContext = Extract<BuiltContext, { allowed: true }>;

export function buildSolveProblemPrompt(context: PromptContext): string {
  return [
    'Solve the selected programming problem.',
    'Explain the approach, correctness intuition, time complexity, and space complexity.',
    'Then provide final code in the selected language if it is clear from the context.',
    'Keep the explanation practical for a LeetCode-style interview problem.',
    context.promptContext
  ].join('\n');
}
