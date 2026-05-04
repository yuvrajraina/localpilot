export type ExplainErrorPromptParams = {
  errorText: string;
  languageId: string;
  selectedCode?: string;
};

export function buildExplainErrorPrompt(params: ExplainErrorPromptParams): string {
  return [
    'Explain this programming or terminal error in a beginner-friendly way.',
    'Use these sections exactly:',
    '1. What the error means',
    '2. Most likely cause',
    '3. Step-by-step fix',
    '4. Corrected code snippet if possible',
    'Do not invent project details that are not present.',
    '',
    `Current file language: ${params.languageId}`,
    '',
    'Error text:',
    fenced('text', params.errorText),
    '',
    params.selectedCode ? 'Relevant selected code or active editor context:' : undefined,
    params.selectedCode ? fenced(params.languageId, params.selectedCode) : undefined
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function fenced(languageId: string, text: string): string {
  return ['```' + languageId, text, '```'].join('\n');
}
