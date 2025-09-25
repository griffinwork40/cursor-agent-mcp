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
    deleteAgent: jest.fn(),
  },
  defaultCursorClient: {
    deleteAgent: jest.fn(),
  },
}));

import { handleMCPError, validateInput, createSuccessResponse, schemas } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('deleteAgent Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.deleteAgent.mockResolvedValue({ id: 'test-agent-id' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const deleteAgentTool = tools.find(tool => tool.name === 'deleteAgent');

  describe('Input Validation', () => {
    test('should validate required agent ID', async () => {
      const invalidInput = {};

      validateInput.mockImplementation(() => {
        throw new ValidationError('Agent ID is required');
      });

      const result = await deleteAgentTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        undefined,
        'deleteAgent'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should accept valid agent ID', async () => {
      const validInput = { id: 'test-agent-id' };

      validateInput.mockReturnValue('test-agent-id');

      const result = await deleteAgentTool.handler(validInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        'test-agent-id',
        'deleteAgent'
      );
      expect(defaultCursorClient.deleteAgent).toHaveBeenCalledWith('test-agent-id');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('API Call Formatting', () => {
    test('should format API call correctly with agent ID', async () => {
      const input = { id: 'test-agent-123' };

      validateInput.mockReturnValue('test-agent-123');

      await deleteAgentTool.handler(input);

      expect(defaultCursorClient.deleteAgent).toHaveBeenCalledWith('test-agent-123');
      expect(defaultCursorClient.deleteAgent).toHaveBeenCalledTimes(1);
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

        defaultCursorClient.deleteAgent.mockRejectedValue(apiError);

        const result = await deleteAgentTool.handler(validInput);

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'deleteAgent'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const validInput = { id: 'test-agent' };

      validateInput.mockReturnValue('test-agent');

      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.deleteAgent.mockRejectedValue(networkError);

      const result = await deleteAgentTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'deleteAgent');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with deletion confirmation', async () => {
      const validInput = { id: 'test-agent-123' };
      const mockResponse = { id: 'test-agent-123' };

      validateInput.mockReturnValue('test-agent-123');
      defaultCursorClient.deleteAgent.mockResolvedValue(mockResponse);
      createSuccessResponse.mockClear();

      const result = await deleteAgentTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('🗑️ Successfully deleted agent!'),
        { deletedAgentId: 'test-agent-123' }
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/🗑️ Successfully deleted agent!/);
      expect(message).toMatch(/🆔 Agent ID: test-agent-123/);
      expect(message).toMatch(/⚠️ This action is permanent and cannot be undone/);
    });
  });
});