import { cursorApiClient as defaultCursorClient } from '../utils/cursorClient.js';
import { 
  handleMCPError, 
  validateInput, 
  createSuccessResponse,
  schemas, 
} from '../utils/errorHandler.js';
import { hasCodeChanges } from '../utils/gitUtils.js';

export const createTools = (client = defaultCursorClient) => [
  {
    name: 'createAgent',
    description: 'Create a new background agent to work on a repository. Auto-create PR will default to true if code changes are detected.',
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
            autoCreatePr: { type: 'boolean', description: 'Whether to automatically create a pull request when the agent completes. Defaults to true if code changes are detected.' },
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
        
        // Check if autoCreatePr should be set to true based on code changes
        let shouldAutoCreatePr = validatedInput.target?.autoCreatePr;
        if (shouldAutoCreatePr === undefined) {
          // If autoCreatePr is not explicitly set, check for code changes
          const hasChanges = await hasCodeChanges(validatedInput.source.repository);
          shouldAutoCreatePr = hasChanges;
        }
        
        const inputWithDefaults = {
          ...validatedInput,
          model: validatedInput.model || 'default',
          target: {
            ...validatedInput.target,
            autoCreatePr: shouldAutoCreatePr,
          },
        };
        const result = await client.createAgent(inputWithDefaults);
        
        return createSuccessResponse(
          '✅ Successfully created agent!\n' +
          `📋 ID: ${result.id}\n` +
          `📊 Status: ${result.status}\n` +
          `🌐 View: ${result.target.url}\n` +
          `📅 Created: ${new Date(result.createdAt).toLocaleString()}\n` +
          `🔄 Auto-create PR: ${shouldAutoCreatePr ? 'Enabled' : 'Disabled'}${shouldAutoCreatePr && validatedInput.target?.autoCreatePr === undefined ? ' (detected code changes)' : ''}`,
          {
            agentId: result.id,
            status: result.status,
            url: result.target.url,
            createdAt: result.createdAt,
            autoCreatePr: shouldAutoCreatePr,
            autoCreatePrReason: shouldAutoCreatePr && validatedInput.target?.autoCreatePr === undefined ? 'code-changes-detected' : 'explicitly-set',
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