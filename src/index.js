#!/usr/bin/env node
import express from 'express';
import { config } from './config/index.js';
import { createTools } from './tools/index.js';
import { handleMCPError } from './utils/errorHandler.js';

const app = express();
const port = config.port;

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
    uptime: process.uptime()
  });
});

// Get tools
const tools = createTools();

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
  console.log(`📊 Available tools: ${tools.length}`);
  console.log(`🔑 API Key configured: ${config.cursor.apiKey ? 'Yes' : 'No'}`);
});