import type * as vscode from 'vscode';

import { buildSolveProblemPrompt } from '../prompts/solveProblemPrompt';
import type { Logger } from '../utils/logger';
import { registerLocalPilotCommand } from './commandUtils';

export function registerSolveProblemCommand(logger: Logger): vscode.Disposable {
  return registerLocalPilotCommand(
    {
      commandId: 'localpilot.solveProblem',
      title: 'LocalPilot: Solve Problem',
      intent: 'solveProblem',
      allowBlockFallback: false,
      applyToEditor: false,
      noSelectionMessage: 'Select the coding problem or starter code for LocalPilot to solve.',
      buildPrompt: (context) => buildSolveProblemPrompt(context)
    },
    logger
  );
}
