import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Import components
import { config } from '../config/index.js';
import { createCursorApiClient } from '../utils/cursorClient.js';
import { createTools } from '../tools/index.js';

// Create a test application with SSE support
const createTestAppWithSSE = () => {
  const app = express();
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
    });
  });

  // Helper to extract Cursor API key from request
  const extractApiKey = (req) => {
    const token = req.query?.token || req.headers['x-mcp-token'];
    if (token) {
      return token.startsWith('mock_') ? token : 'mock_api_key';
    }
    return req.headers['x-cursor-api-key'] || req.headers['x-api-key'] || 'mock_api_key';
  };

  // Lazily create tools per request using provided API key
  const getToolsForRequest = (req) => {
    const apiKey = extractApiKey(req);
    const client = createCursorApiClient(apiKey);
    return createTools(client);
  };

  // Create MCP Server for SSE
  const mcpServer = new Server(
    {
      name: 'cursor-background-agents',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Setup MCP handlers
  mcpServer.setRequestHandler(ListToolsRequestSchema, async (request, context) => {
    const req = context?.transport?.req;
    const apiKey = req ? extractApiKey(req) : 'mock_api_key';
    const client = createCursorApiClient(apiKey);
    const tools = createTools(client);
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request, context) => {
    const { name, arguments: args } = request.params;
    const req = context?.transport?.req;
    const apiKey = req ? extractApiKey(req) : 'mock_api_key';
    const client = createCursorApiClient(apiKey);
    const tools = createTools(client);
    const tool = tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    const result = await tool.handler(args || {});

    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  // SSE endpoint
  app.use('/sse', (req, res) => {
    console.log(`MCP SSE connection attempt from ${req.ip}`);

    try {
      const transport = new SSEServerTransport('/sse', res);
      // attach req for later header access in handlers
      transport.req = req;

      mcpServer.connect(transport).catch(error => {
        console.error('MCP SSE connection error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({error: error.message})}\n\n`);
        res.end();
      });
    } catch (error) {
      console.error('SSE setup error:', error);
      res.write(`event: error\ndata: ${JSON.stringify({error: error.message})}\n\n`);
      res.end();
    }
  });

  return { app, mcpServer };
};

// Mock data for testing
const mockAgents = [
  {
    id: 'agent_123',
    name: 'Test Agent 1',
    status: 'FINISHED',
    createdAt: '2024-01-01T00:00:00Z',
    source: { repository: 'https://github.com/test/repo1' },
    target: { url: 'https://github.com/test/repo1/pull/1', branchName: 'feature/test' },
    summary: 'Completed successfully'
  }
];

const mockModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'];
const mockRepositories = [
  { name: 'repo1', owner: 'test', repository: 'https://github.com/test/repo1' }
];

describe('MCP SSE Integration Tests', () => {
  let testAppData;
  let mock;

  beforeEach(() => {
    testAppData = createTestAppWithSSE();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
    jest.clearAllMocks();
  });

  describe('SSE Connection Setup', () => {
    test('should establish SSE connection successfully', async () => {
      // Mock successful API responses
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });

      const response = await request(testAppData.app)
        .get('/sse')
        .expect(200);

      // SSE should return 200 OK with appropriate headers
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    test('should handle connection errors gracefully', async () => {
      // Mock API failure during connection
      mock.onGet('/v0/agents').reply(500, { error: 'Internal server error' });

      const response = await request(testAppData.app)
        .get('/sse')
        .expect(200);

      // Should still return 200 but with error event
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    test('should handle API key from query parameter', async () => {
      mock.onGet('/v0/agents').reply(200, { agents: [] });

      const response = await request(testAppData.app)
        .get('/sse?token=mock_test_token_123')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    test('should handle API key from headers', async () => {
      mock.onGet('/v0/agents').reply(200, { agents: [] });

      const response = await request(testAppData.app)
        .get('/sse')
        .set('x-cursor-api-key', 'mock_header_key_456')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('SSE Message Handling', () => {
    test('should handle tools/list via SSE', async () => {
      // Mock successful API responses
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });

      // Make a POST request to send a message via SSE
      const response = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-test-123',
          method: 'tools/list',
          params: {}
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-test-123'
      });

      expect(response.body.result).toHaveProperty('tools');
      expect(Array.isArray(response.body.result.tools)).toBe(true);
      expect(response.body.result.tools.length).toBeGreaterThan(0);
    });

    test('should handle tools/call via SSE', async () => {
      // Mock successful API responses
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });

      const mockNewAgent = {
        id: 'new_agent_789',
        name: 'New Test Agent',
        status: 'CREATING',
        createdAt: '2024-01-03T00:00:00Z',
        source: { repository: 'https://github.com/test/new-repo' },
        target: { url: 'https://github.com/test/new-repo/pull/3', branchName: 'feature/new' },
        summary: 'Creating agent...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const response = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-test-456',
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a new feature' },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/new-repo' }
            }
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-test-456'
      });

      expect(response.body.result).toHaveProperty('content');
      expect(Array.isArray(response.body.result.content)).toBe(true);
    });

    test('should handle errors via SSE', async () => {
      const response = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-error-test-789',
          method: 'tools/call',
          params: {
            name: 'nonExistentTool',
            arguments: {}
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-error-test-789'
      });

      expect(response.body.result).toHaveProperty('content');
      expect(response.body.result.content[0].text).toContain('Tool nonExistentTool not found');
      expect(response.body.result).toHaveProperty('isError', true);
    });

    test('should handle validation errors via SSE', async () => {
      const response = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-validation-test-101',
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: '' }, // Invalid empty prompt
              source: { repository: '' } // Invalid empty repository
            }
          }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-validation-test-101'
      });

      expect(response.body.result).toHaveProperty('content');
      expect(response.body.result.content[0].text).toContain('Validation Error');
      expect(response.body.result).toHaveProperty('isError', true);
    });
  });

  describe('SSE Connection Persistence', () => {
    test('should maintain connection for multiple messages', async () => {
      // Mock successful API responses
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });

      // Send first message
      const response1 = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-persistence-1',
          method: 'tools/list',
          params: {}
        })
        .expect(200);

      expect(response1.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-persistence-1'
      });

      // Send second message
      const response2 = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-persistence-2',
          method: 'tools/call',
          params: {
            name: 'listAgents',
            arguments: { limit: 5 }
          }
        })
        .expect(200);

      expect(response2.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-persistence-2'
      });

      expect(response1.body.result.tools.length).toBeGreaterThan(0);
      expect(response2.body.result.content[0].text).toContain('Found');
    });

    test('should handle concurrent SSE connections', async () => {
      // Mock successful API responses
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });

      // Make concurrent requests
      const [response1, response2] = await Promise.all([
        request(testAppData.app)
          .post('/sse')
          .send({
            jsonrpc: '2.0',
            id: 'concurrent-1',
            method: 'tools/list',
            params: {}
          }),
        request(testAppData.app)
          .post('/sse')
          .send({
            jsonrpc: '2.0',
            id: 'concurrent-2',
            method: 'tools/list',
            params: {}
          })
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      expect(response1.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'concurrent-1'
      });

      expect(response2.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'concurrent-2'
      });

      // Both should have the same tool list
      expect(response1.body.result.tools).toEqual(response2.body.result.tools);
    });
  });

  describe('SSE Error Recovery', () => {
    test('should handle API failures gracefully', async () => {
      // Mock API failure
      mock.onGet('/v0/agents').reply(500, { error: 'Internal server error' });

      const response = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-recovery-123',
          method: 'tools/list',
          params: {}
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-recovery-123'
      });

      // Should still return valid response structure
      expect(response.body.result).toHaveProperty('tools');
    });

    test('should handle network timeouts', async () => {
      // Mock network timeout
      mock.onGet('/v0/agents').timeout();

      const response = await request(testAppData.app)
        .post('/sse')
        .send({
          jsonrpc: '2.0',
          id: 'sse-timeout-456',
          method: 'tools/list',
          params: {}
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'sse-timeout-456'
      });

      expect(response.body.result).toHaveProperty('content');
      expect(response.body.result.content[0].text).toContain('Network Error');
      expect(response.body.result).toHaveProperty('isError', true);
    });
  });
});