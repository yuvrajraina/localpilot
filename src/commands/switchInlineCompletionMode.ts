import * as vscode from 'vscode';

import { getConfig } from '../config/getConfig';
import type { InlineCompletionMode } from '../types';

type InlineModePick = vscode.QuickPickItem & {
  mode: InlineCompletionMode;
};

const INLINE_MODE_PICKS: InlineModePick[] = [
  {
    label: 'Full autocomplete',
    description: 'Copilot-like multiline ghost text.',
    mode: 'full'
  },
  {
    label: 'Line autocomplete',
    description: 'Only finish the current line or suggest one next line.',
    mode: 'line'
  }
];

export function registerSwitchInlineCompletionModeCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('localpilot.switchInlineCompletionMode', async () => {
    await switchInlineCompletionMode();
  });
}

export async function switchInlineCompletionMode(): Promise<InlineCompletionMode | undefined> {
  const currentMode = getConfig().inlineCompletionMode;
  const selected = await vscode.window.showQuickPick(
    INLINE_MODE_PICKS.map((pick) => ({
      ...pick,
      picked: pick.mode === currentMode
    })),
    {
      placeHolder: 'Choose how LocalPilot inline autocomplete should behave'
    }
  );

  if (!selected) {
    return undefined;
  }

  await updateInlineCompletionMode(selected.mode);
  await vscode.window.showInformationMessage(
    `LocalPilot inline autocomplete is now ${selected.mode}.`
  );

  return selected.mode;
}

export async function updateInlineCompletionMode(mode: InlineCompletionMode): Promise<void> {
  const config = vscode.workspace.getConfiguration('localpilot');

  await config.update('inlineCompletionMode', mode, vscode.ConfigurationTarget.Global);
}

export function getInlineModePicks(): InlineModePick[] {
  return INLINE_MODE_PICKS;
}
