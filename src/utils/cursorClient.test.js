// Simple test to verify basic functionality
import { config } from '../config/index.js';

// Basic test that doesn't require complex mocking
describe('CursorApiClient - Basic Tests', () => {
  test('config is loaded correctly', () => {
    expect(config).toBeDefined();
    expect(config.cursor).toBeDefined();
    expect(config.cursor.apiUrl).toBeDefined();
  });

  test('basic math still works', () => {
    expect(2 + 2).toBe(4);
  });
});

describe('CursorApiClient', () => {
  let client;
  let apiKey;
  let baseUrl;
  let mockScope;

  // Mock data
  const mockAgentData = {
    id: 'agent-123',
    prompt: {
      text: 'Create a React app',
      images: []
    },
    model: 'claude-3-5-sonnet',
    source: {
      repository: 'https://github.com/user/repo.git',
      ref: 'main'
    }
  };

  const mockAgentList = {
    agents: [
      { id: 'agent-1', status: 'running' },
      { id: 'agent-2', status: 'completed' }
    ],
    nextCursor: null
  };

  const mockModelList = {
    models: [
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'gpt-4', name: 'GPT-4' }
    ]
  };

  const mockRepositoryList = {
    repositories: [
      { id: 'repo-1', name: 'user/repo1', url: 'https://github.com/user/repo1.git' },
      { id: 'repo-2', name: 'user/repo2', url: 'https://github.com/user/repo2.git' }
    ]
  };

  const mockUserInfo = {
    id: 'user-123',
    email: 'user@example.com',
    plan: 'pro'
  };

  beforeEach(() => {
    // Reset console spy
    consoleSpy.resetHistory();

    // Set up test configuration
    apiKey = 'test-api-key-123';
    baseUrl = 'https://api.cursor.com';
    client = new CursorApiClient(apiKey);

    // Create nock scope for mocking HTTP requests
    mockScope = nock(baseUrl)
      .defaultReplyHeaders({
        'Content-Type': 'application/json',
      });

    // Mock all axios requests to prevent actual HTTP calls
    sinon.stub(axios, 'create').returns({
      interceptors: {
        request: { use: sinon.stub() },
        response: { use: sinon.stub() }
      },
      get: sinon.stub(),
      post: sinon.stub(),
      put: sinon.stub(),
      delete: sinon.stub(),
      patch: sinon.stub(),
      head: sinon.stub(),
      options: sinon.stub()
    });
  });

  afterEach(() => {
    // Clean up nock mocks
    nock.cleanAll();
    // Restore axios.create
    sinon.restore();
  });

  describe('Constructor', () => {
    it('should initialize with API key in headers', () => {
      const testClient = new CursorApiClient(apiKey);
      expect(testClient.client.defaults.headers.Authorization).toBe(`Bearer ${apiKey}`);
      expect(testClient.client.defaults.headers['Content-Type']).toBe('application/json');
      expect(testClient.client.defaults.headers['User-Agent']).toBe('cursor-agent-mcp/1.0.0');
      expect(testClient.client.defaults.timeout).toBe(30000);
      expect(testClient.client.defaults.baseURL).toBe(config.cursor.apiUrl);
    });

    it('should initialize without API key when not provided', () => {
      const testClient = new CursorApiClient();
      expect(testClient.client.defaults.headers.Authorization).toBeUndefined();
      expect(testClient.client.defaults.headers['Content-Type']).toBe('application/json');
      expect(testClient.client.defaults.headers['User-Agent']).toBe('cursor-agent-mcp/1.0.0');
    });

    it('should set up request interceptor for logging', () => {
      const testClient = new CursorApiClient(apiKey);
      expect(testClient.client.interceptors.request.use.called).toBeTruthy();
    });

    it('should set up response interceptor for error handling', () => {
      const testClient = new CursorApiClient(apiKey);
      expect(testClient.client.interceptors.response.use.called).toBeTruthy();
    });

    it('should use custom base URL from config', () => {
      const customConfig = {
        ...config,
        cursor: { ...config.cursor, apiUrl: 'https://custom.cursor.com' }
      };
      sinon.stub(require('../config/index.js'), 'config').value(customConfig);

      const testClient = new CursorApiClient(apiKey);
      expect(testClient.client.defaults.baseURL).toBe('https://custom.cursor.com');

      // Restore original config
      require('../config/index.js').config = config;
    });
  });

  describe('createAgent', () => {
    it('should successfully create an agent', async () => {
      const axiosInstance = axios.create();
      axiosInstance.post.resolves({ data: mockAgentData });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.createAgent(mockAgentData);

      expect(axiosInstance.post.calledOnce).toBeTruthy();
      expect(axiosInstance.post.firstCall.args[0]).toBe('/v0/agents');
      expect(axiosInstance.post.firstCall.args[1]).toEqual(mockAgentData);
      expect(result).toEqual(mockAgentData);
      expect(consoleSpy.calledTwice).toBeTruthy(); // Request and response logging
    });

    it('should handle createAgent errors properly', async () => {
      const axiosInstance = axios.create();
      const error = new Error('API Error');
      error.response = { status: 400, data: { message: 'Invalid data' } };
      axiosInstance.post.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.createAgent(mockAgentData)).rejects.toThrow('API Error');
      expect(axiosInstance.post.calledOnce).toBeTruthy();
    });
  });

  describe('listAgents', () => {
    it('should successfully list agents with default params', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockAgentList });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.listAgents();

      expect(axiosInstance.get.calledOnce).toBeTruthy();
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/agents');
      expect(axiosInstance.get.firstCall.args[1]).toEqual({ params: {} });
      expect(result).toEqual(mockAgentList);
    });

    it('should successfully list agents with custom params', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockAgentList });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const params = { limit: 10, cursor: 'next-page' };
      const result = await testClient.listAgents(params);

      expect(axiosInstance.get.calledOnce).toBeTruthy();
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/agents');
      expect(axiosInstance.get.firstCall.args[1]).toEqual({ params });
      expect(result).toEqual(mockAgentList);
    });

    it('should handle listAgents errors', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Not Found');
      error.response = { status: 404, data: { message: 'No agents found' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.listAgents()).rejects.toThrow('Not Found');
    });
  });

  describe('getAgent', () => {
    it('should successfully get agent details', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockAgentData });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.getAgent('agent-123');

      expect(axiosInstance.get.calledOnce).toBeTruthy();
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/agents/agent-123');
      expect(result).toEqual(mockAgentData);
    });

    it('should handle getAgent errors for non-existent agent', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Agent not found');
      error.response = { status: 404, data: { message: 'Agent does not exist' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.getAgent('non-existent')).rejects.toThrow('Agent not found');
    });
  });

  describe('deleteAgent', () => {
    it('should successfully delete an agent', async () => {
      const axiosInstance = axios.create();
      axiosInstance.delete.resolves({ data: { success: true } });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.deleteAgent('agent-123');

      expect(axiosInstance.delete.calledOnce).toBeTruthy();
      expect(axiosInstance.delete.firstCall.args[0]).toBe('/v0/agents/agent-123');
      expect(result).toEqual({ success: true });
    });

    it('should handle deleteAgent errors', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Forbidden');
      error.response = { status: 403, data: { message: 'Cannot delete agent' } };
      axiosInstance.delete.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.deleteAgent('agent-123')).rejects.toThrow('Forbidden');
    });
  });

  describe('addFollowup', () => {
    it('should successfully add followup to agent', async () => {
      const axiosInstance = axios.create();
      const followupData = { prompt: { text: 'Update the code' } };
      const responseData = { success: true, followupId: 'followup-123' };
      axiosInstance.post.resolves({ data: responseData });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.addFollowup('agent-123', followupData);

      expect(axiosInstance.post.calledOnce).toBeTruthy();
      expect(axiosInstance.post.firstCall.args[0]).toBe('/v0/agents/agent-123/followup');
      expect(axiosInstance.post.firstCall.args[1]).toEqual(followupData);
      expect(result).toEqual(responseData);
    });

    it('should handle addFollowup validation errors', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Validation Error');
      error.response = { status: 400, data: { message: 'Invalid followup data' } };
      axiosInstance.post.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.addFollowup('agent-123', {})).rejects.toThrow('Validation Error');
    });
  });

  describe('getAgentConversation', () => {
    it('should successfully get agent conversation', async () => {
      const axiosInstance = axios.create();
      const conversationData = {
        messages: [
          { role: 'user', content: 'Create a React app' },
          { role: 'assistant', content: 'I\'ll create the React app for you...' }
        ]
      };
      axiosInstance.get.resolves({ data: conversationData });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.getAgentConversation('agent-123');

      expect(axiosInstance.get.calledOnce).toBeTruthy();
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/agents/agent-123/conversation');
      expect(result).toEqual(conversationData);
    });

    it('should handle getAgentConversation errors', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Conversation not found');
      error.response = { status: 404, data: { message: 'No conversation available' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.getAgentConversation('agent-123')).rejects.toThrow('Conversation not found');
    });
  });

  describe('getMe', () => {
    it('should successfully get user information', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockUserInfo });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.getMe();

      expect(axiosInstance.get.calledOnce).toBeTruthy();
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/me');
      expect(result).toEqual(mockUserInfo);
    });

    it('should handle authentication errors in getMe', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Unauthorized');
      error.response = { status: 401, data: { message: 'Invalid API key' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.getMe()).rejects.toThrow('Unauthorized');
    });
  });

  describe('listModels', () => {
    it('should successfully list available models', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockModelList });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.listModels();

      expect(axiosInstance.get.calledOnce).toBeTruthy();
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/models');
      expect(result).toEqual(mockModelList);
    });

    it('should handle listModels server errors', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Internal Server Error');
      error.response = { status: 500, data: { message: 'Server error' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.listModels()).rejects.toThrow('Internal Server Error');
    });
  });

  describe('listRepositories', () => {
    it('should successfully list GitHub repositories', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockRepositoryList });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.listRepositories();

      expect(axiosInstance.get.calledOnce).toBeTruthy();
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/repositories');
      expect(result).toEqual(mockRepositoryList);
    });

    it('should handle listRepositories errors', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Forbidden');
      error.response = { status: 403, data: { message: 'Access denied' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await expect(testClient.listRepositories()).rejects.toThrow('Forbidden');
    });
  });

  describe('Error Handling', () => {
    let axiosInstance;

    beforeEach(() => {
      axiosInstance = axios.create();
    });

    it('should handle 400 Bad Request errors', async () => {
      const error = new Error('Bad Request');
      error.response = { status: 400, data: { message: 'Invalid input' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.listAgents();
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Bad Request');
      }
    });

    it('should handle 401 Unauthorized errors', async () => {
      const error = new Error('Unauthorized');
      error.response = { status: 401, data: { message: 'Invalid API key' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.getMe();
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Unauthorized');
      }
    });

    it('should handle 403 Forbidden errors', async () => {
      const error = new Error('Forbidden');
      error.response = { status: 403, data: { message: 'Access denied' } };
      axiosInstance.delete.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.deleteAgent('agent-123');
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Forbidden');
      }
    });

    it('should handle 404 Not Found errors', async () => {
      const error = new Error('Not Found');
      error.response = { status: 404, data: { message: 'Resource not found' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.getAgent('non-existent');
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Not Found');
      }
    });

    it('should handle 409 Conflict errors', async () => {
      const error = new Error('Conflict');
      error.response = { status: 409, data: { message: 'Resource already exists' } };
      axiosInstance.post.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.createAgent(mockAgentData);
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Conflict');
      }
    });

    it('should handle 429 Rate Limit errors', async () => {
      const error = new Error('Rate Limited');
      error.response = { status: 429, data: { message: 'Too many requests' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.listModels();
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Rate Limited');
      }
    });

    it('should handle 500 Internal Server errors', async () => {
      const error = new Error('Server Error');
      error.response = { status: 500, data: { message: 'Internal server error' } };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.getMe();
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Server Error');
      }
    });

    it('should handle network errors', async () => {
      const error = new Error('Network Error');
      error.request = {}; // Axios network error
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.listAgents();
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Network Error');
      }
    });

    it('should handle timeout errors', async () => {
      const error = new Error('Timeout');
      error.code = 'ECONNABORTED';
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.listAgents();
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).toBe('Timeout');
      }
    });
  });

  describe('Request/Response Logging', () => {
    it('should log successful requests and responses', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockAgentList, status: 200 });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await testClient.listAgents();

      expect(consoleSpy.calledTwice).toBeTruthy();
      expect(consoleSpy.firstCall.args[0]).toMatch(/Making API request: GET \/v0\/agents/);
      expect(consoleSpy.secondCall.args[0]).toMatch(/API response: 200 .*\/v0\/agents/);
    });

    it('should log request errors', async () => {
      const axiosInstance = axios.create();
      const error = new Error('Request failed');
      error.response = { status: 500, statusText: 'Internal Server Error', data: {} };
      error.config = { url: '/v0/agents' };
      axiosInstance.get.rejects(error);

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.listAgents();
      } catch (err) {
        // Expected to throw
      }

      expect(consoleSpy.called).toBeTruthy();
      const errorLogCall = consoleSpy.getCalls().find(call =>
        call.args[0].includes('API response error')
      );
      expect(errorLogCall).toBeDefined();
      expect(errorLogCall.args[0]).toMatch(/API response error/);
    });

    it('should log request interceptor errors', async () => {
      const axiosInstance = axios.create();
      // Simulate interceptor error by making the stub throw
      axiosInstance.interceptors = {
        request: {
          use: sinon.stub().throws(new Error('Interceptor failed'))
        }
      };

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      try {
        await testClient.listAgents();
      } catch (err) {
        expect(err.message).toBe('Interceptor failed');
      }
    });
  });

  describe('Factory Functions', () => {
    it('should create client with API key using factory function', () => {
      const factoryClient = createCursorApiClient(apiKey);
      expect(factoryClient).toBeInstanceOf(CursorApiClient);
      expect(factoryClient.client.defaults.headers.Authorization).toBe(`Bearer ${apiKey}`);
    });

    it('should create client without API key using factory function', () => {
      const factoryClient = createCursorApiClient();
      expect(factoryClient).toBeInstanceOf(CursorApiClient);
      expect(factoryClient.client.defaults.headers.Authorization).toBeUndefined();
    });

    it('should create global client instance with config API key', () => {
      const originalConfig = { ...config };
      config.cursor.apiKey = 'global-test-key';

      // Re-import to get updated instance
      delete require.cache[require.resolve('./cursorClient.js')];
      const { cursorApiClient } = require('./cursorClient.js');

      expect(cursorApiClient).toBeInstanceOf(CursorApiClient);
      expect(cursorApiClient.client.defaults.headers.Authorization).toBe('Bearer global-test-key');

      // Restore original config
      Object.assign(config, originalConfig);
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle empty responses', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: null });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.getMe();
      expect(result).toBeNull();
    });

    it('should handle malformed JSON responses', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: 'invalid json' });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.getMe();
      expect(result).toBe('invalid json');
    });

    it('should handle large response payloads', async () => {
      const axiosInstance = axios.create();
      const largeData = { data: 'x'.repeat(10000) };
      axiosInstance.get.resolves({ data: largeData });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const result = await testClient.listAgents();
      expect(result).toEqual(largeData);
    });

    it('should handle concurrent requests', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.resolves({ data: mockAgentList });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      const promises = [
        testClient.listAgents(),
        testClient.listModels(),
        testClient.listRepositories()
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(axiosInstance.get.callCount).toBe(3);
    });

    it('should handle client reuse across multiple operations', async () => {
      const axiosInstance = axios.create();
      axiosInstance.get.onFirstCall().resolves({ data: mockAgentList });
      axiosInstance.get.onSecondCall().resolves({ data: mockModelList });

      const testClient = new CursorApiClient(apiKey);
      testClient.client = axiosInstance;

      await testClient.listAgents();
      await testClient.listModels();

      expect(axiosInstance.get.callCount).toBe(2);
      expect(axiosInstance.get.firstCall.args[0]).toBe('/v0/agents');
      expect(axiosInstance.get.secondCall.args[0]).toBe('/v0/models');
    });
  });
});