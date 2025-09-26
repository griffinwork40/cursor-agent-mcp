# Repository Guidelines

## Project Structure & Module Organization
The production entrypoint is `src/index.js`, which wires the MCP transport, Express server, and token utilities. `src/mcp-server.js` exposes the server as a standalone MPC process. Configuration defaults live in `src/config/index.js`; shared helpers (Cursor client, error handling, token minting) are under `src/utils/`. Tool definitions are grouped in `src/tools/index.js`. Manual assets such as `mcp-images/generation_history.json` are persisted in `mcp-images/` and treated as runtime artifacts. Test harnesses and examples (`test-mcp-client.js`, `test-curl-examples.sh`, `test-postman-collection.json`) sit at the repo root for quick access during development.

## Build, Test, and Development Commands
- `npm start` — Run the HTTP + MCP server on the configured port (defaults to 3000).
- `npm run mcp` — Launch only the MCP server process for embedding in external clients.
- `npm run dev` — Start the server with `nodemon` for live reload during local iteration.
- `npm test` — Execute the Jest suite (`--passWithNoTests` is enabled, so add tests to enforce coverage).

## Coding Style & Naming Conventions
All source files use ES modules and target Node.js ≥18.0.0. Keep two-space indentation, trailing commas only where required, and `'single quotes'` for strings. Prefer `camelCase` for functions/variables, `PascalCase` for classes, and kebab-case for script names. Centralize configuration through `config` exports rather than ad-hoc `process.env` reads inside modules.

## Testing Guidelines
Jest tests should live alongside source files as `*.test.js` or under a dedicated `__tests__/` folder. Mock Cursor API calls when practical to keep tests deterministic. For end-to-end checks, use the interactive client (`node test-mcp-client.js`) or the cURL script (`./test-curl-examples.sh`); both expect `CURSOR_API_KEY` and optional `MCP_SERVER_TOKEN` to be set. Update `TESTING.md` if new scenarios or tooling are introduced.

## Commit & Pull Request Guidelines
Follow the existing history: short (≤72 char) imperative subjects such as “Add root endpoint for ChatGPT discovery”. Reference related issues in the body, and summarize API or configuration changes explicitly. Pull requests should include: purpose and major changes, test evidence (`npm test`, manual script outputs), any new environment variables, and screenshots or logs when behavior is user-facing.

## Configuration & Security Notes
Environment settings belong in `.env`; load them via `dotenv` in `src/config/index.js`. Never commit real Cursor API keys or minted tokens. If you introduce new secrets, document placeholder names in `README.md` and ensure sensitive files are covered by `.gitignore`. Use `MCP_SERVER_TOKEN` for securing SSE endpoints in shared deployments.
