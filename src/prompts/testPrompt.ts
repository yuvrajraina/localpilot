import type { BuiltContext } from '../context/fileContext';

type PromptContext = Extract<BuiltContext, { allowed: true }>;

export function buildTestPrompt(context: PromptContext, testFramework: string): string {
  return [
    `Generate focused tests for the selected code using ${testFramework}.`,
    'Return test code and a short note about any assumptions.',
    'Do not use cloud services, external network calls, or telemetry.',
    'Prefer small, deterministic tests that can run locally.',
    'Match the language and project style shown in the context.',
    context.promptContext
  ].join('\n');
}
