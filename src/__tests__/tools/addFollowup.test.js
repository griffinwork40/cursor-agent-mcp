import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockError,
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
    addFollowupRequest: {
      parse: jest.fn(),
    },
  },
}));

// Mock the cursorClient module
jest.mock('../../utils/cursorClient.js', () => ({
  defaultCursorClient: {
    addFollowup: jest.fn(),
  },
  defaultCursorClient: {
    addFollowup: jest.fn(),
  },
}));

import { handleMCPError, validateInput, createSuccessResponse, schemas } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('addFollowup Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.addFollowup.mockResolvedValue({ id: 'test-agent-id' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const addFollowupTool = tools.find(tool => tool.name === 'addFollowup');

  describe('Input Validation', () => {
    test('should validate required agent ID and prompt', async () => {
      const invalidInput = {};

      validateInput.mockImplementation((schema, data, context) => {
        if (context === 'addFollowup' && schema === schemas.agentId) {
          throw new ValidationError('Agent ID is required');
        }
        if (context === 'addFollowup' && schema === schemas.addFollowupRequest) {
          throw new ValidationError('Prompt is required');
        }
        return data;
      });

      const result = await addFollowupTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.agentId,
        undefined,
        'addFollowup'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should accept valid input with agent ID and prompt', async () => {
      const validInput = {
        id: 'test-agent-id',
        prompt: { text: 'Add this followup instruction' }
      };

      validateInput.mockReturnValueOnce('test-agent-id');
      validateInput.mockReturnValueOnce(validInput);

      const result = await addFollowupTool.handler(validInput);

      expect(defaultCursorClient.addFollowup).toHaveBeenCalledWith('test-agent-id', validInput);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('API Call Formatting', () => {
    test('should format API call correctly with agent ID and followup data', async () => {
      const input = {
        id: 'test-agent-123',
        prompt: { text: 'Followup instruction' }
      };

      validateInput.mockReturnValueOnce('test-agent-123');
      validateInput.mockReturnValueOnce(input);

      await addFollowupTool.handler(input);

      expect(defaultCursorClient.addFollowup).toHaveBeenCalledWith('test-agent-123', input);
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors with proper error classification', async () => {
      const validInput = {
        id: 'test-agent',
        prompt: { text: 'Test followup' }
      };

      validateInput.mockReturnValueOnce('test-agent');
      validateInput.mockReturnValueOnce(validInput);

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

        defaultCursorClient.addFollowup.mockRejectedValue(apiError);

        const result = await addFollowupTool.handler(validInput);

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'addFollowup'
        );
      }
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with followup confirmation', async () => {
      const validInput = {
        id: 'test-agent-123',
        prompt: { text: 'This is a long followup instruction that should be truncated in the response message' }
      };
      const mockResponse = { id: 'test-agent-123' };

      validateInput.mockReturnValueOnce('test-agent-123');
      validateInput.mockReturnValueOnce(validInput);
      defaultCursorClient.addFollowup.mockResolvedValue(mockResponse);
      createSuccessResponse.mockClear();

      const result = await addFollowupTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('💬 Successfully added followup!'),
        { agentId: 'test-agent-123', followupText: validInput.prompt.text }
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/💬 Successfully added followup!/);
      expect(message).toMatch(/🆔 Agent ID: test-agent-123/);
      expect(message).toMatch(/📝 Followup: This is a long followup instruction/);
    });
  });
});