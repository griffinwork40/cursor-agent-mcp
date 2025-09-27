Root cause investigation: HTTP 400 on createAndWait vs successful createAgent

Summary
- createAndWait was not implemented in the MCP server. Calls from clients expecting a create-and-wait flow were likely routed to createAgent or rejected upstream, resulting in HTTP 400 when inputs didn’t match expectations.
- The createAgent tool had a schema/help-text default mismatch: handler defaulted to 'default' while Zod schema and docs referenced 'auto'. This inconsistency could cause payload differences between tools/clients.

Changes
- Implemented a new MCP tool `createAndWait` with the same request schema as `createAgent` and added polling until terminal status (FINISHED/ERROR/EXPIRED) or 10-minute timeout.
- Standardized `model` default to 'auto' in both JSON schema and handler for `createAgent`.
- Enhanced API request/response logging with payload redaction for `secret` fields in `src/utils/cursorClient.js`.
- Added tests/scripts to reproduce and compare behaviors.

Repro Steps
1) Start server: PORT=3000 CURSOR_API_KEY=key_xxx npm start
2) Minimal payload (createAndWait):
   - prompt.text: "Touch a file hello.txt with greeting"
   - source.repository: "https://github.com/test/repo"
   - model: "auto"
3) Hardened payload (createAndWait):
   - Add source.ref: "main"
   - target.autoCreatePr: false
   - target.branchName: "mcp/test-create-and-wait"
   - model: concrete (e.g., "gpt-4o")
4) Compare with createAgent using equivalent payloads.
5) Use scripts:
   - ./test-curl-examples.sh (tests include createAndWait minimal/hardened)
   - node test-mcp-client.js (new functions createAndWaitMinimal/createAndWaitHardened)

Observed Behavior
- Prior to fix: createAndWait not available, client usage could hit 400 depending on upstream path.
- After fix: createAndWait invokes create, then polls /v0/agents/{id}. Responses and errors captured in logs.

Default branch resolution
- The MCP server passes `source.ref` through; it does not resolve default branch itself. If omitted, upstream Cursor API determines the default branch. No divergent logic between createAndWait and createAgent inside the MCP server after this change.

Proposed Fix
- Keep default `model` as 'auto' consistently.
- Use the implemented `createAndWait` MCP tool for synchronous flows instead of trying to overload `createAgent` behavior. Clients should avoid sending webhook/polling settings for createAndWait; the server handles polling internally.

Artifacts
- Server logs include redacted request/response payloads for /v0/agents and /v0/agents/{id}.
- Test outputs from test-curl-examples.sh and test-mcp-client.js show comparative results.

Next Steps
- If upstream HTTP 400 persists for specific repos/branches, capture the upstream error JSON from `cursorClient` logs and attach here with timestamps to coordinate with the Cursor API team.
