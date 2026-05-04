# LocalPilot

LocalPilot is a local Ollama-powered AI coding assistant for VS Code. It is built for developers
who want inline suggestions, code explanations, fixes, tests, and chat without sending code to cloud
AI services.

## Features

- Copilot-style inline ghost-text suggestions powered by local Ollama models.
- Status bar menu for Ollama health, model selection, setup, chat, and inline mode.
- Chat panel for asking questions about selected code or the active file, with quick actions and
  code-block copy buttons.
- Selected-code commands for explaining code, adding comments, fixing code, generating tests, and
  solving coding problems.
- Code Actions for quick lightbulb access in common languages.
- Error explainer for selected stack traces or pasted terminal errors.
- Safe apply workflow with diff preview, copy option, and explicit apply confirmation.
- First-run setup that checks Ollama, lists local models, and asks before any model pull.
- Privacy-first defaults: no telemetry, no cloud AI APIs, and local-only model calls.

## Screenshots

Screenshots will be added before Marketplace publication.

- Inline suggestions: `resources/screenshots/inline-suggestions.png`
- Chat sidebar: `resources/screenshots/chat-sidebar.png`
- Safe diff preview: `resources/screenshots/diff-preview.png`

## Installation

Install LocalPilot from the VS Code Marketplace, or install a packaged VSIX:

```bash
code --install-extension localpilot-0.0.1.vsix
```

For local development:

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Ollama Setup

Install Ollama from:

```text
https://ollama.com/download
```

Start Ollama:

```bash
ollama serve
```

LocalPilot talks to this local host by default:

```text
http://localhost:11434
```

You can change it with `localpilot.ollamaHost`.

## Recommended Models

LocalPilot can guide setup on first run with `LocalPilot: Run Setup`. You can also pull models
manually:

```bash
ollama pull qwen2.5-coder:1.5b
ollama pull qwen2.5-coder:7b
ollama pull smollm2:360m
ollama pull deepseek-coder:1.3b
ollama pull codegemma:2b
```

Suggested profiles:

- Balanced: `qwen2.5-coder:1.5b` for responsive local autocomplete and chat.
- Quality: `qwen2.5-coder:7b` for stronger local coding help on machines with more memory.
- Micro: `smollm2:360m` for very low-resource machines.
- Lite: `deepseek-coder:1.3b` for older low-end setups.
- Compact: `codegemma:2b` for a small general coding model.

LocalPilot never pulls a model automatically. It asks before downloads because model files can be
large.

## Low RAM Mode

Use `localpilot.mode` to control resource usage:

- `auto`: conservative defaults.
- `micro`: shortest context and smallest outputs.
- `lite`: balanced low-resource behavior.
- `standard`: more useful context and output sizes.
- `custom`: use your configured context and output settings.

Related settings:

- `localpilot.inlineDebounceMs`
- `localpilot.disableInlineForLargeFiles`
- `localpilot.maxFileSizeKb`
- `localpilot.enableLowRamWarnings`

## Commands

- `LocalPilot: Open Chat`
- `LocalPilot: Explain Selected Code`
- `LocalPilot: Explain Error`
- `LocalPilot: Add Comments to Selection`
- `LocalPilot: Fix Selected Code`
- `LocalPilot: Generate Tests`
- `LocalPilot: Solve Coding Problem`
- `LocalPilot: Check Ollama Status`
- `LocalPilot: Select Local Model`
- `LocalPilot: Switch Inline Completion Mode`
- `LocalPilot: Open Status Menu`
- `LocalPilot: Run Setup`

## Settings

- `localpilot.ollamaHost`
- `localpilot.inlineModel`
- `localpilot.chatModel`
- `localpilot.lowRamModel`
- `localpilot.mode`
- `localpilot.enableInlineSuggestions`
- `localpilot.inlineCompletionMode` (`full` by default, or `line` for conservative one-line suggestions)
- `localpilot.maxContextLines`
- `localpilot.maxOutputTokens`
- `localpilot.temperature`
- `localpilot.inlineDebounceMs`
- `localpilot.disableInlineForLargeFiles`
- `localpilot.maxFileSizeKb`
- `localpilot.enableLowRamWarnings`

## Privacy

LocalPilot does not send code to cloud services. It talks to local Ollama by default and does not
collect telemetry. See [PRIVACY.md](PRIVACY.md) for details.

## Troubleshooting

- Ollama disconnected: run `ollama serve`, then use `LocalPilot: Check Ollama Status`.
- No models found: run `LocalPilot: Run Setup` or pull a model with `ollama pull <model>`.
- Inline suggestions feel slow: switch `localpilot.inlineCompletionMode` to `line`, or switch
  `localpilot.mode` to `micro` or `lite`.
- Output looks weak: try a larger local model and set it with `LocalPilot: Select Local Model`.
- Files are skipped: LocalPilot blocks secrets, generated folders, lock files, and large files by
  design.

## Known Limitations

- Model quality depends on the local model you install.
- Very small models may produce incomplete fixes or tests.
- LocalPilot does not read terminal contents automatically.
- Full inline completions are bounded and filtered, but local model quality still matters.
- Large workspaces and generated files are filtered aggressively for safety and responsiveness.

## Development

```bash
npm run compile
npm run lint
npm test
npm run package
```
