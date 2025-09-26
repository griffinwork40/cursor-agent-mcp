# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: cursor-agent-mcp — a production-ready MCP server for Cursor Background Agents API.

What you’ll use most

- Install deps
  - npm install
- Start HTTP server (Express, exposes /mcp, /sse, /health)
  - npm start
- Dev server (auto-reload)
  - npm run dev
- Start MCP server over stdio (for local MCP runners)
  - npm run mcp
- Lint
  - npm run lint:check   # check only
  - npm run lint         # fix where possible
- Tests (Jest)
  - npm test                         # run all tests
  - npm test -- src/__tests__/tokenUtils.test.js      # run a single file
  - npm test -- -t "should mint token"                # run by test name (regex)
- Local HTTP sanity checks
  - curl http://localhost:3000/health

Environment

- Node.js >= 18
- Required
  - CURSOR_API_KEY
- Optional
  - PORT (default 3000)
  - CURSOR_API_URL (default https://api.cursor.com)
  - TOKEN_SECRET (enables stable zero-storage tokens)
  - TOKEN_TTL_DAYS (default 30)

High-level architecture

- Entry points
  - src/index.js (Express HTTP server)
    - Endpoints
      - GET /health: liveness with version+uptime
      - GET /: discovery info for ChatGPT
      - POST /: JSON-RPC-style MCP shim (initialize, tools/list, tools/call)
      - POST /mcp: JSON-RPC MCP endpoint (tools/list, tools/call)
      - GET /sse: MCP over Server-Sent Events via @modelcontextprotocol SDK
      - OAuth discovery stubs under /.well-known and /oauth/* for ChatGPT compatibility
    - Per-request API key extraction (header/query/body) with zero-storage token support
    - At request time, constructs tools wired to a Cursor API client carrying that key
  - src/mcp-server.js (stdio MCP server)
    - Pure MCP over stdio for local runners; shares tool set and error handling

- Tools layer (MCP tools)
  - src/tools/index.js
    - 9 tools: createAgent, listAgents, getAgent, deleteAgent, addFollowup,
      getAgentConversation, getMe, listModels, listRepositories
    - Input validation with Zod schemas (via utils/errorHandler.js)
    - Each handler delegates to Cursor client and returns MCP-formatted content

- Cursor API client
  - src/utils/cursorClient.js
    - Axios instance against CURSOR_API_URL, optional Authorization: Bearer key_*
    - Endpoints wrapped: /v0/agents*, /v0/models, /v0/repositories, /v0/me
    - Interceptors log requests/responses for observability

- Error handling + validation
  - src/utils/errorHandler.js
    - Custom error classes (ValidationError, ApiError, AuthenticationError, etc.)
    - Zod schemas for tool inputs (prompt, source, target, webhook, etc.)
    - handleMCPError converts errors into consistent MCP content payloads

- Zero-storage token utilities
  - src/utils/tokenUtils.js
    - AES-256-GCM encrypts API key into a compact base64url token (mint/decode)
    - Key derives from TOKEN_SECRET; TTL enforced via TOKEN_TTL_DAYS

- Config
  - src/config/index.js
    - dotenv loads .env; exports { port, cursor: {apiKey, apiUrl}, token: {secret, ttlDays} }

- CI/CD (GitHub Actions)
  - .github/workflows/main.yml
    - Unit tests on Node 18.x/20.x
    - ESLint checks
    - npm audit (security)
    - Optional integration tests (start server, hit health, run test scripts) gated by CURSOR_API_KEY secret
    - Build verification including CLI and stdio/HTTP startup checks

Files worth knowing

- package.json — scripts, bin, engines (node >=18)
- README.md — installation, MCP client config, self-hosting notes, endpoint list
- docs/api-reference.md — detailed tool schemas and examples
- docs/SECURITY.md — auth, tokening, webhook security, secret management
- src/__tests__ — Jest tests for core protocol and token utilities

Common workflows

- Run HTTP server locally with your key
  - export CURSOR_API_KEY=key_...
  - npm start
  - curl http://localhost:3000/health
- Use per-request API keys (HTTP mode)
  - curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer key_..." \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

Notes

- There is no build step; code runs directly with Node ESM. Use dev script (nodemon) during development.
- The SSE endpoint intentionally avoids CORS headers; it’s used by MCP transports.
