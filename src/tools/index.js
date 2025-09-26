import { cursorApiClient as defaultCursorClient } from '../utils/cursorClient.js';
import { createAgentFromTemplateTool } from './createAgentFromTemplate.js';
import { 
  handleMCPError, 
  validateInput, 
  createSuccessResponse,
  schemas, 
} from '../utils/errorHandler.js';

export const createTools = (client = defaultCursorClient) => {
  const tools = [
    {
      name: 'createAgent',
      description: 'Create a new background agent to work on a repository',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The task or instructions for the agent to execute' },
              images: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    data: { type: 'string', description: 'Base64 encoded image data' },
                    dimension: {
                      type: 'object',
                      properties: {
                        width: { type: 'number' },
                        height: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
            required: ['text'],
          },
          model: { type: 'string', description: 'The LLM to use (defaults to default if not specified)', default: 'default' },
          source: {
            type: 'object',
            properties: {
              repository: { type: 'string', description: 'The GitHub repository URL' },
              ref: { type: 'string', description: 'Git ref (branch/tag) to use as the base branch' },
            },
            required: ['repository'],
          },
          target: {
            type: 'object',
            properties: {
              autoCreatePr: { type: 'boolean', description: 'Whether to automatically create a pull request when the agent completes' },
              branchName: { type: 'string', description: 'Custom branch name for the agent to create' },
            },
          },
          webhook: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to receive webhook notifications about agent status changes' },
              secret: { type: 'string', description: 'Secret key for webhook payload verification' },
            },
            required: ['url'],
          },
        },
        required: ['prompt', 'source', 'model'],
      },
      handler: async (input) => {
        try {
        // Validate input
          const validatedInput = validateInput(schemas.createAgentRequest, input, 'createAgent');
          const inputWithDefaults = {
            ...validatedInput,
            model: validatedInput.model || 'default',
          };
          const result = await client.createAgent(inputWithDefaults);
        
          return createSuccessResponse(
            '✅ Successfully created agent!\n' +
          `📋 ID: ${result.id}\n` +
          `📊 Status: ${result.status}\n` +
          `🌐 View: ${result.target.url}\n` +
          `📅 Created: ${new Date(result.createdAt).toLocaleString()}`,
            {
              agentId: result.id,
              status: result.status,
              url: result.target.url,
              createdAt: result.createdAt,
            },
          );
        } catch (error) {
          return handleMCPError(error, 'createAgent');
        }
      },
    },
    {
      name: 'listAgents',
      description: 'List all background agents for the authenticated user',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of background agents to return (1-100)' },
          cursor: { type: 'string', description: 'Pagination cursor from the previous response' },
        },
      },
      handler: async (input) => {
        try {
        // Validate input
          const validatedInput = validateInput(schemas.listAgentsParams, input, 'listAgents');
        
          const result = await client.listAgents(validatedInput);
        
          const agentList = result.agents.map(agent => 
            `• ${agent.name} (${agent.id}) - ${agent.status} - ${new Date(agent.createdAt).toLocaleDateString()}`,
          ).join('\n');
        
          return createSuccessResponse(
            `📋 Found ${result.agents.length} agent(s):\n\n${agentList}\n\n` +
          `📄 Next cursor: ${result.nextCursor || 'none'}`,
            {
              count: result.agents.length,
              agents: result.agents,
              nextCursor: result.nextCursor,
            },
          );
        } catch (error) {
          return handleMCPError(error, 'listAgents');
        }
      },
    },
    {
      name: 'getAgent',
      description: 'Retrieve the current status and results of a background agent',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the background agent' },
        },
        required: ['id'],
      },
      handler: async (input) => {
        try {
        // Validate input
          const validatedInput = validateInput(schemas.agentId, input.id, 'getAgent');
        
          const result = await client.getAgent(validatedInput);
        
          const statusEmoji = {
            'CREATING': '🔄',
            'RUNNING': '⚡',
            'FINISHED': '✅',
            'ERROR': '❌',
            'EXPIRED': '⏰',
          }[result.status] || '❓';
        
          return createSuccessResponse(
            '🤖 Agent Details:\n\n' +
          `📋 Name: ${result.name}\n` +
          `🆔 ID: ${result.id}\n` +
          `📊 Status: ${statusEmoji} ${result.status}\n` +
          `📅 Created: ${new Date(result.createdAt).toLocaleString()}\n` +
          `📝 Summary: ${result.summary || 'No summary yet'}\n` +
          `🌐 View: ${result.target.url}\n` +
          `🔗 Repository: ${result.source.repository}\n` +
          `🌿 Branch: ${result.target.branchName || 'N/A'}`,
            result,
          );
        } catch (error) {
          return handleMCPError(error, 'getAgent');
        }
      },
    },
    {
      name: 'deleteAgent',
      description: 'Delete a background agent. This action is permanent and cannot be undone',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the background agent' },
        },
        required: ['id'],
      },
      handler: async (input) => {
        try {
        // Validate input
          const validatedInput = validateInput(schemas.agentId, input.id, 'deleteAgent');
        
          const result = await client.deleteAgent(validatedInput);
        
          return createSuccessResponse(
            '🗑️ Successfully deleted agent!\n' +
          `🆔 Agent ID: ${result.id}\n` +
          '⚠️ This action is permanent and cannot be undone.',
            { deletedAgentId: result.id },
          );
        } catch (error) {
          return handleMCPError(error, 'deleteAgent');
        }
      },
    },
    {
      name: 'addFollowup',
      description: 'Add a followup instruction to an existing background agent',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the background agent' },
          prompt: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The followup instruction for the agent' },
              images: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    data: { type: 'string', description: 'Base64 encoded image data' },
                    dimension: {
                      type: 'object',
                      properties: {
                        width: { type: 'number' },
                        height: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
            required: ['text'],
          },
        },
        required: ['id', 'prompt'],
      },
      handler: async (input) => {
        try {
        // Validate input
          const validatedId = validateInput(schemas.agentId, input.id, 'addFollowup');
          const validatedData = validateInput(schemas.addFollowupRequest, input, 'addFollowup');
        
          const result = await client.addFollowup(validatedId, validatedData);
        
          return createSuccessResponse(
            '💬 Successfully added followup!\n' +
          `🆔 Agent ID: ${result.id}\n` +
          `📝 Followup: ${validatedData.prompt.text.substring(0, 100)}${validatedData.prompt.text.length > 100 ? '...' : ''}`,
            { agentId: result.id, followupText: validatedData.prompt.text },
          );
        } catch (error) {
          return handleMCPError(error, 'addFollowup');
        }
      },
    },
    {
      name: 'getAgentConversation',
      description: 'Retrieve the conversation history of a background agent',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for the background agent' },
        },
        required: ['id'],
      },
      handler: async (input) => {
        try {
        // Validate input
          const validatedInput = validateInput(schemas.agentId, input.id, 'getAgentConversation');
        
          const result = await client.getAgentConversation(validatedInput);
        
          const messageCount = result.messages.length;
          const conversationPreview = result.messages.slice(-3).map(msg => 
            `${msg.type === 'user_message' ? '👤 User' : '🤖 Assistant'}: ${msg.text.substring(0, 80)}${msg.text.length > 80 ? '...' : ''}`,
          ).join('\n');
        
          return createSuccessResponse(
            `💬 Agent Conversation (${messageCount} messages):\n\n` +
          `${conversationPreview}\n\n` +
          `📊 Total messages: ${messageCount}`,
            {
              agentId: result.id,
              messageCount,
              messages: result.messages,
            },
          );
        } catch (error) {
          return handleMCPError(error, 'getAgentConversation');
        }
      },
    },
    {
      name: 'getMe',
      description: 'Retrieve information about the API key being used for authentication',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        try {
          const result = await client.getMe();
        
          return createSuccessResponse(
            '🔑 API Key Information:\n\n' +
          `📋 Name: ${result.apiKeyName}\n` +
          `📅 Created: ${new Date(result.createdAt).toLocaleString()}\n` +
          `👤 User Email: ${result.userEmail || 'Not available'}`,
            result,
          );
        } catch (error) {
          return handleMCPError(error, 'getMe');
        }
      },
    },
    {
      name: 'listModels',
      description: 'Retrieve a list of recommended models for background agents',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        try {
          const result = await client.listModels();
        
          const modelList = result.models.map((model, index) => 
            `${index + 1}. ${model}`,
          ).join('\n');
        
          return createSuccessResponse(
            `🤖 Available Models:\n\n${modelList}\n\n` +
          `📊 Total: ${result.models.length} models available`,
            { models: result.models },
          );
        } catch (error) {
          return handleMCPError(error, 'listModels');
        }
      },
    },
    {
      name: 'listRepositories',
      description: 'Retrieve a list of GitHub repositories accessible to the authenticated user',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        try {
          const result = await client.listRepositories();
        
          const repoList = result.repositories.map((repo, index) => 
            `${index + 1}. ${repo.name} (${repo.owner})\n   🔗 ${repo.repository}`,
          ).join('\n\n');
        
          return createSuccessResponse(
            `📁 Accessible Repositories:\n\n${repoList}\n\n` +
          `📊 Total: ${result.repositories.length} repositories`,
            { repositories: result.repositories },
          );
        } catch (error) {
          return handleMCPError(error, 'listRepositories');
        }
      },
    },
  ];

  // Register high-level templated agent creation tool
  tools.push(createAgentFromTemplateTool(client));

  // Add a self-documentation tool to help LLMs understand how to use this MCP server
  tools.push({
    name: 'documentation',
    description: 'Return MCP usage docs, endpoints, auth, and tool schemas for this server',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: 'Response format: \'markdown\' or \'json\'',
          enum: ['markdown', 'json'],
          default: 'markdown',
        },
      },
    },
    handler: async (input = {}) => {
      try {
        const format = (input && input.format) || 'markdown';
        const listedTools = tools
          .filter(t => t.name !== 'documentation')
          .map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));

        const doc = {
          name: 'cursor-background-agents',
          version: '1.0.0',
          protocolVersion: '2025-03-26',
          description: 'MCP server for Cursor Background Agents API',
          endpoints: {
            http: '/mcp',
            sse: '/sse',
            health: '/health',
            discovery: '/',
          },
          authentication: {
            type: 'api_key',
            env: 'CURSOR_API_KEY',
            headers: ['Authorization: Bearer key_…', 'x-cursor-api-key', 'x-api-key', 'x-mcp-token'],
            tokenizedUrl: 'GET /connect to mint ?token=… for /sse or /mcp',
          },
          tools: listedTools,
          examples: {
            mcpList: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
            mcpCall: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'listAgents', arguments: { limit: 5 } } },
            sse: 'Use GET /sse for MCP over SSE',
          },
          notes: [
            'Prefer providing the Cursor API key via environment when possible.',
            'When calling createAgent or addFollowup, prompt.text is required.',
          ],
        };

        if (format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }],
          };
        }

        const toolLines = listedTools.map(t => `• ${t.name} — ${t.description}`).join('\n');
        const markdown = [
          '📘 Cursor MCP Documentation',
          '',
          'Name: cursor-background-agents',
          'Version: 1.0.0',
          'Protocol: 2025-03-26',
          '',
          'Endpoints:',
          '- POST /mcp (JSON-RPC: tools/list, tools/call)',
          '- GET  /sse  (MCP over SSE)',
          '- GET  /health',
          '',
          'Authentication:',
          '- Env: CURSOR_API_KEY',
          '- Header: Authorization: Bearer key_… or x-cursor-api-key / x-api-key',
          '- Token URL: use /connect to mint token, then append ?token=… to /mcp or /sse',
          '',
          'Available Tools:',
          toolLines,
          '',
          'Examples:',
          '- tools/list → {"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}',
          '- tools/call → {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"listAgents","arguments":{"limit":5}}}',
        ].join('\n');

        return createSuccessResponse(markdown, doc);
      } catch (error) {
        return handleMCPError(error, 'documentation');
      }
    },
  });

  return tools;
};