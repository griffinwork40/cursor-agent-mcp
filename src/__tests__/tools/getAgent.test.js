import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockError,
  createTestAgent,
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
    getAgent: jest.fn(),
  },
  defaultCursorClient: {
    getAgent: jest.fn(),
  },
}));

import { handleMCPError, validateInput, createSuccessResponse, schemas } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('getAgent Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.getAgent.mockResolvedValue(createTestAgent());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getAgentTool = tools.find(tool => tool.name === 'getAgent');

  describe('Input Validation', () => {
    test('should validate required agent ID', async () => {
      const invalidInput = {};

      validateInput.mockImplementation(() => {
        throw new ValidationError('Agent ID is required');
      });

      const result = await getAgentTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        undefined,
        'getAgent'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should validate agent ID is not empty string', async () => {
      const invalidInput = { id: '' };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Agent ID cannot be empty');
      });

      const result = await getAgentTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        '',
        'getAgent'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should validate agent ID is not just whitespace', async () => {
      const invalidInput = { id: '   ' };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Agent ID cannot be empty');
      });

      const result = await getAgentTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        '   ',
        'getAgent'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should accept valid agent ID', async () => {
      const validInput = { id: 'test-agent-id' };

      validateInput.mockReturnValue('test-agent-id');
      defaultCursorClient.getAgent.mockResolvedValue(createTestAgent());

      const result = await getAgentTool.handler(validInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        'test-agent-id',
        'getAgent'
      );
      expect(defaultCursorClient.getAgent).toHaveBeenCalledWith('test-agent-id');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('API Call Formatting', () => {
    test('should format API call correctly with agent ID', async () => {
      const input = { id: 'test-agent-123' };

      validateInput.mockReturnValue('test-agent-123');
      defaultCursorClient.getAgent.mockResolvedValue(createTestAgent());

      await getAgentTool.handler(input);

      expect(defaultCursorClient.getAgent).toHaveBeenCalledWith('test-agent-123');
      expect(defaultCursorClient.getAgent).toHaveBeenCalledTimes(1);
    });

    test('should handle different agent ID formats', async () => {
      const testIds = [
        'agent-123',
        'abc-def-ghi',
        'agent_123',
        '123',
        'a-very-long-agent-id-that-might-be-used-in-practice',
      ];

      for (const agentId of testIds) {
        const input = { id: agentId };

        validateInput.mockReturnValue(agentId);
        defaultCursorClient.getAgent.mockResolvedValue(createTestAgent({ id: agentId }));

        await getAgentTool.handler(input);

        expect(defaultCursorClient.getAgent).toHaveBeenCalledWith(agentId);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors properly', async () => {
      const invalidInput = { id: null };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Agent ID cannot be null');
      });

      const result = await getAgentTool.handler(invalidInput);

      expect(handleMCPError).toHaveBeenCalledWith(
        expect.any(ValidationError),
        'getAgent'
      );
      expect(result.isError).toBe(true);
    });

    test('should handle API errors with proper error classification', async () => {
      const validInput = { id: 'test-agent' };

      validateInput.mockReturnValue('test-agent');

      // Test different HTTP status codes
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

        defaultCursorClient.getAgent.mockRejectedValue(apiError);

        const result = await getAgentTool.handler(validInput);

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'getAgent'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const validInput = { id: 'test-agent' };

      validateInput.mockReturnValue('test-agent');

      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.getAgent.mockRejectedValue(networkError);

      const result = await getAgentTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'getAgent');
    });

    test('should handle unexpected errors gracefully', async () => {
      const validInput = { id: 'test-agent' };

      validateInput.mockReturnValue('test-agent');

      const unexpectedError = new Error('Something unexpected happened');
      defaultCursorClient.getAgent.mockRejectedValue(unexpectedError);

      const result = await getAgentTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(unexpectedError, 'getAgent');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with agent details', async () => {
      const validInput = { id: 'test-agent-123' };
      const mockAgent = createTestAgent({
        id: 'test-agent-123',
        name: 'Test Agent',
        status: 'RUNNING',
        createdAt: '2024-01-01T10:00:00Z',
        summary: 'This is a test agent summary',
      });

      validateInput.mockReturnValue('test-agent-123');
      defaultCursorClient.getAgent.mockResolvedValue(mockAgent);
      createSuccessResponse.mockClear();

      const result = await getAgentTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('🤖 Agent Details:'),
        mockAgent
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📋 Name: Test Agent/);
      expect(message).toMatch(/🆔 ID: test-agent-123/);
      expect(message).toMatch(/📊 Status: ⚡ RUNNING/);
      expect(message).toMatch(/📅 Created: 1\/1\/2024/);
      expect(message).toMatch(/📝 Summary: This is a test agent summary/);
    });

    test('should handle different agent statuses with appropriate emojis', async () => {
      const validInput = { id: 'test-agent' };
      const statusEmojiMap = {
        'CREATING': '🔄',
        'RUNNING': '⚡',
        'FINISHED': '✅',
        'ERROR': '❌',
        'EXPIRED': '⏰',
      };

      for (const [status, emoji] of Object.entries(statusEmojiMap)) {
        const mockAgent = createTestAgent({ status });

        validateInput.mockReturnValue('test-agent');
        defaultCursorClient.getAgent.mockResolvedValue(mockAgent);
        createSuccessResponse.mockClear();

        const result = await getAgentTool.handler(validInput);

        const message = createSuccessResponse.mock.calls[0][0];
        expect(message).toMatch(new RegExp(`📊 Status: ${emoji} ${status}`));
        expect(result.isError).toBeUndefined();
      }
    });

    test('should handle null or undefined summary gracefully', async () => {
      const validInput = { id: 'test-agent' };
      const mockAgent = createTestAgent({
        summary: null,
      });

      validateInput.mockReturnValue('test-agent');
      defaultCursorClient.getAgent.mockResolvedValue(mockAgent);
      createSuccessResponse.mockClear();

      const result = await getAgentTool.handler(validInput);

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📝 Summary: No summary yet/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle null or undefined branch name gracefully', async () => {
      const validInput = { id: 'test-agent' };
      const mockAgent = createTestAgent({
        target: {
          branchName: null,
        },
      });

      validateInput.mockReturnValue('test-agent');
      defaultCursorClient.getAgent.mockResolvedValue(mockAgent);
      createSuccessResponse.mockClear();

      const result = await getAgentTool.handler(validInput);

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/🌿 Branch: N\/A/);
      expect(result.isError).toBeUndefined();
    });

    test('should format creation date properly', async () => {
      const validInput = { id: 'test-agent' };
      const testDates = [
        '2024-01-01T10:00:00Z',
        '2024-12-31T23:59:59Z',
        '2024-06-15T14:30:45Z',
      ];

      for (const dateString of testDates) {
        const mockAgent = createTestAgent({
          createdAt: dateString,
        });

        validateInput.mockReturnValue('test-agent');
        defaultCursorClient.getAgent.mockResolvedValue(mockAgent);
        createSuccessResponse.mockClear();

        const result = await getAgentTool.handler(validInput);

        const message = createSuccessResponse.mock.calls[0][0];
        // Should contain formatted date parts
        expect(message).toMatch(/📅 Created:/);
        expect(result.isError).toBeUndefined();
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long agent IDs', async () => {
      const longAgentId = 'a'.repeat(1000);
      const validInput = { id: longAgentId };

      validateInput.mockReturnValue(longAgentId);
      defaultCursorClient.getAgent.mockResolvedValue(createTestAgent({ id: longAgentId }));

      const result = await getAgentTool.handler(validInput);

      expect(defaultCursorClient.getAgent).toHaveBeenCalledWith(longAgentId);
      expect(result.isError).toBeUndefined();
    });

    test('should handle agent IDs with special characters', async () => {
      const specialAgentIds = [
        'agent-with-dashes',
        'agent_with_underscores',
        'agent.with.dots',
        'agent-with-numbers-123',
        'agent@symbol',
        'agent#hash',
      ];

      for (const agentId of specialAgentIds) {
        const validInput = { id: agentId };

        validateInput.mockReturnValue(agentId);
        defaultCursorClient.getAgent.mockResolvedValue(createTestAgent({ id: agentId }));

        const result = await getAgentTool.handler(validInput);

        expect(defaultCursorClient.getAgent).toHaveBeenCalledWith(agentId);
        expect(result.isError).toBeUndefined();
      }
    });

    test('should handle agent names with special characters', async () => {
      const validInput = { id: 'test-agent' };
      const specialNames = [
        'Agent with spaces',
        'Agent-with-dashes',
        'Agent_with_underscores',
        'Agent.with.dots',
        'Agent "with quotes"',
        'Agent \'with apostrophe\'',
        'Agent & symbols!',
      ];

      for (const agentName of specialNames) {
        const mockAgent = createTestAgent({ name: agentName });

        validateInput.mockReturnValue('test-agent');
        defaultCursorClient.getAgent.mockResolvedValue(mockAgent);
        createSuccessResponse.mockClear();

        const result = await getAgentTool.handler(validInput);

        const message = createSuccessResponse.mock.calls[0][0];
        expect(message).toMatch(new RegExp(`📋 Name: ${agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        expect(result.isError).toBeUndefined();
      }
    });

    test('should handle empty agent name gracefully', async () => {
      const validInput = { id: 'test-agent' };
      const mockAgent = createTestAgent({ name: '' });

      validateInput.mockReturnValue('test-agent');
      defaultCursorClient.getAgent.mockResolvedValue(mockAgent);
      createSuccessResponse.mockClear();

      const result = await getAgentTool.handler(validInput);

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📋 Name: /);
      expect(result.isError).toBeUndefined();
    });
  });
});