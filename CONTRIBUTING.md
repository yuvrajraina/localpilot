# Contributing to LocalPilot

Thanks for helping improve LocalPilot.

## Development Setup

```bash
npm install
npm run compile
npm run lint
npm test
```

Use Node.js 20 or newer.

## Design Principles

- Keep LocalPilot local-first. Do not add cloud AI APIs.
- Do not add telemetry.
- Prefer VS Code APIs and simple TypeScript modules.
- Keep files small and maintainable.
- Respect the existing safety filters for secrets, generated files, dependency folders, and large
  files.
- Every Ollama-backed feature should fail gracefully when Ollama is unavailable.

## Pull Requests

Before opening a pull request:

```bash
npm run compile
npm run lint
npm test
```

Include focused tests for new behavior. For UI changes, include screenshots or short notes showing
the workflow.

## Packaging Check

```bash
npm run package
```

The VSIX should not include source files, tests, `node_modules`, build maps, or local workspace
artifacts.
