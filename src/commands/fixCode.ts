import type * as vscode from 'vscode';

import { buildFixPrompt } from '../prompts/fixPrompt';
import type { Logger } from '../utils/logger';
import { registerLocalPilotCommand } from './commandUtils';

export function registerFixCodeCommand(logger: Logger): vscode.Disposable {
  return registerLocalPilotCommand(
    {
      commandId: 'localpilot.fixCode',
      title: 'LocalPilot: Fix Code',
      intent: 'fixCode',
      allowBlockFallback: true,
      applyToEditor: true,
      noSelectionMessage: 'Select code to fix, or place the cursor inside a function or block.',
      buildPrompt: (context) => buildFixPrompt(context)
    },
    logger
  );
}
