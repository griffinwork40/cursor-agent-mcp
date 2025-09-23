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
import { handleMCPError } from './utils/errorHandler.js';
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

// Get tools
const tools = createTools();

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
  }
);

// Setup MCP handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
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

// SSE endpoint for ChatGPT MCP integration (no auth required for testing)
app.use('/sse', (req, res) => {
  console.log(`MCP SSE connection attempt from ${req.ip}`);
  const transport = new SSEServerTransport('/sse', res);
  mcpServer.connect(transport).catch(error => {
    console.error('MCP SSE connection error:', error);
  });
});

// MCP protocol endpoint
app.post('/mcp', async (req, res) => {
  try {
    console.log('MCP Request:', JSON.stringify(req.body, null, 2));
    
    const { method, params, id } = req.body;
    
    let result;
    
    switch (method) {
      case 'tools/list':
        result = {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        };
        break;
        
      case 'tools/call':
        const tool = tools.find(t => t.name === params.name);
        if (!tool) {
          throw new Error(`Tool ${params.name} not found`);
        }
        result = await tool.handler(params.arguments || {});
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
  console.log(`📊 Available tools: ${tools.length}`);
  console.log(`🔑 API Key configured: ${config.cursor.apiKey ? 'Yes' : 'No'}`);
  console.log(`🔐 MCP Auth token: ${process.env.MCP_SERVER_TOKEN ? 'Set' : 'Not set (unprotected)'}`);
});