import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockError,
  createTestConversation,
  ValidationError,
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ConflictError,
} from '../setup.js';

// Mock the errorHandler module
jest.mock('../../utils/errorHandler.js', () => ({
  handleMCPError: jest.fn((error) => ({
    content: [{ type: 'text', text: `Error: ${error.message}` }],
    isError: true,
  })),
  validateInput: jest.fn(),
  createSuccessResponse: jest.fn((message, data) => ({
    content: [{ type: 'text', text: message }],
  })),
  schemas: {
    agentId: {
      parse: jest.fn(),
    },
  },
}));

// Mock the cursorClient module
jest.mock('../../utils/cursorClient.js', () => ({
  defaultCursorClient: {
    getAgentConversation: jest.fn(),
  },
  defaultCursorClient: {
    getAgentConversation: jest.fn(),
  },
}));

import { handleMCPError, validateInput, createSuccessResponse, schemas } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('getAgentConversation Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.getAgentConversation.mockResolvedValue(createTestConversation());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getAgentConversationTool = tools.find(tool => tool.name === 'getAgentConversation');

  describe('Input Validation', () => {
    test('should validate required agent ID', async () => {
      const invalidInput = {};

      validateInput.mockImplementation(() => {
        throw new ValidationError('Agent ID is required');
      });

      const result = await getAgentConversationTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        undefined,
        'getAgentConversation'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should accept valid agent ID', async () => {
      const validInput = { id: 'test-agent-id' };

      validateInput.mockReturnValue('test-agent-id');

      const result = await getAgentConversationTool.handler(validInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        'test-agent-id',
        'getAgentConversation'
      );
      expect(defaultCursorClient.getAgentConversation).toHaveBeenCalledWith('test-agent-id');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('API Call Formatting', () => {
    test('should format API call correctly with agent ID', async () => {
      const input = { id: 'test-agent-123' };

      validateInput.mockReturnValue('test-agent-123');

      await getAgentConversationTool.handler(input);

      expect(defaultCursorClient.getAgentConversation).toHaveBeenCalledWith('test-agent-123');
      expect(defaultCursorClient.getAgentConversation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors with proper error classification', async () => {
      const validInput = { id: 'test-agent' };

      validateInput.mockReturnValue('test-agent');

      const testCases = [
        { status: 400, expectedError: ValidationError },
        { status: 401, expectedError: AuthenticationError },
        { status: 403, expectedError: AuthorizationError },
        { status: 404, expectedError: NotFoundError },
        { status: 409, expectedError: ConflictError },
        { status: 429, expectedError: RateLimitError },
        { status: 500, expectedError: ApiError },
      ];

      for (const { status, expectedError } of testCases) {
        const apiError = createMockError('API Error', status, {
          error: { message: 'Test error', code: 'TEST_ERROR' }
        });

        defaultCursorClient.getAgentConversation.mockRejectedValue(apiError);

        const result = await getAgentConversationTool.handler(validInput);

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'getAgentConversation'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const validInput = { id: 'test-agent' };

      validateInput.mockReturnValue('test-agent');

      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.getAgentConversation.mockRejectedValue(networkError);

      const result = await getAgentConversationTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'getAgentConversation');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with conversation data', async () => {
      const validInput = { id: 'test-agent-123' };
      const mockConversation = createTestConversation();

      validateInput.mockReturnValue('test-agent-123');
      defaultCursorClient.getAgentConversation.mockResolvedValue(mockConversation);
      createSuccessResponse.mockClear();

      const result = await getAgentConversationTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('💬 Agent Conversation (2 messages):'),
        {
          agentId: 'test-agent-id',
          messageCount: 2,
          messages: mockConversation.messages,
        }
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/💬 Agent Conversation \(2 messages\):/);
      expect(message).toMatch(/👤 User: Create a hello world function/);
      expect(message).toMatch(/🤖 Assistant: I created the hello world function successfully/);
      expect(message).toMatch(/📊 Total messages: 2/);
    });

    test('should handle conversations with different message types', async () => {
      const validInput = { id: 'test-agent' };
      const customConversation = {
        id: 'test-agent',
        messages: [
          { type: 'user_message', text: 'User message 1' },
          { type: 'assistant_message', text: 'Assistant response 1' },
          { type: 'user_message', text: 'User message 2' },
          { type: 'assistant_message', text: 'Assistant response 2' },
        ]
      };

      validateInput.mockReturnValue('test-agent');
      defaultCursorClient.getAgentConversation.mockResolvedValue(customConversation);
      createSuccessResponse.mockClear();

      const result = await getAgentConversationTool.handler(validInput);

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/👤 User: User message 1/);
      expect(message).toMatch(/🤖 Assistant: Assistant response 1/);
      expect(message).toMatch(/👤 User: User message 2/);
      expect(message).toMatch(/🤖 Assistant: Assistant response 2/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle long messages with truncation', async () => {
      const validInput = { id: 'test-agent' };
      const longMessage = 'a'.repeat(200);
      const conversationWithLongMessage = {
        id: 'test-agent',
        messages: [
          { type: 'user_message', text: longMessage },
          { type: 'assistant_message', text: 'Short response' },
        ]
      };

      validateInput.mockReturnValue('test-agent');
      defaultCursorClient.getAgentConversation.mockResolvedValue(conversationWithLongMessage);
      createSuccessResponse.mockClear();

      const result = await getAgentConversationTool.handler(validInput);

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(new RegExp(`👤 User: ${longMessage.substring(0, 80)}`));
      expect(message).toMatch(/🤖 Assistant: Short response/);
      expect(result.isError).toBeUndefined();
    });
  });
});