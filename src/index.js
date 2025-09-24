#!/usr/bin/env node
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from './config/index.js';
import { createTools } from './tools/index.js';
import { createCursorApiClient, cursorApiClient as defaultCursorClient } from './utils/cursorClient.js';
import { handleMCPError } from './utils/errorHandler.js';
import { mintTokenFromApiKey, decodeTokenToApiKey } from './utils/tokenUtils.js';
import crypto from 'crypto';

const app = express();
const port = config.port;

app.use(express.json());

// Auth middleware for SSE endpoint
const requireMCPAuth = (req, res, next) => {
  const expectedToken = process.env.MCP_SERVER_TOKEN;
  if (!expectedToken) {
    console.warn('MCP_SERVER_TOKEN not set - SSE endpoint will be unprotected');
    return next();
  }
  
  const providedToken = req.headers['x-mcp-auth'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!providedToken || providedToken !== expectedToken) {
    return res.status(401).json({ error: 'Invalid or missing MCP auth token' });
  }
  
  next();
};

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
    uptime: process.uptime()
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
      connect: '/connect'
    },
    oauth: {
      authorization_endpoint: '/oauth/authorize',
      token_endpoint: '/oauth/token'
    }
  });
});

app.post('/', async (req, res) => {
  // Handle MCP requests on root path (ChatGPT sometimes does this)
  console.log('Root POST request:', JSON.stringify(req.body, null, 2));
  
  try {
    const { method, params, id } = req.body;
    
    let result;
    
    switch (method) {
      case 'initialize':
        {
          result = {
            protocolVersion: "2025-03-26",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "cursor-background-agents",
              version: "1.0.0"
            }
          };
        }
        break;
        
      case 'notifications/initialized':
        {
          // This is just a notification, no response needed
          console.log('ChatGPT initialized successfully');
          return res.status(200).end(); // No response body for notifications
        }
        
      case 'tools/list':
        {
          const tools = getToolsForRequest(req);
          result = {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
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
      result
    };
    
    console.log('Root MCP Response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('Error handling root MCP request:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32603,
        message: error.message || 'Internal error',
        data: error.stack
      }
    };
    res.status(500).json(errorResponse);
  }
});

// Quiet favicon requests to avoid console 404s
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Helper to extract Cursor API key from request (UPDATED for ChatGPT compatibility)
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

// Lazily create tools per request using provided API key (fallback to default client)
const getToolsForRequest = (req) => {
  const apiKey = extractApiKey(req);
  console.log(`API Key extracted: ${apiKey ? `${apiKey.substring(0, 10)}...` : 'None'}`);
  const client = apiKey ? createCursorApiClient(apiKey) : defaultCursorClient;
  return createTools(client);
};

// Create MCP Server for SSE (tools created at connection time)
const mcpServer = new Server(
  {
    name: 'cursor-background-agents',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Setup MCP handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request, context) => {
  // Read per-request Cursor API key from custom headers/query/body; ignore OAuth Authorization header
  const req = context?.transport?.req;
  const apiKey = req ? extractApiKey(req) : config.cursor.apiKey;
  console.log(`SSE ListTools - API Key: ${apiKey ? `${apiKey.substring(0, 10)}...` : 'None'}`);
  const client = apiKey ? createCursorApiClient(apiKey) : defaultCursorClient;
  const tools = createTools(client);
  console.log(`SSE ListTools - Created ${tools.length} tools`);
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request, context) => {
  const { name, arguments: args } = request.params;
  const req = context?.transport?.req;
  const apiKey = req ? extractApiKey(req) : config.cursor.apiKey;
  const client = apiKey ? createCursorApiClient(apiKey) : defaultCursorClient;
  const tools = createTools(client);
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Tool ${name} not found`);
  }

  try {
    const result = await tool.handler(args || {});
    
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    const errorResponse = handleMCPError(error, name);
    
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorResponse.error || error.message}`
        }
      ],
      isError: true
    };
  }
});

// OAuth discovery endpoints for ChatGPT MCP integration
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: `https://${req.get('host')}`,
    authorization_endpoint: `https://${req.get('host')}/oauth/authorize`,
    token_endpoint: `https://${req.get('host')}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"]
  });
});

app.get('/.well-known/openid-configuration', (req, res) => {
  res.json({
    issuer: `https://${req.get('host')}`,
    authorization_endpoint: `https://${req.get('host')}/oauth/authorize`,
    token_endpoint: `https://${req.get('host')}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"]
  });
});

app.get('/.well-known/oauth-protected-resource/sse', (req, res) => {
  res.json({
    resource_registration_endpoint: `https://${req.get('host')}/oauth/resource`,
    authorization_servers: [`https://${req.get('host')}`]
  });
});

// Simplified OAuth endpoints for ChatGPT
app.get('/oauth/authorize', (req, res) => {
  // For testing, just redirect back with a dummy code
  const redirectUri = req.query.redirect_uri;
  const state = req.query.state;
  res.redirect(`${redirectUri}?code=dummy_auth_code&state=${state}`);
});

app.post('/oauth/token', (req, res) => {
  // Return a dummy token for ChatGPT
  res.json({
    access_token: 'dummy_access_token',
    token_type: 'Bearer',
    expires_in: 3600
  });
});

// OAuth resource registration endpoint
app.post('/oauth/resource', (req, res) => {
  res.json({
    resource_id: 'mcp-server',
    resource_scopes: ['read', 'write'],
    resource_uri: `https://${req.get('host')}/sse`
  });
});

// CORS headers for OAuth endpoints
app.use((req, res, next) => {
  if (req.path.startsWith('/oauth') || req.path.startsWith('/.well-known')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  next();
});

// SSE endpoint for ChatGPT MCP integration (FIXED - no CORS headers)
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
              inputSchema: tool.inputSchema
            }))
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
      result
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
        data: error.stack
      }
    };
    res.status(500).json(errorResponse);
  }
});

// Minimal connect page and minting endpoint (must be before 404 handler)
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

// Lightweight body parser for form posts
app.use('/connect', express.urlencoded({ extended: false }));
app.post('/connect', (req, res) => {
  try {
    const apiKey = (req.body?.apiKey || '').trim();
    if (!apiKey) {
      return res.status(400).send('Missing API key');
    }
    const token = mintTokenFromApiKey(apiKey);
    const host = req.get('host');
    const isHttps = req.protocol === 'https' || host.includes(':') === false; // best-effort
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
  <p>Token expires in ${config.token.ttlDays} day(s). You can regenerate anytime.</p>
</body></html>`);
  } catch (e) {
    console.error('Error generating token:', e);
    res.status(500).send('Internal error generating token');
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  const errorResponse = handleMCPError(error, 'Express middleware');
  res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'NOT_FOUND'
    }
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`🚀 Cursor MCP Server listening on port ${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`🔧 MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
  console.log(`📊 Tools are created per request/connection`);
  console.log(`🔑 API Key configured: ${config.cursor.apiKey ? 'Yes' : 'No'}`);
  console.log(`🔐 MCP Auth token: ${process.env.MCP_SERVER_TOKEN ? 'Set' : 'Not set (unprotected)'}`);
});