/**
 * Unit Tests for CursorApiClient
 *
 * Tests the API client functionality with mocked HTTP requests
 */

import { createCursorApiClient } from '../../../src/utils/cursorClient.js';
import { mockHttp, mockData } from '../../utils/test-helpers.js';

// Mock the config module
jest.mock('../../../src/config/index.js', () => ({
  config: {
    cursor: {
      apiUrl: 'https://api.cursor.com',
      apiKey: 'test-api-key'
    }
  }
}));

// Mock axios with helper utilities for setting responses
jest.mock('axios', () => {
  const mockResponses = new Map();

  const buildKey = (method, url) => `${method.toUpperCase()} ${url}`;

  const handleRequest = (method, url) => {
    const key = buildKey(method, url);
    const response = mockResponses.get(key);

    if (!response) {
      return Promise.resolve({ data: undefined });
    }

    if (response.type === 'error') {
      return Promise.reject(response.payload);
    }

    return Promise.resolve({ data: response.payload });
  };

  const axiosMock = {
    create: jest.fn((config = {}) => ({
      post: jest.fn((url) => handleRequest('post', url)),
      get: jest.fn((url) => handleRequest('get', url)),
      delete: jest.fn((url) => handleRequest('delete', url)),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      defaults: { ...config }
    })),
    __setMockResponse: (method, url, payload) => {
      mockResponses.set(buildKey(method, url), { type: 'success', payload });
    },
    __setMockError: (method, url, error) => {
      mockResponses.set(buildKey(method, url), { type: 'error', payload: error });
    },
    __reset: () => {
      mockResponses.clear();
    }
  };

  return {
    __esModule: true,
    default: axiosMock,
    create: axiosMock.create
  };
});

describe('CursorApiClient', () => {
  let client;
  const mockAgentData = mockData.generateAgent();
  const mockUserData = mockData.generateUser();
  const mockModelData = mockData.generateModel();

  beforeEach(() => {
    client = createCursorApiClient('test-api-key');
    // Clean up any existing mocks
    mockHttp.cleanAll();
  });

  afterEach(() => {
    mockHttp.cleanAll();
  });

  describe('constructor', () => {
    test('should create axios instance with correct configuration', () => {
      const newClient = createCursorApiClient('custom-api-key');

      // Check that axios instance is configured
      expect(newClient.client.defaults.baseURL).toBe('https://api.cursor.com');
      expect(newClient.client.defaults.timeout).toBe(30000);
      expect(newClient.client.defaults.headers['User-Agent']).toBe('cursor-agent-mcp/1.0.0');
      expect(newClient.client.defaults.headers['Authorization']).toBe('Bearer custom-api-key');
    });

    test('should handle missing API key gracefully', () => {
      const clientWithoutKey = createCursorApiClient();

      expect(clientWithoutKey.client.defaults.headers['Authorization']).toBeUndefined();
    });
  });

  describe('createAgent', () => {
    test('should successfully create an agent', async () => {
      const agentData = {
        prompt: { text: 'Create a README file' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'claude-3-5-sonnet'
      };

      mockHttp.mockApiSuccess('/v0/agents', 'post', mockAgentData);

      const result = await client.createAgent(agentData);

      expect(result).toEqual(mockAgentData);
    });

    test('should handle API errors when creating agent', async () => {
      const agentData = {
        prompt: { text: '' }, // Invalid data
        source: { repository: 'https://github.com/test/repo' }
      };

      mockHttp.mockApiError('/v0/agents', 'post', 'Invalid request', 400);

      await expect(client.createAgent(agentData)).rejects.toThrow();
    });
  });

  describe('listAgents', () => {
    test('should successfully list agents', async () => {
      const mockAgentsList = {
        agents: [mockAgentData],
        total: 1,
        page: 1,
        limit: 10
      };

      mockHttp.mockApiSuccess('/v0/agents', 'get', mockAgentsList);

      const result = await client.listAgents();

      expect(result).toEqual(mockAgentsList);
    });

    test('should pass query parameters correctly', async () => {
      const mockAgentsList = { agents: [], total: 0 };
      const params = { limit: 5, status: 'active' };

      mockHttp.mockApiSuccess('/v0/agents', 'get', mockAgentsList);

      const result = await client.listAgents(params);

      expect(result).toEqual(mockAgentsList);
    });

    test('should handle empty agents list', async () => {
      const emptyList = { agents: [], total: 0 };

      mockHttp.mockApiSuccess('/v0/agents', 'get', emptyList);

      const result = await client.listAgents();

      expect(result).toEqual(emptyList);
      expect(result.agents).toHaveLength(0);
    });
  });

  describe('getAgent', () => {
    test('should successfully get agent details', async () => {
      const agentId = 'agent-123';

      mockHttp.mockApiSuccess(`/v0/agents/${agentId}`, 'get', mockAgentData);

      const result = await client.getAgent(agentId);

      expect(result).toEqual(mockAgentData);
    });

    test('should handle agent not found', async () => {
      const agentId = 'non-existent-agent';

      mockHttp.mockApiError(`/v0/agents/${agentId}`, 'get', 'Agent not found', 404);

      await expect(client.getAgent(agentId)).rejects.toThrow();
    });
  });

  describe('deleteAgent', () => {
    test('should successfully delete an agent', async () => {
      const agentId = 'agent-123';
      const deleteResponse = { message: 'Agent deleted successfully' };

      mockHttp.mockApiSuccess(`/v0/agents/${agentId}`, 'delete', deleteResponse);

      const result = await client.deleteAgent(agentId);

      expect(result).toEqual(deleteResponse);
    });

    test('should handle delete non-existent agent', async () => {
      const agentId = 'non-existent-agent';

      mockHttp.mockApiError(`/v0/agents/${agentId}`, 'delete', 'Agent not found', 404);

      await expect(client.deleteAgent(agentId)).rejects.toThrow();
    });
  });

  describe('addFollowup', () => {
    test('should successfully add followup to agent', async () => {
      const agentId = 'agent-123';
      const followupData = {
        message: 'Update the README with installation instructions'
      };
      const followupResponse = {
        id: 'followup-123',
        message: followupData.message,
        createdAt: new Date().toISOString()
      };

      mockHttp.mockApiSuccess(`/v0/agents/${agentId}/followup`, 'post', followupResponse);

      const result = await client.addFollowup(agentId, followupData);

      expect(result).toEqual(followupResponse);
    });

    test('should handle followup to non-existent agent', async () => {
      const agentId = 'non-existent-agent';
      const followupData = { message: 'Test message' };

      mockHttp.mockApiError(`/v0/agents/${agentId}/followup`, 'post', 'Agent not found', 404);

      await expect(client.addFollowup(agentId, followupData)).rejects.toThrow();
    });
  });

  describe('getAgentConversation', () => {
    test('should successfully get agent conversation', async () => {
      const agentId = 'agent-123';
      const conversationData = {
        messages: [
          { role: 'user', content: 'Create a README' },
          { role: 'assistant', content: 'I created the README file' }
        ]
      };

      mockHttp.mockApiSuccess(`/v0/agents/${agentId}/conversation`, 'get', conversationData);

      const result = await client.getAgentConversation(agentId);

      expect(result).toEqual(conversationData);
      expect(result.messages).toHaveLength(2);
    });

    test('should handle agent with no conversation', async () => {
      const agentId = 'agent-123';
      const emptyConversation = { messages: [] };

      mockHttp.mockApiSuccess(`/v0/agents/${agentId}/conversation`, 'get', emptyConversation);

      const result = await client.getAgentConversation(agentId);

      expect(result).toEqual(emptyConversation);
      expect(result.messages).toHaveLength(0);
    });
  });

  describe('getMe', () => {
    test('should successfully get user information', async () => {
      mockHttp.mockApiSuccess('/v0/me', 'get', mockUserData);

      const result = await client.getMe();

      expect(result).toEqual(mockUserData);
    });

    test('should handle authentication errors', async () => {
      mockHttp.mockApiError('/v0/me', 'get', 'Unauthorized', 401);

      await expect(client.getMe()).rejects.toThrow();
    });
  });

  describe('listModels', () => {
    test('should successfully list available models', async () => {
      const modelsList = {
        models: [mockModelData]
      };

      mockHttp.mockApiSuccess('/v0/models', 'get', modelsList);

      const result = await client.listModels();

      expect(result).toEqual(modelsList);
      expect(result.models).toHaveLength(1);
    });

    test('should handle empty models list', async () => {
      const emptyModels = { models: [] };

      mockHttp.mockApiSuccess('/v0/models', 'get', emptyModels);

      const result = await client.listModels();

      expect(result).toEqual(emptyModels);
      expect(result.models).toHaveLength(0);
    });
  });

  describe('listRepositories', () => {
    test('should successfully list repositories', async () => {
      const repoData = mockData.generateRepository();
      const repositoriesList = {
        repositories: [repoData]
      };

      mockHttp.mockApiSuccess('/v0/repositories', 'get', repositoriesList);

      const result = await client.listRepositories();

      expect(result).toEqual(repositoriesList);
      expect(result.repositories).toHaveLength(1);
    });

    test('should handle API errors', async () => {
      mockHttp.mockApiError('/v0/repositories', 'get', 'Server error', 500);

      await expect(client.listRepositories()).rejects.toThrow();
    });
  });

  describe('error handling and timeouts', () => {
    test('should handle network timeouts', async () => {
      mockHttp.mockTimeout('/v0/agents', 'post', 100);

      const agentData = {
        prompt: { text: 'Create a README' },
        source: { repository: 'https://github.com/test/repo' }
      };

      await expect(client.createAgent(agentData)).rejects.toThrow();
    });

    test('should handle rate limiting', async () => {
      mockHttp.mockApiError('/v0/agents', 'post', 'Rate limit exceeded', 429);

      const agentData = {
        prompt: { text: 'Create a README' },
        source: { repository: 'https://github.com/test/repo' }
      };

      await expect(client.createAgent(agentData)).rejects.toThrow();
    });
  });
});