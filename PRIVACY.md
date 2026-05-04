# Privacy Policy

LocalPilot is designed for local-first coding assistance.

## Local Code Handling

LocalPilot does not send code to cloud services. Code context is prepared inside VS Code and sent
only to the configured Ollama REST API host.

## Ollama Host

LocalPilot talks to local Ollama by default:

```text
http://localhost:11434
```

If you change `localpilot.ollamaHost`, requests will go to the host you configure.

## Telemetry

No telemetry is collected. LocalPilot does not track usage, prompts, completions, files, errors, or
workspace metadata.

## Models

User is responsible for installed models. Model behavior, storage location, license terms, and any
network behavior outside LocalPilot are controlled by Ollama and the models you install.

## Safety Filters

LocalPilot avoids reading `.env` files, private keys, lock files, dependency folders, generated
folders, and oversized files. Secret-like strings are redacted before prompt text is sent to Ollama.

## Clipboard and Edits

LocalPilot writes to the clipboard only when you choose a copy action. LocalPilot modifies files only
after a diff preview and explicit apply confirmation.
