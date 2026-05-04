import * as assert from 'node:assert/strict';

import { renderChatMarkdown, getChatHtml } from '../src/webview/chatHtml';
import {
  getIntentForQuickAction,
  getQuickActionLabel,
  isQuickAction,
  parseIncomingMessage
} from '../src/webview/messageRouter';

suite('LocalPilot chat webview', () => {
  test('renders markdown code blocks safely with copy affordance', () => {
    const html = renderChatMarkdown([
      'Use this:',
      '',
      '```ts',
      'const value = "<script>";',
      '```'
    ].join('\n'));

    assert.match(html, /class="code-block"/);
    assert.match(html, /class="copy-code"/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  });

  test('chat shell includes stop control and fix-selection quick action', () => {
    const html = getChatHtml({
      nonce: 'testnonce',
      connected: true,
      model: 'qwen2.5-coder:7b'
    });

    assert.match(html, /id="stop"/);
    assert.match(html, /data-action="fixSelection"/);
    assert.match(html, /copy-code/);
  });

  test('router accepts cancel and fix-selection messages', () => {
    assert.deepEqual(parseIncomingMessage({ type: 'cancelRequest' }), {
      type: 'cancelRequest'
    });
    assert.deepEqual(parseIncomingMessage({ type: 'quickAction', action: 'fixSelection' }), {
      type: 'quickAction',
      action: 'fixSelection'
    });
    assert.equal(isQuickAction('fixSelection'), true);
    assert.equal(getIntentForQuickAction('fixSelection'), 'fixCode');
    assert.equal(getQuickActionLabel('fixSelection'), 'Fix selection');
  });
});
