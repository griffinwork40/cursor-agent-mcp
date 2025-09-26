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

  it('handles repository filtering correctly', async () => {
    const response = await summarizeTool.handler({ repository: 'repo-one' });

    expect(mockClient.listAgents).toHaveBeenCalledWith({});
    expect(response.content[0].text).toContain('Agent Summary Dashboard');
    expect(response.content[0].text).toContain('repository~repo-one');

    const { json } = response.content[1];
    expect(json.filters.repository).toBe('repo-one');
    expect(json.recentAgents).toHaveLength(2); // Only agents from repo-one
  });

  it('handles limit filtering correctly', async () => {
    const response = await summarizeTool.handler({ limit: 2 });

    expect(mockClient.listAgents).toHaveBeenCalledWith({ limit: 2 });
    expect(response.content[0].text).toContain('Agent Summary Dashboard');

    const { json } = response.content[1];
    expect(json.filters.limit).toBe(2);
  });

  it('handles cursor pagination correctly', async () => {
    const response = await summarizeTool.handler({ cursor: 'test-cursor' });

    expect(mockClient.listAgents).toHaveBeenCalledWith({ cursor: 'test-cursor' });
    expect(response.content[0].text).toContain('Agent Summary Dashboard');

    const { json } = response.content[1];
    expect(json.filters.cursor).toBe('test-cursor');
  });

  it('handles combined filters correctly', async () => {
    const response = await summarizeTool.handler({ 
      status: 'FINISHED', 
      repository: 'repo-two',
      limit: 1, 
    });

    expect(mockClient.listAgents).toHaveBeenCalledWith({ limit: 1 });
    expect(response.content[0].text).toContain('status=FINISHED');
    expect(response.content[0].text).toContain('repository~repo-two');

    const { json } = response.content[1];
    expect(json.filters.status).toBe('FINISHED');
    expect(json.filters.repository).toBe('repo-two');
    expect(json.filters.limit).toBe(1);
  });

  it('handles empty agent list gracefully', async () => {
    const emptyMockClient = buildMockClient([], null);
    const emptySummarizeTool = createTools(emptyMockClient).find(tool => tool.name === 'summarizeAgents');
    
    const response = await emptySummarizeTool.handler({});

    expect(emptyMockClient.listAgents).toHaveBeenCalledWith({});
    expect(response.content[0].text).toContain('Total agents: 0');
    expect(response.content[0].text).toContain('Recent activity: none for the selected filters');

    const { json } = response.content[1];
    expect(json.totals.totalAgents).toBe(0);
    expect(json.recentAgents).toHaveLength(0);
    expect(json.inProgressAgents).toHaveLength(0);
  });

  it('validates limit bounds correctly', async () => {
    const response = await summarizeTool.handler({ limit: 0 });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Validation Error');
    expect(mockClient.listAgents).not.toHaveBeenCalledWith(expect.anything());
  });

  it('validates empty repository filter correctly', async () => {
    const response = await summarizeTool.handler({ repository: '' });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Validation Error');
    expect(mockClient.listAgents).not.toHaveBeenCalledWith(expect.anything());
  });
});
