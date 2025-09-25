import http from 'http';
import express from 'express';
import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { createCursorApiClient } from '../utils/cursorClient.js';
import { createTools } from '../tools/index.js';

/* global setTimeout, clearTimeout */

const DEFAULT_EVENT_TIMEOUT_MS = 2000;

const parseSseEvent = (rawEvent) => {
  const lines = rawEvent.split('\n');
  let eventType = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  return { event: eventType, data: dataLines.join('\n') };
};

const createSseStream = (url, { timeoutMs = DEFAULT_EVENT_TIMEOUT_MS, headers = {} } = {}) => new Promise((resolve, reject) => {
  const request = http.get(url, {
    headers: { Accept: 'text/event-stream', ...headers },
  }, res => {
    const statusCode = res.statusCode ?? 0;
    if (statusCode < 200 || statusCode >= 300) {
      reject(new Error(`Failed to open SSE connection: ${statusCode}`));
      res.resume();
      return;
    }

    let buffer = '';
    const eventQueue = [];
    const pendingResolvers = [];

    const dispatchEvent = (event) => {
      const listener = pendingResolvers.shift();
      if (listener) {
        clearTimeout(listener.timer);
        listener.resolve(event);
      } else {
        eventQueue.push(event);
      }
    };

    const flushBuffer = () => {
      buffer = buffer.replace(/\r\n/g, '\n');
      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        if (rawEvent.trim().length > 0) {
          dispatchEvent(parseSseEvent(rawEvent));
        }
        separatorIndex = buffer.indexOf('\n\n');
      }
    };

    res.setEncoding('utf8');
    res.on('data', chunk => {
      buffer += chunk;
      flushBuffer();
    });

    res.on('error', error => {
      pendingResolvers.splice(0).forEach(({ reject: rejectListener, timer }) => {
        clearTimeout(timer);
        rejectListener(error);
      });
      reject(error);
    });

    res.on('end', () => {
      pendingResolvers.splice(0).forEach(({ reject: rejectListener, timer }) => {
        clearTimeout(timer);
        rejectListener(new Error('SSE stream ended unexpectedly'));
      });
    });

    const nextEvent = (eventTimeoutMs = timeoutMs) => {
      if (eventQueue.length > 0) {
        return Promise.resolve(eventQueue.shift());
      }

      return new Promise((resolveEvent, rejectEvent) => {
        const timer = setTimeout(() => {
          const index = pendingResolvers.findIndex(listener => listener.resolve === resolveEvent);
          if (index !== -1) {
            pendingResolvers.splice(index, 1);
          }
          rejectEvent(new Error('Timed out waiting for SSE event'));
        }, eventTimeoutMs);
        pendingResolvers.push({ resolve: resolveEvent, reject: rejectEvent, timer });
      });
    };

    const close = async () => {
      request.destroy();
      res.destroy();
      pendingResolvers.splice(0).forEach(({ reject: rejectListener, timer }) => {
        clearTimeout(timer);
        rejectListener(new Error('Connection closed'));
      });
    };

    resolve({
      response: { statusCode, headers: res.headers },
      nextEvent,
      close,
    });
  });

  request.on('error', reject);
});

// Create a test application with SSE support
const createTestAppWithSSE = () => {
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
  // const getToolsForRequest = (req) => {
  //   const apiKey = extractApiKey(req);
  //   const client = createCursorApiClient(apiKey);
  //   return createTools(client);
  // };

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
      transport.req = req;

      mcpServer.connect(transport).catch(error => {
        console.error('MCP SSE connection error:', error);
        res.write(`event: error\\ndata: ${JSON.stringify({ error: error.message })}\\n\\n`);
        res.end();
      });
    } catch (error) {
      console.error('SSE setup error:', error);
      res.write(`event: error\\ndata: ${JSON.stringify({ error: error.message })}\\n\\n`);
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
    summary: 'Completed successfully',
  },
];

const mockModels = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'];
const mockRepositories = [
  { name: 'repo1', owner: 'test', repository: 'https://github.com/test/repo1' },
];

describe('MCP SSE Integration Tests', () => {
  let testAppData;
  let mock;
  let axiosInstance;
  let axiosCreateSpy;
  let server;
  let baseUrl;

  beforeEach(async () => {
    testAppData = createTestAppWithSSE();
    axiosInstance = axios.create();
    mock = new MockAdapter(axiosInstance);
    axiosCreateSpy = jest.spyOn(axios, 'create').mockImplementation((config = {}) => {
      axiosInstance.defaults.baseURL = config.baseURL;
      axiosInstance.defaults.headers = config.headers;
      axiosInstance.defaults.timeout = config.timeout;
      return axiosInstance;
    });

    server = testAppData.app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    const port = typeof address === 'string' ? 0 : address.port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    mock.restore();
    if (axiosCreateSpy) {
      axiosCreateSpy.mockRestore();
    }
    if (axiosInstance) {
      axiosInstance.interceptors.request.handlers = [];
      axiosInstance.interceptors.response.handlers = [];
    }
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    jest.clearAllMocks();
  });

  describe('SSE Connection Setup', () => {
    test('should establish SSE connection and emit endpoint event', async () => {
      mock.onGet('/v0/agents').reply(200, { agents: mockAgents });
      mock.onGet('/v0/models').reply(200, { models: mockModels });
      mock.onGet('/v0/repositories').reply(200, { repositories: mockRepositories });
      mock.onGet('/v0/me').reply(200, { apiKeyName: 'test-key', createdAt: '2024-01-01T00:00:00Z' });

      const stream = await createSseStream(`${baseUrl}/sse`);
      expect(stream.response.statusCode).toBe(200);
      expect(stream.response.headers['content-type']).toContain('text/event-stream');
      expect(stream.response.headers['cache-control']).toContain('no-cache');
      const endpointEvent = await stream.nextEvent();
      expect(endpointEvent.event).toBe('endpoint');
      expect(endpointEvent.data).toContain('/sse?sessionId=');
      await stream.close();
    });

    test('should accept API key via query parameter', async () => {
      mock.onGet('/v0/agents').reply(200, { agents: [] });

      const stream = await createSseStream(`${baseUrl}/sse?token=mock_test_token_123`);
      expect(stream.response.statusCode).toBe(200);
      const endpointEvent = await stream.nextEvent();
      expect(endpointEvent.event).toBe('endpoint');
      await stream.close();
    });

    test('should accept API key via headers', async () => {
      mock.onGet('/v0/agents').reply(200, { agents: [] });

      const stream = await createSseStream(`${baseUrl}/sse`, {
        headers: { 'x-cursor-api-key': 'mock_header_key_456' },
      });
      expect(stream.response.statusCode).toBe(200);
      await stream.close();
    });

    test('should close streams cleanly', async () => {
      mock.onGet('/v0/agents').reply(200, { agents: [] });

      const stream = await createSseStream(`${baseUrl}/sse`);
      await stream.close();
      // Subsequent closes should not throw
      await stream.close();
    });
  });
});
