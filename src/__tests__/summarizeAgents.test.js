// Tests for the summarizeAgents MCP tool to ensure aggregation and validation behavior.
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { createTools } from '../tools/index.js';

const fixedNow = new Date('2024-01-01T12:00:00Z');

const buildMockClient = (agents = [], nextCursor = null) => ({
  listAgents: jest.fn().mockResolvedValue({ agents, nextCursor }),
});

describe('summarizeAgents tool', () => {
  let mockClient;
  let summarizeTool;

  const agentFixtures = [
    {
      id: 'agent-1',
      name: 'Watcher',
      status: 'RUNNING',
      createdAt: '2024-01-01T11:00:00Z',
      updatedAt: '2024-01-01T11:30:00Z',
      source: { repository: 'github.com/example/repo-one' },
    },
    {
      id: 'agent-2',
      name: 'Completer',
      status: 'FINISHED',
      createdAt: '2023-12-31T23:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
      source: { repository: 'github.com/example/repo-two' },
    },
    {
      id: 'agent-3',
      name: 'Oops',
      status: 'ERROR',
      createdAt: '2023-12-30T09:00:00Z',
      updatedAt: '2023-12-30T11:00:00Z',
      source: { repository: 'github.com/example/repo-one' },
    },
  ];

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow.getTime());
    mockClient = buildMockClient(agentFixtures, 'NEXT_CURSOR_TOKEN');
    summarizeTool = createTools(mockClient).find(tool => tool.name === 'summarizeAgents');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns dashboard summary with structured aggregates', async () => {
    const response = await summarizeTool.handler({ status: 'RUNNING' });

    expect(mockClient.listAgents).toHaveBeenCalledWith({});
    expect(response.content[0].text).toContain('Agent Summary Dashboard');
    expect(response.content[0].text).toContain('⚡ RUNNING');

    const structuredBlock = response.content[1];
    expect(structuredBlock.type).toBe('json');

    const { json } = structuredBlock;
    expect(json.filters.status).toBe('RUNNING');
    expect(json.statusCounts.RUNNING).toBe(1);
    expect(json.statusCounts.FINISHED).toBe(0);
    expect(json.recentAgents).toHaveLength(1);
    expect(json.inProgressAgents).toHaveLength(1);
    expect(json.inProgressAgents[0].ageSeconds).toBe(1800);
    expect(json.pagination.nextCursor).toBe('NEXT_CURSOR_TOKEN');
  });

  it('surfaces validation errors for unsupported filters', async () => {
    const response = await summarizeTool.handler({ status: 'UNKNOWN' });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Validation Error');
    expect(mockClient.listAgents).not.toHaveBeenCalledWith(expect.anything());
  });
});
