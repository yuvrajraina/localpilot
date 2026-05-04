import type * as vscode from 'vscode';

import { buildCommentPrompt } from '../prompts/commentPrompt';
import type { Logger } from '../utils/logger';
import { registerLocalPilotCommand } from './commandUtils';

export function registerAddCommentsCommand(logger: Logger): vscode.Disposable {
  return registerLocalPilotCommand(
    {
      commandId: 'localpilot.addComments',
      title: 'LocalPilot: Add Comments',
      intent: 'generateComments',
      allowBlockFallback: false,
      applyToEditor: true,
      noSelectionMessage: 'Select code before asking LocalPilot to add comments.',
      buildPrompt: (context) => buildCommentPrompt(context)
    },
    logger
  );
}
