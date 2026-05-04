import type * as vscode from 'vscode';

import { buildExplainPrompt } from '../prompts/explainPrompt';
import type { Logger } from '../utils/logger';
import { registerLocalPilotCommand } from './commandUtils';

export function registerExplainSelectionCommand(logger: Logger): vscode.Disposable {
  return registerLocalPilotCommand(
    {
      commandId: 'localpilot.explainSelection',
      title: 'LocalPilot: Explain Selection',
      intent: 'explainSelection',
      allowBlockFallback: true,
      applyToEditor: false,
      noSelectionMessage: 'Select code to explain, or place the cursor inside a function or block.',
      buildPrompt: (context) => buildExplainPrompt(context)
    },
    logger
  );
}
