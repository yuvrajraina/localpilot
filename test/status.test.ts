import * as assert from 'node:assert/strict';

import { buildStatusMarkdown } from '../src/commands/checkOllamaStatus';
import { getStatusActionPicks } from '../src/status/statusBar';

suite('LocalPilot status surface', () => {
  test('status menu exposes production assistant actions', () => {
    assert.deepEqual(
      getStatusActionPicks({
        connected: true,
        inlineEnabled: true,
        modelCount: 2
      }).map((pick) => pick.action),
      [
        'checkStatus',
        'switchInlineMode',
        'selectModel',
        'openChat',
        'runSetup',
        'toggleInline'
      ]
    );
  });

  test('status markdown includes selected model readiness and troubleshooting', () => {
    const markdown = buildStatusMarkdown({
      host: 'http://localhost:11434',
      isReachable: true,
      inlineModel: 'qwen2.5-coder:1.5b',
      chatModel: 'missing:latest',
      inlineMode: 'full',
      models: [
        {
          name: 'qwen2.5-coder:1.5b'
        }
      ]
    });

    assert.match(markdown, /Inline model: qwen2\.5-coder:1\.5b \(installed\)/);
    assert.match(markdown, /Chat model: missing:latest \(missing\)/);
    assert.match(markdown, /Inline autocomplete mode: full/);
    assert.match(markdown, /Troubleshooting/);
  });
});
