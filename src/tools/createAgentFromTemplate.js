/**
 * @fileoverview MCP tool: createAgentFromTemplate
 * Creates a background agent from a curated prompt template, validating params and composing the existing createAgent flow.
 */

import { z } from 'zod';
import { templates } from '../templates/index.js';
import { handleMCPError, validateInput, createSuccessResponse, schemas as baseSchemas } from '../utils/errorHandler.js';

// Template name enum
const TemplateName = z.enum(['docAudit', 'typeCleanup', 'bugHunt']);

// Per-template params schemas
const docAuditParams = z.object({
  docPaths: z.array(z.string()).nonempty('At least one doc path is required'),
  guidelines: z.string().min(1).optional(),
});

const typeCleanupParams = z.object({
  strictMode: z.boolean().optional(),
  includeDirs: z.array(z.string()).optional(),
});

const bugHuntParams = z.object({
  area: z.string().min(1, 'Area is required'),
  flaky: z.boolean().optional(),
});

const paramsByTemplate = {
  docAudit: docAuditParams,
  typeCleanup: typeCleanupParams,
  bugHunt: bugHuntParams,
};

// Build request schema using a discriminated union for template/params
const createAgentFromTemplateRequest = z.discriminatedUnion('template', [
  z.object({
    template: z.literal('docAudit'),
    params: docAuditParams,
    model: z.string().min(1).default('auto'),
    source: baseSchemas.source,
    target: baseSchemas.target.optional(),
    webhook: baseSchemas.webhook.optional(),
  }),
  z.object({
    template: z.literal('typeCleanup'),
    params: typeCleanupParams,
    model: z.string().min(1).default('auto'),
    source: baseSchemas.source,
    target: baseSchemas.target.optional(),
    webhook: baseSchemas.webhook.optional(),
  }),
  z.object({
    template: z.literal('bugHunt'),
    params: bugHuntParams,
    model: z.string().min(1).default('auto'),
    source: baseSchemas.source,
    target: baseSchemas.target.optional(),
    webhook: baseSchemas.webhook.optional(),
  }),
]);

/**
 * Factory to create the tool definition bound to a specific Cursor API client instance.
 * @param {import('../utils/cursorClient.js').cursorApiClient} client
 */
export function createAgentFromTemplateTool(client) {
  return {
    name: 'createAgentFromTemplate',
    description: 'Create a background agent from a curated template (docAudit, typeCleanup, bugHunt)',
    inputSchema: {
      type: 'object',
      properties: {
        template: { type: 'string', enum: ['docAudit', 'typeCleanup', 'bugHunt'] },
        params: { type: 'object', description: 'Template-specific parameters' },
        model: { type: 'string', description: 'The LLM to use (defaults to auto)', default: 'auto' },
        source: {
          type: 'object',
          properties: {
            repository: { type: 'string', description: 'The GitHub repository URL' },
            ref: { type: 'string', description: 'Git ref (branch/tag) to use as the base branch' },
          },
          required: ['repository'],
        },
        target: {
          type: 'object',
          properties: {
            autoCreatePr: { type: 'boolean' },
            branchName: { type: 'string' },
          },
        },
        webhook: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            secret: { type: 'string' },
          },
          required: ['url'],
        },
      },
      required: ['template', 'params', 'source'],
    },
    handler: async (input) => {
      const start = Date.now();
      try {
        // Validate high-level structure
        const validated = validateInput(createAgentFromTemplateRequest, input, 'createAgentFromTemplate');

        // Validate params against the selected template schema explicitly
        const templ = validated.template;
        const paramsSchema = paramsByTemplate[templ];
        // This check should be unreachable since `templ` is validated against the `TemplateName` enum.
        // Retained for runtime safety in case of future changes or unexpected input.
        if (!paramsSchema) {
          throw new Error(`Template "${templ}" is not supported. Supported: docAudit, typeCleanup, bugHunt.`);
        }
        const validatedParams = validateInput(paramsSchema, validated.params, 'createAgentFromTemplate');

        // Render prompt using catalog
        const templateEntry = templates[templ];
        if (!templateEntry || typeof templateEntry.render !== 'function') {
          throw new Error(`Template renderer not found for "${templ}"`);
        }
        const promptText = templateEntry.render(validatedParams);

        // Compose createAgent payload, reusing existing schema types
        const payload = {
          prompt: { text: promptText },
          model: validated.model || 'auto',
          source: validated.source,
          target: validated.target,
          webhook: validated.webhook,
        };

        // Call existing client.createAgent
        const result = await client.createAgent(payload);

        const durationMs = Date.now() - start;
        const paramKeys = Object.keys(validatedParams || {});
        // Lightweight telemetry log
        // eslint-disable-next-line no-console
        console.info('[createAgentFromTemplate] template=%s keys=%s durationMs=%d', templ, paramKeys.join(','), durationMs);

        return createSuccessResponse(
          '✅ Successfully created agent from template!\n' +
          `🧩 Template: ${templ}\n` +
          `📋 ID: ${result.id}\n` +
          `📊 Status: ${result.status}\n` +
          `🌐 View: ${result.target.url}\n` +
          `📅 Created: ${new Date(result.createdAt).toLocaleString()}`,
          {
            agentId: result.id,
            status: result.status,
            url: result.target.url,
            createdAt: result.createdAt,
            template: templ,
          },
        );
      } catch (error) {
        return handleMCPError(error, 'createAgentFromTemplate');
      }
    },
  };
}

