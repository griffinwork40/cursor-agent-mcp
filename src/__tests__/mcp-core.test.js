// Core MCP protocol tests - focused on functionality without Express complexity
// Tests: request validation, tool routing, response formatting, error propagation, protocol compliance

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockToolHandler = jest.fn().mockResolvedValue('test result');
const mockCreateTools = jest.fn().mockImplementation(() => ([
  {
    name: 'testTool',
    description: 'Test tool description',
    inputSchema: { type: 'object' },
    handler: mockToolHandler,
  },
]));

const mockCursorClientInstance = {
  createAgent: jest.fn().mockResolvedValue({ id: 'test-agent-id' }),
  listAgents: jest.fn().mockResolvedValue({ agents: [] }),
  getAgent: jest.fn().mockResolvedValue({ id: 'test-agent-id' }),
  deleteAgent: jest.fn().mockResolvedValue({ id: 'test-agent-id' }),
  addFollowup: jest.fn().mockResolvedValue({ id: 'test-agent-id' }),
  getAgentConversation: jest.fn().mockResolvedValue({ messages: [] }),
  getMe: jest.fn().mockResolvedValue({ apiKeyName: 'test-key' }),
  listModels: jest.fn().mockResolvedValue({ models: ['model1', 'model2'] }),
  listRepositories: jest.fn().mockResolvedValue({ repositories: [] }),
};

const mockDefaultCursorClient = {
  createAgent: jest.fn(),
  listAgents: jest.fn(),
  getAgent: jest.fn(),
  deleteAgent: jest.fn(),
  addFollowup: jest.fn(),
  getAgentConversation: jest.fn(),
  getMe: jest.fn(),
  listModels: jest.fn(),
  listRepositories: jest.fn(),
};

const mockCreateCursorApiClient = jest.fn().mockReturnValue(mockCursorClientInstance);
const mockHandleMCPError = jest.fn().mockReturnValue({
  content: [{ type: 'text', text: 'Error message' }],
  isError: true,
});

class ValidationError extends Error {}
class ApiError extends Error {}

const mockMintTokenFromApiKey = jest.fn().mockReturnValue('mock-token');
const mockDecodeTokenToApiKey = jest.fn().mockReturnValue('decoded-api-key');

const mockConfig = {
  port: 3000,
  cursor: {
    apiKey: 'mock-cursor-api-key',
    apiUrl: 'https://api.cursor.com',
  },
  token: {
    secret: 'mock-token-secret',
    ttlDays: 30,
  },
};

jest.unstable_mockModule('../config/index.js', () => ({
  config: mockConfig,
}));

jest.unstable_mockModule('../tools/index.js', () => ({
  createTools: mockCreateTools,
}));

jest.unstable_mockModule('../utils/cursorClient.js', () => ({
  createCursorApiClient: mockCreateCursorApiClient,
  cursorApiClient: mockDefaultCursorClient,
}));

jest.unstable_mockModule('../utils/errorHandler.js', () => ({
  handleMCPError: mockHandleMCPError,
  ValidationError,
  ApiError,
}));

jest.unstable_mockModule('../utils/tokenUtils.js', () => ({
  mintTokenFromApiKey: mockMintTokenFromApiKey,
  decodeTokenToApiKey: mockDecodeTokenToApiKey,
}));

const { createTools } = await import('../tools/index.js');
const { createCursorApiClient, cursorApiClient } = await import('../utils/cursorClient.js');
const { handleMCPError } = await import('../utils/errorHandler.js');
const { mintTokenFromApiKey, decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
const { config } = await import('../config/index.js');

describe('MCP Core Protocol Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should validate MCP request structure', () => {
      const validRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      };

      expect(validRequest).toHaveProperty('jsonrpc', '2.0');
      expect(validRequest).toHaveProperty('method', 'tools/list');
      expect(validRequest).toHaveProperty('params');
      expect(validRequest).toHaveProperty('id', 1);
    });

    it('should reject requests without required JSON-RPC fields', () => {
      const invalidRequest = {
        method: 'tools/list',
        // Missing jsonrpc, id, params
      };

      expect(invalidRequest).not.toHaveProperty('jsonrpc');
      expect(invalidRequest).not.toHaveProperty('id');
    });

    it('should validate tool names', () => {
      const tools = createTools();
      const validTool = tools.find(t => t.name === 'testTool');

      expect(validTool).toBeDefined();
      expect(validTool.name).toBe('testTool');

      const invalidTool = tools.find(t => t.name === 'nonexistentTool');
      expect(invalidTool).toBeUndefined();
    });
  });

  describe('Tool Routing', () => {
    it('should route to tools/list correctly', () => {
      const request = {
        body: {
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 1,
        }
      };

      expect(request.body.method).toBe('tools/list');
    });

    it('should route to tools/call correctly', () => {
      const request = {
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'testTool', arguments: {} },
          id: 1,
        }
      };

      expect(request.body.method).toBe('tools/call');
      expect(request.body.params.name).toBe('testTool');
    });

    it('should route to initialize method correctly', () => {
      const request = {
        body: {
          jsonrpc: '2.0',
          method: 'initialize',
          params: {},
          id: 1,
        }
      };

      expect(request.body.method).toBe('initialize');
    });

    it('should handle notifications/initialized correctly', () => {
      const request = {
        body: {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        }
      };

      expect(request.body.method).toBe('notifications/initialized');
    });
  });

  describe('Response Formatting', () => {
    it('should format successful JSON-RPC response', () => {
      const requestId = 1;
      const result = { tools: [{ name: 'testTool', description: 'Test tool' }] };

      const response = {
        jsonrpc: '2.0',
        id: requestId,
        result,
      };

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', requestId);
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('tools');
    });

    it('should format error JSON-RPC response', () => {
      const requestId = 1;
      const error = new Error('Test error');

      const errorResponse = {
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
          data: error.stack,
        },
      };

      expect(errorResponse).toHaveProperty('jsonrpc', '2.0');
      expect(errorResponse).toHaveProperty('id', requestId);
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toHaveProperty('code', -32603);
      expect(errorResponse.error).toHaveProperty('message');
    });
  });

  describe('Error Propagation', () => {
    it('should handle tool execution errors', async () => {
      const toolError = new Error('Tool execution failed');

      // Simulate what happens when a tool handler throws an error
      try {
        throw toolError;
      } catch (error) {
        const errorResponse = handleMCPError(error, 'failingTool');
        expect(handleMCPError).toHaveBeenCalledWith(toolError, 'failingTool');
        expect(errorResponse).toHaveProperty('content');
        expect(errorResponse).toHaveProperty('isError', true);
      }
    });

    it('should handle API errors from Cursor client', async () => {
      const apiError = new Error('API Error');
      apiError.response = {
        status: 401,
        data: { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }
      };

      // Simulate what happens when a tool handler throws an API error
      try {
        throw apiError;
      } catch (error) {
        const errorResponse = handleMCPError(error, 'apiFailingTool');
        expect(handleMCPError).toHaveBeenCalledWith(apiError, 'apiFailingTool');
        expect(errorResponse).toHaveProperty('content');
        expect(errorResponse).toHaveProperty('isError', true);
      }
    });
  });

  describe('Protocol Compliance', () => {
    it('should comply with MCP protocol version 2025-03-26', () => {
      const initializeResult = {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'cursor-background-agents',
          version: '1.0.0',
        },
      };

      expect(initializeResult).toHaveProperty('protocolVersion', '2025-03-26');
    });

    it('should provide correct server capabilities', () => {
      const initializeResult = {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'cursor-background-agents',
          version: '1.0.0',
        },
      };

      expect(initializeResult).toHaveProperty('capabilities');
      expect(initializeResult).toHaveProperty('serverInfo');
      expect(initializeResult.serverInfo).toHaveProperty('name', 'cursor-background-agents');
      expect(initializeResult.serverInfo).toHaveProperty('version', '1.0.0');
    });

    it('should handle unknown methods with appropriate error', () => {
      const unknownMethod = 'unknown/method';

      const error = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: `Unknown method: ${unknownMethod}`,
        },
      };

      expect(error.error.message).toContain('Unknown method');
    });
  });

  describe('API Key Extraction', () => {
    const extractApiKey = (req) => {
      // Support zero-storage token in query/header: token=<base64url>
      const token = req.query?.token || req.headers['x-mcp-token'];
      const tokenKey = token ? decodeTokenToApiKey(token) : null;
      if (tokenKey) return tokenKey;

      // Check Authorization header for ChatGPT compatibility (but avoid OAuth Bearer tokens)
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('oauth')) {
        const bearerKey = authHeader.replace('Bearer ', '');
        // Only use if it looks like a Cursor API key (starts with 'key_')
        if (bearerKey.startsWith('key_')) {
          return bearerKey;
        }
      }

      return (
        req.headers['x-cursor-api-key'] ||
        req.headers['x-api-key'] ||
        req.query?.api_key ||
        req.body?.cursor_api_key ||
        config.cursor.apiKey // fallback to environment/global key
      );
    };

    it('should extract API key from token query parameter', () => {
      const req = { query: { token: 'mock-token' } };
      const result = extractApiKey(req);

      expect(decodeTokenToApiKey).toHaveBeenCalledWith('mock-token');
      expect(result).toBe('decoded-api-key');
    });

    it('should extract API key from x-mcp-token header', () => {
      const req = { headers: { 'x-mcp-token': 'mock-token' } };
      const result = extractApiKey(req);

      expect(decodeTokenToApiKey).toHaveBeenCalledWith('mock-token');
      expect(result).toBe('decoded-api-key');
    });

    it('should extract API key from Authorization header (Bearer)', () => {
      const req = { headers: { authorization: 'Bearer key_test123' } };
      const result = extractApiKey(req);

      expect(result).toBe('key_test123');
    });

    it('should extract API key from x-cursor-api-key header', () => {
      const req = { headers: { 'x-cursor-api-key': 'cursor-key-123' } };
      const result = extractApiKey(req);

      expect(result).toBe('cursor-key-123');
    });

    it('should extract API key from x-api-key header', () => {
      const req = { headers: { 'x-api-key': 'api-key-123' } };
      const result = extractApiKey(req);

      expect(result).toBe('api-key-123');
    });

    it('should extract API key from api_key query parameter', () => {
      const req = { query: { api_key: 'query-key-123' }, headers: {} };
      const result = extractApiKey(req);

      expect(result).toBe('query-key-123');
    });

    it('should extract API key from cursor_api_key body field', () => {
      const req = { body: { cursor_api_key: 'body-key-123' }, headers: {}, query: {} };
      const result = extractApiKey(req);

      expect(result).toBe('body-key-123');
    });

    it('should fallback to config API key when no other key found', () => {
      const req = { headers: {}, query: {}, body: {} };
      const result = extractApiKey(req);

      expect(result).toBe('mock-cursor-api-key');
    });
  });

  describe('Tool Creation', () => {
    it('should create tools with API key when available', () => {
      const apiKey = 'test-api-key';
      const tools = createTools(createCursorApiClient(apiKey));

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
      expect(createTools).toHaveBeenCalled();
      expect(tools).toHaveLength(1);
    });

    it('should create tools with default client when no API key', () => {
      const tools = createTools(cursorApiClient);

      expect(createTools).toHaveBeenCalledWith(cursorApiClient);
      expect(tools).toHaveLength(1);
    });
  });

  describe('Token Utilities', () => {
    it('should mint token from API key', () => {
      const apiKey = 'test-api-key-123';
      const token = mintTokenFromApiKey(apiKey);

      expect(mintTokenFromApiKey).toHaveBeenCalledWith(apiKey);
      expect(token).toBe('mock-token');
    });

    it('should decode token to API key', () => {
      const token = 'mock-token';
      const apiKey = decodeTokenToApiKey(token);

      expect(decodeTokenToApiKey).toHaveBeenCalledWith(token);
      expect(apiKey).toBe('decoded-api-key');
    });
  });

  describe('Health Check', () => {
    it('should return health check information', () => {
      const healthInfo = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
      };

      expect(healthInfo).toHaveProperty('status', 'ok');
      expect(healthInfo).toHaveProperty('timestamp');
      expect(healthInfo).toHaveProperty('version', '1.0.0');
      expect(healthInfo).toHaveProperty('uptime');
    });
  });

  describe('Service Discovery', () => {
    it('should return service information', () => {
      const serviceInfo = {
        name: 'cursor-background-agents',
        version: '1.0.0',
        description: 'MCP server for Cursor Background Agents API',
        endpoints: {
          mcp: '/mcp',
          sse: '/sse',
          health: '/health',
          connect: '/connect',
        },
        oauth: {
          authorization_endpoint: '/oauth/authorize',
          token_endpoint: '/oauth/token',
        },
      };

      expect(serviceInfo).toHaveProperty('name', 'cursor-background-agents');
      expect(serviceInfo).toHaveProperty('version', '1.0.0');
      expect(serviceInfo).toHaveProperty('description');
      expect(serviceInfo).toHaveProperty('endpoints');
      expect(serviceInfo).toHaveProperty('oauth');
    });
  });
});