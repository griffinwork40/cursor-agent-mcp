import { jest } from '@jest/globals';
import { createTools } from './index.js';

function makeMockClient(overrides = {}) {
  return {
    createAgent: jest.fn(async (input) => ({
      id: 'agent123',
      status: 'CREATING',
      target: { url: 'https://example.com/agent/agent123' },
      createdAt: Date.now(),
      ...overrides.createAgentResult,
    })),
    listAgents: jest.fn(async () => ({ agents: [], nextCursor: null, ...overrides.listAgentsResult })),
    getAgent: jest.fn(async () => ({ id: 'agent123', status: 'RUNNING', name: 'Test', target: { url: 'x' }, source: { repository: 'y' }, createdAt: Date.now(), ...overrides.getAgentResult })),
    deleteAgent: jest.fn(async () => ({ id: 'agent123', ...overrides.deleteAgentResult })),
    addFollowup: jest.fn(async () => ({ id: 'agent123', ...overrides.addFollowupResult })),
    getAgentConversation: jest.fn(async () => ({ id: 'agent123', messages: [], ...overrides.getAgentConversationResult })),
    getMe: jest.fn(async () => ({ apiKeyName: 'Test Key', createdAt: Date.now(), ...overrides.getMeResult })),
    listModels: jest.fn(async () => ({ models: ['default', 'fast'], ...overrides.listModelsResult })),
    listRepositories: jest.fn(async () => ({ repositories: [], ...overrides.listRepositoriesResult })),
  };
}

describe('createTools handlers', () => {
  test('createAgent validates and returns success response', async () => {
    const client = makeMockClient();
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'createAgent');
    const res = await tool.handler({
      prompt: { text: 'Do work' },
      model: 'default',
      source: { repository: 'https://github.com/user/repo' },
    });
    expect(res.isError).toBeUndefined();
    expect(Array.isArray(res.content)).toBe(true);
    expect(client.createAgent).toHaveBeenCalled();
  });

  test('listAgents returns list content and data', async () => {
    const client = makeMockClient({ listAgentsResult: { agents: [{ id: 'a1', name: 'A', status: 'FINISHED', createdAt: Date.now() }] } });
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'listAgents');
    const res = await tool.handler({ limit: 10 });
    expect(res.content[0].type).toBe('text');
    expect(client.listAgents).toHaveBeenCalledWith({ limit: 10 });
  });

  test('getAgent validates id and returns details', async () => {
    const client = makeMockClient();
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'getAgent');
    const res = await tool.handler({ id: 'agent123' });
    expect(res.content[0].type).toBe('text');
    expect(client.getAgent).toHaveBeenCalledWith('agent123');
  });

  test('deleteAgent returns confirmation', async () => {
    const client = makeMockClient();
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'deleteAgent');
    const res = await tool.handler({ id: 'agent123' });
    expect(res.content[0].type).toBe('text');
    expect(client.deleteAgent).toHaveBeenCalledWith('agent123');
  });

  test('addFollowup validates and calls client', async () => {
    const client = makeMockClient();
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'addFollowup');
    const res = await tool.handler({ id: 'agent123', prompt: { text: 'More' } });
    expect(res.content[0].type).toBe('text');
    expect(client.addFollowup).toHaveBeenCalled();
  });

  test('getAgentConversation returns preview', async () => {
    const client = makeMockClient({ getAgentConversationResult: { messages: [{ type: 'user_message', text: 'Hi' }] } });
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'getAgentConversation');
    const res = await tool.handler({ id: 'agent123' });
    expect(res.content[0].type).toBe('text');
    expect(client.getAgentConversation).toHaveBeenCalledWith('agent123');
  });

  test('getMe returns info', async () => {
    const client = makeMockClient();
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'getMe');
    const res = await tool.handler({});
    expect(res.content[0].type).toBe('text');
    expect(client.getMe).toHaveBeenCalled();
  });

  test('listModels returns models', async () => {
    const client = makeMockClient();
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'listModels');
    const res = await tool.handler({});
    expect(res.content[0].type).toBe('text');
    expect(client.listModels).toHaveBeenCalled();
  });

  test('listRepositories returns repos', async () => {
    const client = makeMockClient();
    const tools = createTools(client);
    const tool = tools.find(t => t.name === 'listRepositories');
    const res = await tool.handler({});
    expect(res.content[0].type).toBe('text');
    expect(client.listRepositories).toHaveBeenCalled();
  });
});


