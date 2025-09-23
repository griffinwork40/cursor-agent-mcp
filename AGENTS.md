# Repository Guidelines

## Project Structure & Module Organization
- `src/index.js` hosts the Express MCP server used in local dev; `src/mcp-server.js` wraps the CLI binary published to npm.
- Modules stay grouped by responsibility: config (`src/config/index.js`), tool definitions (`src/tools/index.js`), and shared utilities (`src/utils/`, e.g., `cursorClient.js` for Cursor API calls).
- Manual integration scripts (`test-mcp-client.js`, `test-error-handling.js`, `test-curl-examples.sh`) live in the repo root beside doc references (`README.md`, `SIMPLE_SETUP_GUIDE.md`, `TESTING.md`). Keep demo artefacts in `mcp-images/`.

## Build, Test, and Development Commands
- `npm install` (Node 18+) sets up dependencies; run once per fresh checkout.
- `npm start` serves the MCP API at `http://localhost:3000`; `npm run dev` hot-reloads via nodemon.
- `npm test` calls `jest --passWithNoTests`; extend the suite rather than disabling assertions.
- `node test-mcp-client.js` exercises full tool flows, while `bash test-curl-examples.sh` or `node test-error-handling.js` spot-check REST and error handling before release.

## Coding Style & Naming Conventions
- Follow the existing ES module style: two-space indentation, single quotes, trailing semicolons (`src/index.js:1` is the reference).
- Name functions in camelCase (`createTools`, `handleMCPError`); reserve PascalCase for constructors.
- Route all configuration through `src/config/index.js`; avoid reaching into `process.env` from feature code and mirror new values in documentation.

## Testing Guidelines
- Jest is the automated harness; place specs under `__tests__/` or `test/` and wire mocks beside the subject (`cursorClient.test.js`, etc.).
- Re-run `npm test` plus at least one integration driver (`node test-mcp-client.js` or `test-curl-examples.sh`) for features that touch Cursor APIs.
- Document new scenarios in `TESTING.md` when scripts gain options or expected payloads change.

## Commit & Pull Request Guidelines
- Use short, imperative commit subjects like the current history (`git log --oneline` shows “Update default model…”). Explain detail in the body only when needed.
- PRs should outline intent, list validation commands, and link issues; include payload snippets or screenshots when changing responses.
- Prefer squash merges unless coordinating a release train; flag breaking changes explicitly in the PR title.

## Security & Configuration Tips
- Keep secrets out of the repo; load `CURSOR_API_KEY` and peers via `.env`, and surface them through `config.cursor`.
- Validate new env vars in `src/config/index.js` before use and share defaults in README or this guide.
- When adding tools, reuse `cursorClient` and `handleMCPError` so telemetry and error formatting stay consistent.
