import request from 'supertest';
import { app } from './index.js';
import { createCursorApiClient } from './utils/cursorClient.js';
import { mintTokenFromApiKey, decodeTokenToApiKey } from './utils/tokenUtils.js';

// Mock the Cursor API client
jest.mock('./utils/cursorClient.js', () => ({
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
    listRepositories: jest.fn(),
  },
}));

// Mock the tools module
jest.mock('./tools/index.js', () => ({
  createTools: jest.fn(() => [
    {
      name: 'testTool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: {} },
      handler: jest.fn().mockResolvedValue('Test result'),
    },
  ]),
}));

// Get the mocked functions
const { createTools } = require('./tools/index.js');

describe('Express server endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic endpoints', () => {
    test('GET /health returns ok payload', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.timestamp).toBe('string');
      expect(typeof res.body.uptime).toBe('number');
    });

    test('GET / returns discovery JSON', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'cursor-background-agents',
        endpoints: expect.objectContaining({ mcp: '/mcp', sse: '/sse', health: '/health' }),
      });
    });

    test('unknown route returns 404 JSON', async () => {
      const res = await request(app).get('/nope-not-found');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      });
    });

    test('GET /favicon.ico returns 204', async () => {
      const res = await request(app).get('/favicon.ico');
      expect(res.status).toBe(204);
    });
  });

  describe('MCP POST endpoints', () => {
    const mockApiKey = 'key_test123';
    const mockClient = {
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

    beforeEach(() => {
      createCursorApiClient.mockReturnValue(mockClient);
    });

    describe('/mcp endpoint', () => {
      test('handles tools/list request', async () => {
        const res = await request(app)
          .post('/mcp')
          .set('x-cursor-api-key', mockApiKey)
          .send({
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1,
          });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          jsonrpc: '2.0',
          id: 1,
          result: {
            tools: expect.arrayContaining([
              expect.objectContaining({
                name: 'testTool',
                description: 'A test tool',
              }),
            ]),
          },
        });
        expect(createCursorApiClient).toHaveBeenCalledWith(mockApiKey);
      });

      test('handles tools/call request', async () => {
        const res = await request(app)
          .post('/mcp')
          .set('x-cursor-api-key', mockApiKey)
          .send({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'testTool',
              arguments: { test: 'data' },
            },
            id: 1,
          });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          jsonrpc: '2.0',
          id: 1,
          result: 'Test result',
        });
      });

      test('handles unknown method', async () => {
        const res = await request(app)
          .post('/mcp')
          .send({
            jsonrpc: '2.0',
            method: 'unknown/method',
            id: 1,
          });

        expect(res.status).toBe(500);
        expect(res.body).toMatchObject({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32603,
            message: 'Unknown method: unknown/method',
          },
        });
      });

      test('handles tool not found', async () => {
        const res = await request(app)
          .post('/mcp')
          .send({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'nonexistentTool',
              arguments: {},
            },
            id: 1,
          });

        expect(res.status).toBe(500);
        expect(res.body).toMatchObject({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32603,
            message: 'Tool nonexistentTool not found',
          },
        });
      });
    });

    describe('Root POST endpoint', () => {
      test('handles initialize request', async () => {
        const res = await request(app)
          .post('/')
          .send({
            jsonrpc: '2.0',
            method: 'initialize',
            id: 1,
          });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'cursor-background-agents',
              version: '1.0.0',
            },
          },
        });
      });

      test('handles notifications/initialized request', async () => {
        const res = await request(app)
          .post('/')
          .send({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            id: 1,
          });

        expect(res.status).toBe(200);
        expect(res.text).toBe('');
      });

      test('handles tools/list request', async () => {
        const res = await request(app)
          .post('/')
          .set('x-cursor-api-key', mockApiKey)
          .send({
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1,
          });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          jsonrpc: '2.0',
          id: 1,
          result: {
            tools: expect.arrayContaining([
              expect.objectContaining({
                name: 'testTool',
                description: 'A test tool',
              }),
            ]),
          },
        });
      });

      test('handles tools/call request', async () => {
        const res = await request(app)
          .post('/')
          .set('x-cursor-api-key', mockApiKey)
          .send({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'testTool',
              arguments: { test: 'data' },
            },
            id: 1,
          });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          jsonrpc: '2.0',
          id: 1,
          result: 'Test result',
        });
      });
    });
  });

  describe('API key extraction', () => {
    const mockClient = {
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

    beforeEach(() => {
      createCursorApiClient.mockReturnValue(mockClient);
    });

    test('extracts API key from x-cursor-api-key header', async () => {
      const apiKey = 'key_header123';
      await request(app)
        .post('/mcp')
        .set('x-cursor-api-key', apiKey)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
    });

    test('extracts API key from x-api-key header', async () => {
      const apiKey = 'key_api123';
      await request(app)
        .post('/mcp')
        .set('x-api-key', apiKey)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
    });

    test('extracts API key from query parameter', async () => {
      const apiKey = 'key_query123';
      await request(app)
        .post('/mcp')
        .query({ api_key: apiKey })
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
    });

    test('extracts API key from request body', async () => {
      const apiKey = 'key_body123';
      await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          cursor_api_key: apiKey,
          id: 1,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
    });

    test('extracts API key from Bearer token (non-OAuth)', async () => {
      const apiKey = 'key_bearer123';
      await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
    });

    test('ignores OAuth Bearer tokens', async () => {
      const oauthToken = 'oauth_token123';
      await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${oauthToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      // Should not use the OAuth token as API key, should use default client
      expect(createCursorApiClient).not.toHaveBeenCalledWith(oauthToken);
    });

    test('extracts API key from token query parameter', async () => {
      const apiKey = 'key_token123';
      const token = mintTokenFromApiKey(apiKey);
      
      await request(app)
        .post('/mcp')
        .query({ token })
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
    });

    test('extracts API key from x-mcp-token header', async () => {
      const apiKey = 'key_mcp123';
      const token = mintTokenFromApiKey(apiKey);
      
      await request(app)
        .post('/mcp')
        .set('x-mcp-token', token)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey);
    });
  });

  describe('Tool creation per request', () => {
    test('creates tools with different API keys', async () => {
      const apiKey1 = 'key_user1';
      const apiKey2 = 'key_user2';
      const mockClient1 = { createAgent: jest.fn() };
      const mockClient2 = { createAgent: jest.fn() };

      createCursorApiClient
        .mockReturnValueOnce(mockClient1)
        .mockReturnValueOnce(mockClient2);

      // First request with API key 1
      await request(app)
        .post('/mcp')
        .set('x-cursor-api-key', apiKey1)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        });

      // Second request with API key 2
      await request(app)
        .post('/mcp')
        .set('x-cursor-api-key', apiKey2)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        });

      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey1);
      expect(createCursorApiClient).toHaveBeenCalledWith(apiKey2);
      expect(createCursorApiClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('SSE endpoint functionality', () => {
    let server;
    let agent;

    beforeAll(() => {
      server = app.listen(0);
      agent = request(server);
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    test('SSE endpoint responds without hanging', async () => {
      await new Promise((resolve, reject) => {
        const req = agent.get('/sse');

        req.on('response', (res) => {
          try {
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/event-stream/);
            req.abort();
            resolve();
          } catch (assertionError) {
            req.abort();
            reject(assertionError);
          }
        });

        req.on('error', (err) => {
          req.abort();
          reject(err);
        });

        setTimeout(() => {
          req.abort();
          resolve();
        }, 200);
      });
    });
  });

  describe('OAuth discovery endpoints', () => {
    test('GET /.well-known/oauth-authorization-server returns discovery', async () => {
      const res = await request(app).get('/.well-known/oauth-authorization-server');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('issuer');
      expect(res.body).toHaveProperty('authorization_endpoint');
      expect(res.body).toHaveProperty('token_endpoint');
      expect(res.body).toHaveProperty('response_types_supported');
      expect(res.body).toHaveProperty('grant_types_supported');
      expect(res.body).toHaveProperty('code_challenge_methods_supported');
    });

    test('GET /.well-known/openid-configuration returns discovery', async () => {
      const res = await request(app).get('/.well-known/openid-configuration');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('issuer');
      expect(res.body).toHaveProperty('authorization_endpoint');
      expect(res.body).toHaveProperty('token_endpoint');
    });

    test('GET /.well-known/oauth-protected-resource/sse returns resource info', async () => {
      const res = await request(app).get('/.well-known/oauth-protected-resource/sse');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('resource_registration_endpoint');
      expect(res.body).toHaveProperty('authorization_servers');
    });

    test('GET /.well-known/oauth-protected-resource returns resource info', async () => {
      const res = await request(app).get('/.well-known/oauth-protected-resource');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('resource_registration_endpoint');
      expect(res.body).toHaveProperty('authorization_servers');
    });
  });

  describe('Token-based authentication flow', () => {
    test('GET /connect returns HTML form', async () => {
      const res = await request(app).get('/connect');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Connect your Cursor API key');
      expect(res.text).toContain('<form method="POST"');
    });

    test('POST /connect with valid API key generates token URLs', async () => {
      const apiKey = 'key_test123';
      const res = await request(app)
        .post('/connect')
        .send({ apiKey });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Connection ready');
      expect(res.text).toContain('/sse?token=');
      expect(res.text).toContain('/mcp?token=');
    });

    test('POST /connect with missing API key returns error', async () => {
      const res = await request(app)
        .post('/connect')
        .send({});

      expect(res.status).toBe(400);
      expect(res.text).toBe('Missing API key');
    });

    test('POST /connect with empty API key returns error', async () => {
      const res = await request(app)
        .post('/connect')
        .send({ apiKey: '   ' });

      expect(res.status).toBe(400);
      expect(res.text).toBe('Missing API key');
    });
  });

  describe('Error handling in MCP request processing', () => {
    test('handles malformed JSON-RPC request', async () => {
      const res = await request(app)
        .post('/mcp')
        .send({ invalid: 'request' });

      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32603,
        },
      });
    });

    test('handles tool execution errors', async () => {
      createTools.mockReturnValueOnce([
        {
          name: 'errorTool',
          description: 'A tool that throws errors',
          inputSchema: { type: 'object', properties: {} },
          handler: jest.fn().mockRejectedValue(new Error('Tool execution failed')),
        },
      ]);

      const res = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'errorTool',
            arguments: {},
          },
          id: 1,
        });

      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32603,
          message: 'Tool execution failed',
        },
      });
    });
  });

  describe('CORS handling for OAuth endpoints', () => {
    test('OAuth endpoints have CORS headers', async () => {
      const res = await request(app).get('/oauth/authorize');
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toBe('GET, POST, OPTIONS');
      expect(res.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');
    });

    test('OAuth authorize endpoint redirects with state', async () => {
      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          redirect_uri: 'https://example.com/callback',
          state: 'test_state',
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('code=dummy_auth_code');
      expect(res.headers.location).toContain('state=test_state');
    });

    test('OAuth token endpoint returns dummy token', async () => {
      const res = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: 'dummy_auth_code',
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        access_token: 'dummy_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    });

    test('OAuth resource registration endpoint', async () => {
      const res = await request(app)
        .post('/oauth/resource')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        resource_id: 'mcp-server',
        resource_scopes: ['read', 'write'],
        resource_uri: expect.stringContaining('/sse'),
      });
    });
  });

  describe('Request logging middleware', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('logs request information', async () => {
      await request(app).get('/health');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - GET \/health - .*/),
      );
    });

    test('logs POST request information', async () => {
      await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - POST \/mcp - .*/),
      );
    });
  });

  describe('Global error handler and 404 handler', () => {
    test('404 handler returns proper error format', async () => {
      const res = await request(app).get('/nonexistent-route');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        error: {
          message: 'Route GET /nonexistent-route not found',
          code: 'NOT_FOUND',
        },
      });
    });

    test('handles OPTIONS requests for 404', async () => {
      const res = await request(app).options('/nonexistent-route');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        error: {
          message: 'Route OPTIONS /nonexistent-route not found',
          code: 'NOT_FOUND',
        },
      });
    });
  });

  describe('Graceful shutdown handling', () => {
    let processSpy;

    beforeEach(() => {
      processSpy = jest.spyOn(process, 'exit').mockImplementation();
    });

    afterEach(() => {
      processSpy.mockRestore();
    });

    test('handles SIGTERM signal', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.emit('SIGTERM');
      
      expect(consoleSpy).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
      expect(processSpy).toHaveBeenCalledWith(0);
      
      consoleSpy.mockRestore();
    });

    test('handles SIGINT signal', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.emit('SIGINT');
      
      expect(consoleSpy).toHaveBeenCalledWith('SIGINT received, shutting down gracefully');
      expect(processSpy).toHaveBeenCalledWith(0);
      
      consoleSpy.mockRestore();
    });

    test('handles uncaught exceptions', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test uncaught exception');
      
      process.emit('uncaughtException', error);
      
      expect(consoleSpy).toHaveBeenCalledWith('Uncaught Exception:', error);
      expect(processSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
    });

    test('handles unhandled rejections', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const reason = new Error('Test rejection');
      const promise = Promise.resolve(); // Use resolved promise to avoid actual rejection
      
      process.emit('unhandledRejection', reason, promise);
      
      expect(consoleSpy).toHaveBeenCalledWith('Unhandled Rejection at:', promise, 'reason:', reason);
      expect(processSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Favicon handling', () => {
    test('GET /favicon.ico returns 204 No Content', async () => {
      const res = await request(app).get('/favicon.ico');
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    test('POST /favicon.ico returns 404', async () => {
      const res = await request(app).post('/favicon.ico');
      expect(res.status).toBe(404);
    });
  });
});


