/**
 * Integration Tests for MCP Server
 *
 * Tests the MCP server endpoints and functionality
 */

import supertest from 'supertest';
import { createServer } from 'http';
import { createCursorApiClient } from '../../src/utils/cursorClient.js';
import { mockHttp, mockData } from '../utils/test-helpers.js';

// Mock the cursor client
jest.mock('../../src/utils/cursorClient.js', () => ({
  createCursorApiClient: jest.fn(),
  cursorApiClient: {
    createAgent: jest.fn(),
    listAgents: jest.fn(),
    getAgent: jest.fn(),
    deleteAgent: jest.fn(),
    addFollowup: jest.fn(),
    getAgentConversation: jest.fn(),
    getMe: jest.fn(),
    listModels: jest.fn(),
    listRepositories: jest.fn()
  }
}));

// Use the real tools module so validation and formatting are exercised end-to-end

describe('MCP Server Integration Tests', () => {
  let server;
  let request;
  let mockAgentData;
  let mockUserData;
  let mockModelsData;
  let createMCPServer;

  beforeEach(async () => {
    // Clean up any existing mocks
    mockHttp.cleanAll();
    jest.clearAllMocks();

    // Set up mock data
    mockAgentData = mockData.generateAgent();
    mockUserData = mockData.generateUser();
    mockModelsData = { models: [mockData.generateModel()] };

    // Mock the API client methods
    const { cursorApiClient } = require('../../src/utils/cursorClient.js');
    cursorApiClient.createAgent.mockResolvedValue(mockAgentData);
    cursorApiClient.listAgents.mockResolvedValue({ agents: [mockAgentData] });
    cursorApiClient.getAgent.mockResolvedValue(mockAgentData);
    cursorApiClient.deleteAgent.mockResolvedValue({ message: 'Agent deleted' });
    cursorApiClient.addFollowup.mockResolvedValue({ id: 'followup-123' });
    cursorApiClient.getAgentConversation.mockResolvedValue({ messages: [] });
    cursorApiClient.getMe.mockResolvedValue(mockUserData);
    cursorApiClient.listModels.mockResolvedValue(mockModelsData);
    cursorApiClient.listRepositories.mockResolvedValue({ repositories: [] });

    // Import the server after mocking
    ({ createMCPServer } = await import('../../src/mcp-server.js'));

    // Create a test server
    server = createServer(async (req, res) => {
      if (req.url === '/mcp' && req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());

        try {
          const response = await createMCPServer().handleRequest(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: error.message },
            id: body.id
          }));
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    request = supertest(server);
  });

  afterEach(() => {
    mockHttp.cleanAll();
    if (server) {
      server.close();
    }
  });

  describe('MCP Protocol Compliance', () => {
    test('should handle tools/list request', async () => {
      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('tools');
      expect(Array.isArray(response.body.result.tools)).toBe(true);
      expect(response.body.result.tools.length).toBeGreaterThan(0);

      const createAgentTool = response.body.result.tools.find(tool => tool.name === 'createAgent');
      expect(createAgentTool).toBeDefined();
      expect(createAgentTool).toHaveProperty('description');
      expect(createAgentTool).toHaveProperty('inputSchema');
    });

    test('should handle tools/call - createAgent', async () => {
      const { cursorApiClient } = require('../../src/utils/cursorClient.js');

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: {
                text: 'Create a README file'
              },
              source: {
                repository: 'https://github.com/test/repo'
              },
              model: 'claude-3-5-sonnet'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('content');
      expect(Array.isArray(response.body.result.content)).toBe(true);

      expect(cursorApiClient.createAgent).toHaveBeenCalledWith({
        prompt: {
          text: 'Create a README file'
        },
        source: {
          repository: 'https://github.com/test/repo'
        },
        model: 'claude-3-5-sonnet'
      });
    });

    test('should handle tools/call - listAgents', async () => {
      const { cursorApiClient } = require('../../src/utils/cursorClient.js');

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'listAgents',
            arguments: {
              limit: 5
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('content');

      expect(cursorApiClient.listAgents).toHaveBeenCalledWith({ limit: 5 });
    });

    test('should handle tools/call - getMe', async () => {
      const { cursorApiClient } = require('../../src/utils/cursorClient.js');

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'getMe',
            arguments: {}
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('content');

      expect(cursorApiClient.getMe).toHaveBeenCalledWith();
    });

    test('should handle tools/call - listModels', async () => {
      const { cursorApiClient } = require('../../src/utils/cursorClient.js');

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'listModels',
            arguments: {}
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('content');

      expect(cursorApiClient.listModels).toHaveBeenCalledWith();
    });

    test('should handle tools/call - listRepositories', async () => {
      const { cursorApiClient } = require('../../src/utils/cursorClient.js');

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'listRepositories',
            arguments: {}
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('content');

      expect(cursorApiClient.listRepositories).toHaveBeenCalledWith();
    });

    test('should handle tools/call with validation errors', async () => {
      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: {
                text: '' // Empty text should fail validation
              },
              source: {
                repository: 'https://github.com/test/repo'
              }
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('should handle unknown tool names', async () => {
      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: {
            name: 'nonExistentTool',
            arguments: {}
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error.message).toContain('Tool nonExistentTool not found');
    });

    test('should handle malformed JSON-RPC requests', async () => {
      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 9,
          method: 'invalid/method',
          params: {}
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle missing required parameters', async () => {
      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: {
                text: 'Create a README'
              }
              // Missing required 'source' parameter
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    test('should handle API client errors gracefully', async () => {
      const { cursorApiClient } = require('../../src/utils/cursorClient.js');
      cursorApiClient.createAgent.mockRejectedValue(new Error('API Error'));

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: {
                text: 'Create a README'
              },
              source: {
                repository: 'https://github.com/test/repo'
              }
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('should handle network timeouts', async () => {
      const { cursorApiClient } = require('../../src/utils/cursorClient.js');
      cursorApiClient.createAgent.mockRejectedValue(new Error('Timeout'));

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: {
                text: 'Create a README'
              },
              source: {
                repository: 'https://github.com/test/repo'
              }
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent requests', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          request
            .post('/mcp')
            .send({
              jsonrpc: '2.0',
              id: i + 13,
              method: 'tools/list',
              params: {}
            })
        );
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('result');
        expect(response.body.result).toHaveProperty('tools');
      });
    });

    test('should handle large payloads', async () => {
      const largePrompt = 'A'.repeat(10000); // 10KB prompt

      const response = await request
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          id: 18,
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: {
                text: largePrompt
              },
              source: {
                repository: 'https://github.com/test/repo'
              }
            }
          }
        });

      expect(response.status).toBe(200);
      // Should either succeed or fail gracefully, not crash
      expect(['result', 'error']).toContain(Object.keys(response.body)[0]);
    });
  });
});