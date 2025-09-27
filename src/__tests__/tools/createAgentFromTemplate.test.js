import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { createAgentFromTemplateTool } from '../../tools/createAgentFromTemplate.js';

describe('createAgentFromTemplate tool', () => {
  let mockClient;
  let tool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      createAgent: jest.fn().mockResolvedValue({
        id: 'a1',
        status: 'CREATING',
        target: { url: 'https://example.com/agent/a1' },
        createdAt: new Date('2025-01-01T00:00:00Z').toISOString(),
      }),
    };
    tool = createAgentFromTemplateTool(mockClient);
  });

  it('registers with correct name and schema basics', () => {
    expect(tool.name).toBe('createAgentFromTemplate');
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe('object');
  });

  it('creates an agent for docAudit template', async () => {
    const args = {
      template: 'docAudit',
      params: { docPaths: ['docs/**/*.md'], guidelines: 'Be concise.' },
      model: 'default',
      source: { repository: 'https://github.com/org/repo', ref: 'main' },
      target: { autoCreatePr: true, branchName: 'audit-docs' },
    };

    const result = await tool.handler(args);
    expect(mockClient.createAgent).toHaveBeenCalledTimes(1);
    const payload = mockClient.createAgent.mock.calls[0][0];
    expect(payload.prompt.text).toMatch(/Documentation Audit Task/);
    expect(payload.source.repository).toBe('https://github.com/org/repo');

    expect(result.content[0].text).toMatch(/Successfully created agent from template/);
  });

  it('creates an agent for typeCleanup template', async () => {
    const args = {
      template: 'typeCleanup',
      params: { strictMode: true, includeDirs: ['src'] },
      source: { repository: 'https://github.com/org/repo' },
    };

    await tool.handler(args);
    const payload = mockClient.createAgent.mock.calls[0][0];
    expect(payload.prompt.text).toMatch(/TypeScript Type Cleanup Task/);
  });

  it('creates an agent for bugHunt template', async () => {
    const args = {
      template: 'bugHunt',
      params: { area: 'payments', flaky: true },
      source: { repository: 'https://github.com/org/repo', ref: 'develop' },
    };

    await tool.handler(args);
    const payload = mockClient.createAgent.mock.calls[0][0];
    expect(payload.prompt.text).toMatch(/Bug Hunt Task/);
    expect(payload.model).toBe('default');
  });

  it('errors on unknown template', async () => {
    const args = {
      template: 'unknown',
      params: {},
      source: { repository: 'https://github.com/org/repo' },
    };

    const res = await tool.handler(args);
    // Returns MCP error format with isError true
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Template/);
  });

  it('validates params for docAudit', async () => {
    const args = {
      template: 'docAudit',
      params: { docPaths: [] }, // invalid: nonempty required
      source: { repository: 'https://github.com/org/repo' },
    };

    const res = await tool.handler(args);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Validation Error/);
  });
});

