#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createTools } from './tools/index.js';
import { handleMCPError } from './utils/errorHandler.js';

class CursorMCPServer {
  constructor(toolsFactory = createTools) {
    this.server = new Server(
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

    this.toolsFactory = toolsFactory;
    this.tools = this.toolsFactory();
    this.setupHandlers();
  }

  setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolSummaries(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      try {
        const result = await tool.handler(args || {});
        return this.normalizeToolResult(result);
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        const errorResponse = handleMCPError(error, name);

        return {
          content: errorResponse.content || [
            {
              type: 'text',
              text: error.message,
            },
          ],
          isError: true,
        };
      }
    });
  }

  getToolSummaries() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  normalizeToolResult(result) {
    if (!result) {
      return {
        content: [],
        isError: false,
      };
    }

    if (typeof result === 'string') {
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
        isError: false,
      };
    }

    const normalized = {
      ...result,
    };

    if (!Array.isArray(normalized.content)) {
      normalized.content = [
        {
          type: 'text',
          text: typeof result === 'object'
            ? JSON.stringify(result, null, 2)
            : String(result),
        },
      ];
    }

    if (typeof normalized.isError !== 'boolean') {
      normalized.isError = false;
    }

    return normalized;
  }

  getErrorMessage(normalized, fallback = 'Tool execution failed') {
    const entry = normalized.content?.[0];
    if (entry && entry.type === 'text' && entry.text) {
      return entry.text;
    }
    return fallback;
  }

  async handleRequest(request) {
    if (!request || request.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC request');
    }

    const { method, params = {} } = request;

    switch (method) {
    case 'tools/list':
      return {
        result: {
          tools: this.getToolSummaries(),
        },
      };

    case 'tools/call': {
      const { name, arguments: args = {} } = params;

      if (!name) {
        return {
          error: {
            code: -32602,
            message: 'Tool name is required',
          },
        };
      }

      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        return {
          error: {
            code: -32601,
            message: `Tool ${name} not found`,
          },
        };
      }

      try {
        const result = await tool.handler(args);
        const normalized = this.normalizeToolResult(result);

        if (normalized.isError) {
          return {
            error: {
              code: -32000,
              message: this.getErrorMessage(normalized),
              data: normalized,
            },
          };
        }

        return {
          result: normalized,
        };
      } catch (error) {
        const errorResponse = handleMCPError(error, name);
        return {
          error: {
            code: -32603,
            message: errorResponse?.content?.[0]?.text || error.message || 'Internal error',
            data: errorResponse,
          },
        };
      }
    }

    default:
      return {
        error: {
          code: -32601,
          message: `Unknown method: ${method}`,
        },
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Cursor MCP Server started successfully');
    console.error(`📊 Available tools: ${this.tools.length}`);
  }
}

export const createMCPServer = (options = {}) => {
  const { toolsFactory = createTools } = options;
  return new CursorMCPServer(toolsFactory);
};

const isMainModule = Boolean(process.argv[1] && process.argv[1].endsWith('mcp-server.js'));

if (isMainModule) {
  const server = createMCPServer();
  server.run().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
