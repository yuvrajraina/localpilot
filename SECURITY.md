# Security Policy

## Supported Versions

LocalPilot is pre-1.0. Security fixes are handled on the latest published version.

## Reporting a Vulnerability

Please report security issues through the repository security advisory flow:

```text
https://github.com/localpilot/localpilot/security/advisories
```

If that is unavailable, open a private maintainer contact channel before sharing exploit details in
public issues.

## Security Design

- LocalPilot does not use cloud AI APIs.
- LocalPilot does not collect telemetry.
- LocalPilot talks to the configured Ollama host, which defaults to `http://localhost:11434`.
- LocalPilot blocks `.env`, private keys, lock files, generated folders, dependency folders, and
  large files from context collection.
- Safe apply flows show a diff and require confirmation before code is modified.

## User Responsibility

Users are responsible for the local Ollama server, installed models, and any network exposure of
their Ollama host.
