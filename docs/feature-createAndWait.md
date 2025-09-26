## Feature: createAndWait Orchestration Tool (Backlog #14)

### Purpose
Provide a high-level orchestration tool that creates a background agent and waits until it reaches a terminal state, returning the final status and agent details. This abstracts away polling complexity for clients while reusing existing `createAgent` and `getAgent` capabilities.

### User Stories
- As a client, I want to create an agent and get its final status in one call so I don’t manage polling.
- As a client, I want configurable polling interval and overall timeout to balance responsiveness and cost.
- As a client, I want graceful cancellation support so I can stop waiting when not needed.
- As a client, I want clear error messages and partial data when timeouts or errors occur.

### Constraints & Non-Goals
- Must reuse existing `createAgent` and `getAgent` code paths; do not duplicate DTOs.
- Do not introduce breaking changes to existing tools or schemas.
- Keep changes small and typed; validation is performed with Zod like the other tools.
- No server-side job queue; this is a synchronous wait with polling.

### Input Schema (Zod)
```ts
// createAndWait input
const createAndWaitRequest = z.object({
  prompt: schemas.prompt,
  model: z.string().min(1).default('auto'),
  source: schemas.source,
  target: schemas.target.optional(),
  webhook: schemas.webhook.optional(),
  pollIntervalMs: z.number().int().min(250).max(60_000).default(2_000),
  timeoutMs: z.number().int().min(5_000).max(86_400_000).default(600_000), // 10 minutes
  jitterRatio: z.number().min(0).max(0.5).default(0.1), // 0–50% jitter
  cancelToken: z.string().optional(), // optional logical token to cancel future waits
});
```

Example:
```json
{
  "prompt": { "text": "Refactor utils for readability and add tests" },
  "source": { "repository": "https://github.com/org/repo", "ref": "main" },
  "model": "auto",
  "target": { "autoCreatePr": true },
  "pollIntervalMs": 1500,
  "timeoutMs": 900000,
  "jitterRatio": 0.1
}
```

### Output Schema (Zod)
```ts
const createAndWaitResponse = z.object({
  finalStatus: z.enum(['FINISHED', 'ERROR', 'EXPIRED', 'CANCELLED', 'TIMEOUT']),
  agent: z.any().nullable(), // full agent object when available
  agentId: z.string().optional(),
  elapsedMs: z.number().int(),
});
```

Example:
```json
{
  "finalStatus": "FINISHED",
  "agentId": "bc_abc123",
  "elapsedMs": 84217,
  "agent": { "id": "bc_abc123", "status": "FINISHED", "target": { "url": "https://cursor.com/agents?id=bc_abc123" } }
}
```

### Polling Strategy
- Initial call invokes existing `createAgent` and records `agentId`.
- Poll `getAgent(id)` until the status is terminal: FINISHED, ERROR, EXPIRED.
- Configurable `pollIntervalMs` with bounded random jitter: actualDelay = pollIntervalMs * (1 ± jitterRatio * rand).
- Enforce `timeoutMs` from the moment after creation is acknowledged.
- Return early if a cancellation signal is detected (see Cancellation).

### Jitter
- Purpose: Avoid thundering herd and align with backoff best practices.
- Use uniform jitter in [−jitterRatio, +jitterRatio]. Bound interval to [250ms, 60s].

### Cancellation
- Accept optional `cancelToken` string. Cancellation is cooperative:
  - A simple in-memory set holds cancelled tokens during the server process lifetime.
  - Expose a dedicated `cancelCreateAndWait` tool to allow clients to request cancellation via MCP.
  - If token is marked cancelled during polling, return `{ finalStatus: 'CANCELLED' }` with latest known agent snapshot and clear the token so it can be reused.
- Future: consider persistence or distributed cancellation if multiple instances are introduced.

### Error Handling, Timeouts, Partial Results
- If `createAgent` fails: return standard MCP error via `handleMCPError`.
- If `getAgent` fails transiently: retry on next tick (skip counting as terminal), but still honor `timeoutMs`.
- On `timeoutMs` exceeded: return `{ finalStatus: 'TIMEOUT', agent, elapsedMs }` with last known snapshot (may be null if none).
- On terminal statuses: return `{ finalStatus: status, agent }`.

### Telemetry & Logging
- Log lifecycle events at INFO: created(id), poll(start, intervalMs), poll(attempt, status), terminal(status), timeout, cancelled.
- Log errors at ERROR with context `createAndWait`.
- Avoid noisy logs in hot paths; summarize every N polls if necessary.

### Implementation Plan
1) Docs: add this design document.
2) Validation: extend Zod in `utils/errorHandler.js` to export `createAndWaitRequest` & `createAndWaitResponse` schemas.
3) Tool registration: add `createAndWait` to `src/tools/index.js` with JSON schema mirroring Zod defaults and descriptions.
4) Implementation: new `src/tools/createAndWait.ts` that:
   - Validates input via shared Zod.
   - Calls `client.createAgent` then loops `client.getAgent` with jittered delay until terminal/timeout/cancel.
   - Returns a success response composed like other tools plus structured JSON in second content item.
5) Tests: `src/__tests__/tools/createAndWait.test.ts` mocking client to cover FINISHED, ERROR, EXPIRED, TIMEOUT, CANCELLED, and validation.
6) Docs: update `README.md` and `docs/api-reference.md` with tool description and examples.

### Backwards Compatibility
- No changes to existing tools; only new tool added.
- Shared Zod schemas are extended without modifying existing behavior defaults.

### Security Considerations
- No additional external calls beyond existing client methods.
- Avoid logging secrets; only log agent IDs and status.

