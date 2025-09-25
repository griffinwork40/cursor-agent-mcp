import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import components
import { config } from '../config/index.js';
import { createCursorApiClient } from '../utils/cursorClient.js';
import { createTools } from '../tools/index.js';

// Create a test application instance
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
    next();
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

  // MCP protocol endpoint
  app.post('/mcp', async (req, res) => {
    try {
      console.log('MCP Request:', JSON.stringify(req.body, null, 2));

      const { method, params, id } = req.body;

      let result;

      switch (method) {
        case 'tools/list':
          {
            const tools = getToolsForRequest(req);
            result = {
              tools: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              })),
            };
          }
          break;

        case 'tools/call':
          {
            const tools = getToolsForRequest(req);
            const tool = tools.find(t => t.name === params.name);
            if (!tool) {
              throw new Error(`Tool ${params.name} not found`);
            }
            result = await tool.handler(params.arguments || {});
          }
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      const response = {
        jsonrpc: '2.0',
        id,
        result,
      };

      console.log('MCP Response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      const errorResponse = {
        jsonrpc: '2.0',
        id: req.body.id,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
          data: error.stack,
        },
      };
      res.status(500).json(errorResponse);
    }
  });

  return app;
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
  },
  {
    id: 'agent_456',
    name: 'Test Agent 2',
    status: 'RUNNING',
    createdAt: '2024-01-02T00:00:00Z',
    source: { repository: 'https://github.com/test/repo2' },
    target: { url: 'https://github.com/test/repo2/pull/2', branchName: 'feature/test2' },
    summary: 'Currently running'
  },
  {
    id: 'agent_789',
    name: 'Test Agent 3',
    status: 'ERROR',
    createdAt: '2024-01-03T00:00:00Z',
    source: { repository: 'https://github.com/test/repo3' },
    target: { url: 'https://github.com/test/repo3/pull/3', branchName: 'feature/test3' },
    summary: 'Error occurred'
  }
];

const mockModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'];
const mockRepositories = [
  { name: 'repo1', owner: 'test', repository: 'https://github.com/test/repo1' },
  { name: 'repo2', owner: 'test', repository: 'https://github.com/test/repo2' },
  { name: 'repo3', owner: 'test', repository: 'https://github.com/test/repo3' }
];

const mockAgentConversations = [
  {
    id: 'agent_123',
    messages: [
      {
        type: 'user_message',
        text: 'Create a new feature for user authentication',
        timestamp: '2024-01-01T00:00:00Z'
      },
      {
        type: 'assistant_message',
        text: 'I understand you want to create a user authentication feature. Let me start working on this...',
        timestamp: '2024-01-01T00:01:00Z'
      }
    ]
  }
];

describe('Tool Execution Chain Integration Tests', () => {
  let app;
  let mock;

  beforeEach(() => {
    app = createTestApp();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
    jest.clearAllMocks();
  });

  describe('Complete Tool Execution Chains', () => {
    beforeEach(() => {
      // Setup common mocks for all tool execution tests
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });
    });

    test('should execute complete createAgent -> getAgent -> addFollowup -> getAgent chain', async () => {
      // Step 1: Create agent
      const mockNewAgent = {
        id: 'chain_test_agent',
        name: 'Chain Test Agent',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/chain-repo' },
        target: { url: 'https://github.com/test/chain-repo/pull/4', branchName: 'feature/chain' },
        summary: 'Creating agent...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const createResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a user authentication system' },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/chain-repo' },
              target: { autoCreatePr: true, branchName: 'feature/auth' }
            }
          },
          id: 'chain-test-1'
        })
        .expect(200);

      expect(createResponse.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'chain-test-1'
      });
      expect(createResponse.body.result.content[0].text).toContain('Successfully created agent');
      expect(createResponse.body.result.content[0].text).toContain('chain_test_agent');

      // Step 2: Get agent (mock as running)
      const mockRunningAgent = { ...mockNewAgent, status: 'RUNNING', summary: 'Working on authentication...' };
      mock.onGet('/v0/agents/chain_test_agent').reply(200, mockRunningAgent);

      const getResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'getAgent',
            arguments: { id: 'chain_test_agent' }
          },
          id: 'chain-test-2'
        })
        .expect(200);

      expect(getResponse.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'chain-test-2'
      });
      expect(getResponse.body.result.content[0].text).toContain('Chain Test Agent');
      expect(getResponse.body.result.content[0].text).toContain('RUNNING');

      // Step 3: Add followup
      const mockFollowupResponse = { ...mockRunningAgent, summary: 'Added followup instruction' };
      mock.onPost('/v0/agents/chain_test_agent/followup').reply(200, mockFollowupResponse);

      const followupResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'addFollowup',
            arguments: {
              id: 'chain_test_agent',
              prompt: { text: 'Add email verification to the authentication system' }
            }
          },
          id: 'chain-test-3'
        })
        .expect(200);

      expect(followupResponse.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'chain-test-3'
      });
      expect(followupResponse.body.result.content[0].text).toContain('Successfully added followup');

      // Step 4: Get agent again to verify followup was added
      mock.onGet('/v0/agents/chain_test_agent').reply(200, mockFollowupResponse);

      const getAfterFollowupResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'getAgent',
            arguments: { id: 'chain_test_agent' }
          },
          id: 'chain-test-4'
        })
        .expect(200);

      expect(getAfterFollowupResponse.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'chain-test-4'
      });
      expect(getAfterFollowupResponse.body.result.content[0].text).toContain('Chain Test Agent');
    });

    test('should execute complete agent management chain with error handling', async () => {
      // Step 1: Create agent successfully
      const mockNewAgent = {
        id: 'error_chain_agent',
        name: 'Error Chain Agent',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/error-chain-repo' },
        target: { url: 'https://github.com/test/error-chain-repo/pull/5', branchName: 'feature/error' },
        summary: 'Creating agent...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const createResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a buggy feature' },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/error-chain-repo' }
            }
          },
          id: 'error-chain-1'
        })
        .expect(200);

      expect(createResponse.body.result.content[0].text).toContain('Successfully created agent');

      // Step 2: Get agent (now in error state)
      const mockErrorAgent = { ...mockNewAgent, status: 'ERROR', summary: 'Error occurred during execution' };
      mock.onGet('/v0/agents/error_chain_agent').reply(200, mockErrorAgent);

      const getErrorResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'getAgent',
            arguments: { id: 'error_chain_agent' }
          },
          id: 'error-chain-2'
        })
        .expect(200);

      expect(getErrorResponse.body.result.content[0].text).toContain('ERROR');
      expect(getErrorResponse.body.result.content[0].text).toContain('Error occurred');

      // Step 3: Try to add followup (should succeed even with error state)
      const mockFollowupResponse = { ...mockErrorAgent, summary: 'Added followup despite error' };
      mock.onPost('/v0/agents/error_chain_agent/followup').reply(200, mockFollowupResponse);

      const followupResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'addFollowup',
            arguments: {
              id: 'error_chain_agent',
              prompt: { text: 'Fix the error in the buggy feature' }
            }
          },
          id: 'error-chain-3'
        })
        .expect(200);

      expect(followupResponse.body.result.content[0].text).toContain('Successfully added followup');

      // Step 4: Get conversation to see all messages
      mock.onGet('/v0/agents/error_chain_agent/conversation').reply(200, mockAgentConversations[0]);

      const conversationResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'getAgentConversation',
            arguments: { id: 'error_chain_agent' }
          },
          id: 'error-chain-4'
        })
        .expect(200);

      expect(conversationResponse.body.result.content[0].text).toContain('Agent Conversation');
      expect(conversationResponse.body.result.content[0].text).toContain('2 messages');
    });

    test('should execute complete agent lifecycle with deletion', async () => {
      // Step 1: List agents
      const listResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'listAgents',
            arguments: { limit: 10 }
          },
          id: 'lifecycle-1'
        })
        .expect(200);

      expect(listResponse.body.result.content[0].text).toContain('Found 3 agent(s)');

      // Step 2: Create a new agent for deletion test
      const mockNewAgent = {
        id: 'delete_test_agent',
        name: 'Delete Test Agent',
        status: 'FINISHED',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/delete-repo' },
        target: { url: 'https://github.com/test/delete-repo/pull/6', branchName: 'feature/delete' },
        summary: 'Ready for deletion'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);
      mock.onGet('/v0/agents').reply(200, { agents: [...mockAgents, mockNewAgent] });

      const createResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a feature that will be deleted' },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/delete-repo' }
            }
          },
          id: 'lifecycle-2'
        })
        .expect(200);

      expect(createResponse.body.result.content[0].text).toContain('Successfully created agent');

      // Step 3: Verify agent was added to list
      const listAfterCreateResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'listAgents',
            arguments: { limit: 10 }
          },
          id: 'lifecycle-3'
        })
        .expect(200);

      expect(listAfterCreateResponse.body.result.content[0].text).toContain('Found 4 agent(s)');

      // Step 4: Delete the agent
      mock.onDelete('/v0/agents/delete_test_agent').reply(200, { id: 'delete_test_agent' });

      const deleteResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'deleteAgent',
            arguments: { id: 'delete_test_agent' }
          },
          id: 'lifecycle-4'
        })
        .expect(200);

      expect(deleteResponse.body.result.content[0].text).toContain('Successfully deleted agent');
      expect(deleteResponse.body.result.content[0].text).toContain('delete_test_agent');

      // Step 5: Verify agent was removed from list
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents }); // Back to original 3 agents

      const listAfterDeleteResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'listAgents',
            arguments: { limit: 10 }
          },
          id: 'lifecycle-5'
        })
        .expect(200);

      expect(listAfterDeleteResponse.body.result.content[0].text).toContain('Found 3 agent(s)');
    });
  });

  describe('Complex Tool Interaction Chains', () => {
    beforeEach(() => {
      // Setup comprehensive mocks for complex chains
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });
    });

    test('should execute createAgent with image prompt and webhook', async () => {
      const mockNewAgent = {
        id: 'image_webhook_agent',
        name: 'Image Webhook Agent',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/image-repo' },
        target: { url: 'https://github.com/test/image-repo/pull/7', branchName: 'feature/image' },
        summary: 'Creating agent with image prompt...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: {
                text: 'Create a UI component based on the provided design',
                images: [{
                  data: 'base64_encoded_image_data',
                  dimension: { width: 800, height: 600 }
                }]
              },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/image-repo' },
              target: { autoCreatePr: true, branchName: 'feature/ui-component' },
              webhook: {
                url: 'https://example.com/webhook',
                secret: 'super_secret_webhook_key_12345678901234567890'
              }
            }
          },
          id: 'complex-1'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'complex-1'
      });
      expect(response.body.result.content[0].text).toContain('Successfully created agent');
      expect(response.body.result.content[0].text).toContain('image_webhook_agent');
    });

    test('should handle multiple agent operations concurrently', async () => {
      const mockNewAgent1 = {
        id: 'concurrent_agent_1',
        name: 'Concurrent Agent 1',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/concurrent-repo-1' },
        target: { url: 'https://github.com/test/concurrent-repo-1/pull/8', branchName: 'feature/concurrent-1' },
        summary: 'Creating concurrent agent 1...'
      };

      const mockNewAgent2 = {
        id: 'concurrent_agent_2',
        name: 'Concurrent Agent 2',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/concurrent-repo-2' },
        target: { url: 'https://github.com/test/concurrent-repo-2/pull/9', branchName: 'feature/concurrent-2' },
        summary: 'Creating concurrent agent 2...'
      };

      // Mock concurrent API calls
      mock.onPost('/v0/agents').replyOnce(200, mockNewAgent1).onPost('/v0/agents').replyOnce(200, mockNewAgent2);

      // Execute concurrent requests
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/mcp')
          .send({
            method: 'tools/call',
            params: {
              name: 'createAgent',
              arguments: {
                prompt: { text: 'Create feature 1' },
                model: 'gpt-4',
                source: { repository: 'https://github.com/test/concurrent-repo-1' }
              }
            },
            id: 'concurrent-1'
          }),
        request(app)
          .post('/mcp')
          .send({
            method: 'tools/call',
            params: {
              name: 'createAgent',
              arguments: {
                prompt: { text: 'Create feature 2' },
                model: 'gpt-4',
                source: { repository: 'https://github.com/test/concurrent-repo-2' }
              }
            },
            id: 'concurrent-2'
          })
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      expect(response1.body.result.content[0].text).toContain('Successfully created agent');
      expect(response1.body.result.content[0].text).toContain('concurrent_agent_1');

      expect(response2.body.result.content[0].text).toContain('Successfully created agent');
      expect(response2.body.result.content[0].text).toContain('concurrent_agent_2');
    });
  });

  describe('Error Propagation Through Chains', () => {
    test('should propagate validation errors through tool chain', async () => {
      // Create agent with invalid data
      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: '' }, // Invalid empty prompt
              model: 'invalid-model', // Invalid model
              source: { repository: '' } // Invalid empty repository
            }
          },
          id: 'error-propagation-1'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'error-propagation-1'
      });
      expect(response.body.result).toHaveProperty('isError', true);
      expect(response.body.result.content[0].text).toContain('Validation Error');
    });

    test('should handle API errors in the middle of execution chain', async () => {
      // Step 1: Create agent (succeeds)
      const mockNewAgent = {
        id: 'api_error_agent',
        name: 'API Error Agent',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/api-error-repo' },
        target: { url: 'https://github.com/test/api-error-repo/pull/10', branchName: 'feature/api-error' },
        summary: 'Creating agent...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const createResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a feature that will fail' },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/api-error-repo' }
            }
          },
          id: 'api-error-1'
        })
        .expect(200);

      expect(createResponse.body.result.content[0].text).toContain('Successfully created agent');

      // Step 2: Try to get agent (fails with API error)
      mock.onGet('/v0/agents/api_error_agent').reply(500, { error: 'Internal server error' });

      const getResponse = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'getAgent',
            arguments: { id: 'api_error_agent' }
          },
          id: 'api-error-2'
        })
        .expect(200);

      expect(getResponse.body.result).toHaveProperty('isError', true);
      expect(getResponse.body.result.content[0].text).toContain('API Error (500)');
    });

    test('should handle rate limiting in tool execution', async () => {
      // Mock rate limit error
      mock.onPost('/v0/agents').reply(429, {
        error: {
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        }
      });

      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a feature' },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/rate-limit-repo' }
            }
          },
          id: 'rate-limit-1'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'rate-limit-1'
      });
      expect(response.body.result).toHaveProperty('isError', true);
      expect(response.body.result.content[0].text).toContain('API Error (429)');
      expect(response.body.result.content[0].text).toContain('Too many requests');
    });
  });

  describe('Edge Cases in Tool Execution', () => {
    beforeEach(() => {
      // Setup mocks for edge case tests
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });
    });

    test('should handle very large prompt text', async () => {
      const largePrompt = 'A'.repeat(50000); // Very large prompt
      const mockNewAgent = {
        id: 'large_prompt_agent',
        name: 'Large Prompt Agent',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/large-prompt-repo' },
        target: { url: 'https://github.com/test/large-prompt-repo/pull/11', branchName: 'feature/large' },
        summary: 'Creating agent with large prompt...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: largePrompt },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/large-prompt-repo' }
            }
          },
          id: 'edge-case-1'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'edge-case-1'
      });
      expect(response.body.result.content[0].text).toContain('Successfully created agent');
    });

    test('should handle special characters in tool arguments', async () => {
      const specialPrompt = 'Create a feature with "quotes", \'apostrophes\', \n newlines, \t tabs, and émojis 🚀📝✨';
      const mockNewAgent = {
        id: 'special_chars_agent',
        name: 'Special Chars Agent',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/special-chars-repo' },
        target: { url: 'https://github.com/test/special-chars-repo/pull/12', branchName: 'feature/special' },
        summary: 'Creating agent with special characters...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: specialPrompt },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/special-chars-repo' }
            }
          },
          id: 'edge-case-2'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'edge-case-2'
      });
      expect(response.body.result.content[0].text).toContain('Successfully created agent');
    });

    test('should handle empty arrays and objects in tool arguments', async () => {
      const mockNewAgent = {
        id: 'empty_data_agent',
        name: 'Empty Data Agent',
        status: 'CREATING',
        createdAt: '2024-01-04T00:00:00Z',
        source: { repository: 'https://github.com/test/empty-data-repo' },
        target: { url: 'https://github.com/test/empty-data-repo/pull/13', branchName: 'feature/empty' },
        summary: 'Creating agent with empty data...'
      };

      mock.onPost('/v0/agents').reply(200, mockNewAgent);

      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a feature', images: [] }, // Empty images array
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/empty-data-repo' },
              target: {} // Empty target object
            }
          },
          id: 'edge-case-3'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'edge-case-3'
      });
      expect(response.body.result.content[0].text).toContain('Successfully created agent');
    });

    test('should handle malformed JSON in nested objects', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/call',
          params: {
            name: 'createAgent',
            arguments: {
              prompt: { text: 'Create a feature' },
              model: 'gpt-4',
              source: { repository: 'https://github.com/test/malformed-repo' },
              webhook: {
                url: 'https://example.com/webhook',
                secret: '' // Empty secret - should trigger validation error
              }
            }
          },
          id: 'edge-case-4'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'edge-case-4'
      });
      expect(response.body.result).toHaveProperty('isError', true);
      expect(response.body.result.content[0].text).toContain('Validation Error');
    });
  });
});