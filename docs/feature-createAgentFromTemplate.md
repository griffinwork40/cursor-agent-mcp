## Feature: createAgentFromTemplate MCP Tool

### Purpose
Provide a higher-level MCP tool that creates a Cursor Background Agent from a curated prompt template plus options. This reduces prompt variability, enforces clear validation, and composes the existing `createAgent` flow without duplicating logic.

### User Stories
- As an LLM/client, I can create an agent for a standard task (Doc Audit, Type Cleanup, Bug Hunt) by specifying a `template` and minimal params.
- As an operator, I can restrict to a known set of templates and receive clear validation errors for missing or invalid params.
- As a developer, I can add new templates centrally without changing the tool contract.

### Constraints and Principles
- MUST call the existing `createAgent` endpoint via the existing client; DO NOT duplicate API logic.
- MUST validate inputs with Zod using a template-name enum and per-template params schemas.
- MUST keep changes isolated and backward compatible with other tools.
- SHOULD emit structured errors consistent with `handleMCPError`.
- SHOULD include lightweight telemetry logs and respect rate limits.

---

### Interface (MCP Tool)
Name: `createAgentFromTemplate`

Description: Create an agent using a curated prompt template and options. Internally validates input and calls `createAgent`.

#### Input Schema (JSON)
```json
{
  "type": "object",
  "properties": {
    "template": { "type": "string", "enum": ["docAudit", "typeCleanup", "bugHunt"] },
    "params": { "type": "object", "description": "Template-specific parameters" },
    "model": { "type": "string", "default": "auto" },
    "source": {
      "type": "object",
      "properties": {
        "repository": { "type": "string" },
        "ref": { "type": "string" }
      },
      "required": ["repository"]
    },
    "target": {
      "type": "object",
      "properties": {
        "autoCreatePr": { "type": "boolean" },
        "branchName": { "type": "string" }
      }
    },
    "webhook": {
      "type": "object",
      "properties": {
        "url": { "type": "string" },
        "secret": { "type": "string" }
      },
      "required": ["url"]
    }
  },
  "required": ["template", "params", "source"]
}
```

#### Output Schema (JSON)
```json
{
  "type": "object",
  "properties": {
    "message": { "type": "string" },
    "agentId": { "type": "string" },
    "status": { "type": "string" },
    "url": { "type": "string" },
    "createdAt": { "type": "string" }
  },
  "required": ["agentId", "status", "url", "createdAt"]
}
```

---

### Zod Schemas

We will add a new schema module `schemas.createAgentFromTemplateRequest` in `src/tools/createAgentFromTemplate.ts` to avoid polluting `utils/errorHandler.js`. It composes the already-defined `schemas.source`, `schemas.target`, and `schemas.webhook` from `utils/errorHandler.js`.

```ts
import { z } from 'zod';

export const TemplateName = z.enum(['docAudit', 'typeCleanup', 'bugHunt']);

// Template-specific param schemas
export const docAuditParams = z.object({
  docPaths: z.array(z.string()).nonempty().describe('Globs/paths to docs'),
  guidelines: z.string().min(1).optional(),
});

export const typeCleanupParams = z.object({
  strictMode: z.boolean().default(true),
  includeDirs: z.array(z.string()).optional(),
});

export const bugHuntParams = z.object({
  area: z.string().min(1).describe('Subsystem or path focus'),
  flaky: z.boolean().optional(),
});

export const paramsByTemplate: Record<string, z.ZodTypeAny> = {
  docAudit: docAuditParams,
  typeCleanup: typeCleanupParams,
  bugHunt: bugHuntParams,
};

export const createAgentFromTemplateRequest = (baseSchemas: any) => z.object({
  template: TemplateName,
  params: z.union([docAuditParams, typeCleanupParams, bugHuntParams]),
  model: z.string().min(1).default('auto'),
  source: baseSchemas.source,
  target: baseSchemas.target.optional(),
  webhook: baseSchemas.webhook.optional(),
});
```

Example valid inputs:

```json
{
  "template": "docAudit",
  "params": { "docPaths": ["docs/**/*.md"], "guidelines": "Follow Chicago Manual of Style." },
  "model": "auto",
  "source": { "repository": "https://github.com/org/repo", "ref": "main" },
  "target": { "autoCreatePr": true, "branchName": "audit-docs" }
}
```

```json
{
  "template": "typeCleanup",
  "params": { "strictMode": true, "includeDirs": ["src"] },
  "source": { "repository": "https://github.com/org/repo" }
}
```

```json
{
  "template": "bugHunt",
  "params": { "area": "payments", "flaky": true },
  "source": { "repository": "https://github.com/org/repo", "ref": "develop" },
  "webhook": { "url": "https://hooks.example.com/cursor", "secret": "<redacted>" }
}
```

---

### Templates Catalog

File: `src/templates/index.ts`

Each template provides a prompt scaffold function that renders `prompt.text` and optional placeholders from params. Example strategies:

- docAudit: Emphasize clarity, consistency, link checking, and summarizing diffs.
- typeCleanup: Enforce TypeScript strictness, add types, remove `any`, and update configs.
- bugHunt: Reproduce, isolate, add tests, and propose fixes targeting the specified `area`.

Structure:

```ts
export type TemplateRenderer = (params: any) => string;
export const templates: Record<'docAudit'|'typeCleanup'|'bugHunt', { title: string; render: TemplateRenderer; }> = {
  docAudit: { title: 'Documentation Audit', render: (p) => `...` },
  typeCleanup: { title: 'TypeScript Type Cleanup', render: (p) => `...` },
  bugHunt: { title: 'Bug Hunt', render: (p) => `...` },
};
```

---

### Behavior
1. Validate input using Zod: template enum, params match, and reuse `source/target/webhook` schemas.
2. Resolve template to a `render(params)` to produce `prompt.text`.
3. Compose a `createAgent` payload: `{ prompt: { text }, model, source, target?, webhook? }`.
4. Call the existing `client.createAgent` through the existing tool composition.
5. Return a success response via `createSuccessResponse` mirroring `createAgent` tool style.

---

### Errors and Messages
- Unknown template: `Template "<name>" is not supported. Supported: docAudit, typeCleanup, bugHunt.`
- Params mismatch: include Zod field errors, e.g., `params.docPaths: Required`.
- Missing required repository: reuse `source.repository` error.
- API errors: pass through `handleMCPError`.

---

### Telemetry & Logging
- Log template usage at info level: template name and minimal param keys (not values).
- Include duration measurement for render + createAgent call.
- Do not log secrets (e.g., `webhook.secret`).

### Rate Limit Considerations
- If underlying API returns rate-limit errors, surface them unchanged via `handleMCPError`.
- Optionally add a simple in-process throttle per template (future work; not included in this change).

---

### Test Plan
- Unit tests for:
  - Valid calls for each template produce expected `prompt.text` and forward to `client.createAgent`.
  - Unknown template results in clear error.
  - Invalid params per template produce Zod errors.
  - Optional fields (`ref`, `branchName`, `webhook`) are accepted.

---

### Documentation Updates
- README: Add tool overview, example inputs, and behavior.
- docs/api-reference.md: Add schema blocks mirroring the input/output.

---

### Non-Goals
- Adding new templates beyond the initial three.
- Changing the existing `createAgent` tool contract.

