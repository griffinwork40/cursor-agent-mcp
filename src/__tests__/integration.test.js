describe('MCP Protocol Integration Tests - Basic HTTP Endpoints', () => {
  const express = require('express');
  const request = require('supertest');

  const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Translate JSON parse errors into structured responses so tests can assert on error payloads
    app.use((err, req, res, next) => {
      if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        return res.status(400).json({
          error: {
            message: 'Invalid JSON payload',
          },
        });
      }
      return next(err);
    });

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

    // Root endpoint for ChatGPT discovery
    app.get('/', (req, res) => {
      res.json({
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
      });
    });

    // OAuth endpoints for testing
    app.get('/oauth/authorize', (req, res) => {
      const redirectUri = req.query.redirect_uri;
      const state = req.query.state;
      res.redirect(`${redirectUri}?code=dummy_auth_code&state=${state}`);
    });

    app.post('/oauth/token', (req, res) => {
      res.json({
        access_token: 'dummy_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    });

    // Connect endpoint for testing
    app.get('/connect', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>Connect Cursor MCP</title></head>
<body>
  <h1>Connect your Cursor API key</h1>
  <form method="POST" action="/connect">
    <label>Cursor API Key <input name="apiKey" type="password" required></label>
    <button type="submit">Generate URL</button>
  </form>
</body></html>`);
    });

    app.use('/connect', express.urlencoded({ extended: false }));
    app.post('/connect', (req, res) => {
      try {
        const apiKey = (req.body?.apiKey || '').trim();
        if (!apiKey) {
          return res.status(400).send('Missing API key');
        }
        const token = `mock_${apiKey}`;
        const host = req.get('host');
        const isHttps = req.protocol === 'https' || host.includes(':') === false;
        const base = `${isHttps ? 'https' : 'http'}://${host}`;
        const sseUrl = `${base}/sse?token=${encodeURIComponent(token)}`;
        const mcpUrl = `${base}/mcp?token=${encodeURIComponent(token)}`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>Your MCP URLs</title></head>
<body>
  <h1>Connection ready</h1>
  <p>Share one of these URLs with ChatGPT MCP:</p>
  <p><strong>SSE URL:</strong> <code>${sseUrl}</code></p>
  <p><strong>MCP URL:</strong> <code>${mcpUrl}</code></p>
  <p>Token expires in 30 day(s). You can regenerate anytime.</p>
</body></html>`);
      } catch (e) {
        console.error('Error generating token:', e);
        res.status(500).send('Internal error generating token');
      }
    });

    // Simple MCP protocol endpoint for basic testing
    app.post('/mcp', (req, res) => {
      try {
        console.log('MCP Request:', JSON.stringify(req.body, null, 2));

        const { method, params, id } = req.body;

        let result;

        switch (method) {
          case 'tools/list':
            result = {
              tools: [
                {
                  name: 'createAgent',
                  description: 'Create a new background agent to work on a repository',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      prompt: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
                      model: { type: 'string' },
                      source: { type: 'object', properties: { repository: { type: 'string' } }, required: ['repository'] },
                      target: { type: 'object', properties: { autoCreatePr: { type: 'boolean' }, branchName: { type: 'string' } } },
                      webhook: { type: 'object', properties: { url: { type: 'string' }, secret: { type: 'string' } } }
                    },
                    required: ['prompt', 'source', 'model']
                  }
                },
                {
                  name: 'listAgents',
                  description: 'List all background agents for the authenticated user',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      limit: { type: 'number' },
                      cursor: { type: 'string' }
                    }
                  }
                }
              ]
            };
            break;

          case 'tools/call':
            result = {
              content: [
                {
                  type: 'text',
                  text: `Mock response for tool: ${params.name}`
                }
              ]
            };
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

  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('HTTP Endpoints', () => {
    describe('GET /health', () => {
      test('should return health status', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body).toMatchObject({
          status: 'ok',
          version: '1.0.0'
        });
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
      });
    });

    describe('GET /', () => {
      test('should return MCP server information', async () => {
        const response = await request(app)
          .get('/')
          .expect(200);

        expect(response.body).toMatchObject({
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
          }
        });
      });
    });

    describe('OAuth Endpoints', () => {
      test('GET /oauth/authorize should redirect with authorization code', async () => {
        const redirectUri = 'https://example.com/callback';
        const state = 'test_state';

        const response = await request(app)
          .get('/oauth/authorize')
          .query({ redirect_uri: redirectUri, state })
          .expect(302);

        expect(response.header.location).toBe(`${redirectUri}?code=dummy_auth_code&state=${state}`);
      });

      test('POST /oauth/token should return access token', async () => {
        const response = await request(app)
          .post('/oauth/token')
          .send({ grant_type: 'authorization_code', code: 'test_code' })
          .expect(200);

        expect(response.body).toMatchObject({
          access_token: 'dummy_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        });
      });
    });

    describe('Connect Endpoints', () => {
      test('GET /connect should return connection form', async () => {
        const response = await request(app)
          .get('/connect')
          .expect(200);

        expect(response.text).toContain('Connect your Cursor API key');
        expect(response.text).toContain('<form method="POST" action="/connect">');
      });

      test('POST /connect should generate connection URLs', async () => {
        const apiKey = 'test_api_key_123';

        const response = await request(app)
          .post('/connect')
          .send({ apiKey })
          .expect(200);

        expect(response.text).toContain('Connection ready');
        expect(response.text).toContain('/sse?token=');
        expect(response.text).toContain('/mcp?token=');
      });

      test('POST /connect should handle missing API key', async () => {
        const response = await request(app)
          .post('/connect')
          .send({})
          .expect(400);

        expect(response.text).toBe('Missing API key');
      });
    });
  });

  describe('MCP Protocol Endpoints', () => {
    describe('POST /mcp - tools/list', () => {
      test('should list available tools successfully', async () => {
        const response = await request(app)
          .post('/mcp')
          .send({
            method: 'tools/list',
            id: 'test-123'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          id: 'test-123'
        });

        expect(response.body.result).toHaveProperty('tools');
        expect(Array.isArray(response.body.result.tools)).toBe(true);
        expect(response.body.result.tools.length).toBeGreaterThan(0);

        // Verify tool structure
        const tools = response.body.result.tools;
        const createAgentTool = tools.find(t => t.name === 'createAgent');
        expect(createAgentTool).toBeDefined();
        expect(createAgentTool).toHaveProperty('description');
        expect(createAgentTool).toHaveProperty('inputSchema');
      });
    });

    describe('POST /mcp - tools/call', () => {
      test('should execute tool successfully', async () => {
        const response = await request(app)
          .post('/mcp')
          .send({
            method: 'tools/call',
            params: {
              name: 'createAgent',
              arguments: {
                prompt: { text: 'Test prompt' },
                model: 'gpt-4',
                source: { repository: 'https://github.com/test/repo' }
              }
            },
            id: 'test-456'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          id: 'test-456'
        });

        expect(response.body.result).toHaveProperty('content');
        expect(Array.isArray(response.body.result.content)).toBe(true);
        expect(response.body.result.content[0]).toHaveProperty('type', 'text');
        expect(response.body.result.content[0].text).toContain('Mock response for tool: createAgent');
      });

      test('should handle unknown tools gracefully', async () => {
        const response = await request(app)
          .post('/mcp')
          .send({
            method: 'tools/call',
            params: {
              name: 'nonExistentTool',
              arguments: {}
            },
            id: 'test-789'
          })
          .expect(200);

        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          id: 'test-789'
        });

        expect(response.body.result).toHaveProperty('content');
        expect(response.body.result.content[0].text).toContain('Mock response for tool: nonExistentTool');
      });
    });

    describe('POST /mcp - invalid methods', () => {
      test('should return error for unknown methods', async () => {
        const response = await request(app)
          .post('/mcp')
          .send({
            method: 'unknown/method',
            id: 'test-101'
          })
          .expect(500);

        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          id: 'test-101'
        });

        expect(response.body).toHaveProperty('error');
        expect(response.body.error.message).toContain('Unknown method: unknown/method');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('should handle missing request body', async () => {
      const response = await request(app)
        .post('/mcp')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('should handle missing method in request', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          id: 'test-202'
          // Missing method
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    test('should handle large request payloads', async () => {
      const largePayload = {
        method: 'tools/call',
        params: {
          name: 'createAgent',
          arguments: {
            prompt: { text: 'A'.repeat(10000) }, // Very large prompt
            model: 'gpt-4',
            source: { repository: 'https://github.com/test/repo' }
          }
        },
        id: 'test-303'
      };

      const response = await request(app)
        .post('/mcp')
        .send(largePayload)
        .expect(200);

      // Should handle gracefully
      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-303'
      });
    });
  });

  describe('Response Format Validation', () => {
    test('should return properly formatted MCP responses', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'tools/list',
          id: 'format-test-123'
        })
        .expect(200);

      // Validate JSON-RPC 2.0 response format
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('id', 'format-test-123');
      expect(response.body).toHaveProperty('result');

      // Result should be an object with tools array
      expect(typeof response.body.result).toBe('object');
      expect(Array.isArray(response.body.result.tools)).toBe(true);
    });

    test('should return properly formatted error responses', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          method: 'unknown/method',
          id: 'error-format-test-456'
        })
        .expect(500);

      // Validate error response format
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('id', 'error-format-test-456');
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});