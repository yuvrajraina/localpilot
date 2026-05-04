import type * as vscode from 'vscode';

import { buildTestPrompt } from '../prompts/testPrompt';
import type { Logger } from '../utils/logger';
import { detectTestFramework, registerLocalPilotCommand } from './commandUtils';

export function registerGenerateTestsCommand(logger: Logger): vscode.Disposable {
  return registerLocalPilotCommand(
    {
      commandId: 'localpilot.generateTests',
      title: 'LocalPilot: Generate Tests',
      intent: 'generateTests',
      allowBlockFallback: false,
      applyToEditor: false,
      noSelectionMessage: 'Select code before asking LocalPilot to generate tests.',
      buildPrompt: async (context, editor) =>
        buildTestPrompt(context, await detectTestFramework(editor.document))
    },
    logger
  );
}
