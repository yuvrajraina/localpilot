export type ChatHtmlParams = {
  nonce: string;
  connected: boolean;
  model: string;
};

export function renderChatMarkdown(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fencedBlockPattern = /```([A-Za-z0-9_+.-]*)\n([\s\S]*?)\n?```/g;
  let cursor = 0;
  let rendered = '';
  let match: RegExpExecArray | null;

  while ((match = fencedBlockPattern.exec(normalized)) !== null) {
    rendered += renderTextSegment(normalized.slice(cursor, match.index));
    rendered += renderCodeBlock(match[2] ?? '', match[1] ?? '');
    cursor = match.index + match[0].length;
  }

  rendered += renderTextSegment(normalized.slice(cursor));

  return rendered.trim().length > 0 ? rendered : '<p></p>';
}

export function getChatHtml(params: ChatHtmlParams): string {
  const statusText = params.connected ? 'Ollama connected' : 'Ollama disconnected';
  const statusClass = params.connected ? 'connected' : 'disconnected';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${params.nonce}'; script-src 'nonce-${params.nonce}';"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LocalPilot Chat</title>
  <style nonce="${params.nonce}">
    :root {
      color-scheme: light dark;
    }

    * {
      box-sizing: border-box;
    }

    body {
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      margin: 0;
      min-height: 100vh;
    }

    .shell {
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      height: 100vh;
      min-width: 0;
    }

    header {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 14px 16px 12px;
    }

    .title-row,
    .meta-row,
    .composer-row,
    .quick-actions {
      align-items: center;
      display: flex;
      gap: 8px;
    }

    .title-row {
      justify-content: space-between;
      margin-bottom: 8px;
    }

    h1 {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.2;
      margin: 0;
    }

    .pill {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      font-size: 12px;
      padding: 3px 8px;
      white-space: nowrap;
    }

    .pill.connected {
      color: var(--vscode-testing-iconPassed);
    }

    .pill.disconnected {
      color: var(--vscode-testing-iconFailed);
    }

    .model {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .quick-actions {
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-wrap: wrap;
      padding: 10px 16px;
    }

    button {
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid transparent;
      border-radius: 4px;
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
      font: inherit;
      min-height: 28px;
      padding: 4px 9px;
    }

    button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    button.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      cursor: default;
      opacity: 0.55;
    }

    #messages {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      padding: 16px;
    }

    .empty {
      align-self: center;
      color: var(--vscode-descriptionForeground);
      margin: auto;
      max-width: 420px;
      text-align: center;
    }

    .message {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      max-width: 100%;
      padding: 10px;
      word-break: break-word;
    }

    .message.user {
      align-self: flex-end;
      background: var(--vscode-inputValidation-infoBackground);
    }

    .message.assistant,
    .message.system {
      align-self: flex-start;
      background: var(--vscode-editorWidget-background);
    }

    .role {
      color: var(--vscode-descriptionForeground);
      display: block;
      font-size: 11px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }

    .message-content {
      line-height: 1.5;
    }

    .message-content p {
      margin: 0 0 8px;
      white-space: pre-wrap;
    }

    .message-content p:last-child {
      margin-bottom: 0;
    }

    .message-content code {
      background: var(--vscode-textCodeBlock-background);
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      padding: 1px 3px;
    }

    .code-block {
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin: 8px 0;
      overflow: hidden;
    }

    .code-header {
      align-items: center;
      border-bottom: 1px solid var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      display: flex;
      font-size: 12px;
      justify-content: space-between;
      padding: 4px 8px;
    }

    .code-block pre {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      margin: 0;
      overflow-x: auto;
      padding: 10px;
      white-space: pre;
    }

    .composer {
      border-top: 1px solid var(--vscode-panel-border);
      padding: 12px 16px;
    }

    textarea {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
      color: var(--vscode-input-foreground);
      font: inherit;
      min-height: 76px;
      padding: 8px;
      resize: vertical;
      width: 100%;
    }

    .composer-row {
      justify-content: space-between;
      margin-top: 8px;
    }

    .hint {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .actions {
      display: flex;
      gap: 8px;
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div class="title-row">
        <h1>LocalPilot</h1>
        <span id="status" class="pill ${statusClass}">${statusText}</span>
      </div>
      <div class="meta-row">
        <span id="model" class="model">Model: ${escapeHtml(params.model)}</span>
      </div>
    </header>

    <section class="quick-actions" aria-label="Quick actions">
      <button type="button" data-action="explainFile">Explain current file</button>
      <button type="button" data-action="explainSelection">Explain selection</button>
      <button type="button" data-action="findBugs">Find bugs</button>
      <button type="button" data-action="fixSelection">Fix selection</button>
      <button type="button" data-action="addComments">Add comments</button>
      <button type="button" data-action="generateTests">Generate tests</button>
      <button type="button" id="clear">Clear Chat</button>
    </section>

    <section id="messages" aria-live="polite">
      <div id="empty" class="empty">Ask about the active file, selected code, or use a quick action.</div>
    </section>

    <section class="composer">
      <textarea id="input" placeholder="Ask LocalPilot about your code..."></textarea>
      <div class="composer-row">
        <span class="hint">Ctrl/Cmd + Enter to send</span>
        <div class="actions">
          <button id="stop" type="button" hidden>Stop</button>
          <button id="send" class="primary" type="button">Send</button>
        </div>
      </div>
    </section>
  </main>

  <script nonce="${params.nonce}">
    const vscode = acquireVsCodeApi();
    const messages = document.getElementById('messages');
    const input = document.getElementById('input');
    const send = document.getElementById('send');
    const stop = document.getElementById('stop');
    const clear = document.getElementById('clear');
    const empty = document.getElementById('empty');
    const status = document.getElementById('status');
    const model = document.getElementById('model');
    let busy = false;

    function post(message) {
      vscode.postMessage(message);
    }

    function setBusy(nextBusy) {
      busy = nextBusy;
      send.disabled = busy;
      input.disabled = busy;
      stop.hidden = !busy;
      document.querySelectorAll('[data-action]').forEach((button) => {
        button.disabled = busy;
      });
    }

    function addMessage(message) {
      const item = document.createElement('article');
      item.className = 'message ' + message.role;

      const role = document.createElement('span');
      role.className = 'role';
      role.textContent = message.role;

      const content = document.createElement('div');
      content.className = 'message-content';
      content.innerHTML = message.html || '';

      item.append(role, content);
      messages.append(item);
      empty.hidden = true;
      messages.scrollTop = messages.scrollHeight;
    }

    function sendMessage() {
      const text = input.value.trim();

      if (!text || busy) {
        return;
      }

      input.value = '';
      post({ type: 'sendMessage', text });
    }

    send.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
      }
    });
    clear.addEventListener('click', () => {
      post({ type: 'clearChat' });
    });
    stop.addEventListener('click', () => {
      post({ type: 'cancelRequest' });
    });
    messages.addEventListener('click', async (event) => {
      const target = event.target;

      if (!(target instanceof HTMLButtonElement) || !target.classList.contains('copy-code')) {
        return;
      }

      const block = target.closest('.code-block');
      const code = block ? block.querySelector('code') : undefined;

      if (!code) {
        return;
      }

      await navigator.clipboard.writeText(code.textContent || '');
      target.textContent = 'Copied';
      setTimeout(() => {
        target.textContent = 'Copy';
      }, 1200);
    });
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!busy) {
          post({ type: 'quickAction', action: button.dataset.action });
        }
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'setStatus':
          status.textContent = message.connected ? 'Ollama connected' : 'Ollama disconnected';
          status.className = 'pill ' + (message.connected ? 'connected' : 'disconnected');
          model.textContent = 'Model: ' + message.model;
          break;
        case 'addMessage':
          addMessage(message.message);
          break;
        case 'clearChat':
          messages.textContent = '';
          messages.append(empty);
          empty.hidden = false;
          break;
        case 'setBusy':
          setBusy(message.busy);
          break;
      }
    });

    post({ type: 'ready' });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTextSegment(segment: string): string {
  const trimmed = segment.trim();

  if (trimmed.length === 0) {
    return '';
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${renderInlineCode(paragraph)}</p>`)
    .join('');
}

function renderInlineCode(value: string): string {
  const parts = value.split(/(`[^`\n]+`)/g);

  return parts
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }

      return escapeHtml(part).replace(/\n/g, '<br>');
    })
    .join('');
}

function renderCodeBlock(code: string, language: string): string {
  const label = language.trim() || 'code';

  return [
    '<div class="code-block">',
    '<div class="code-header">',
    `<span>${escapeHtml(label)}</span>`,
    '<button type="button" class="copy-code">Copy</button>',
    '</div>',
    `<pre><code>${escapeHtml(code)}</code></pre>`,
    '</div>'
  ].join('');
}
