import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockResponse,
  createMockError,
  createTestAgentList,
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
    listAgentsParams: {
      parse: jest.fn(),
    },
  },
}));

// Mock the cursorClient module
jest.mock('../../utils/cursorClient.js', () => ({
  defaultCursorClient: {
    listAgents: jest.fn(),
  },
  defaultCursorClient: {
    listAgents: jest.fn(),
  },
}));

import { handleMCPError, validateInput, createSuccessResponse, schemas } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('listAgents Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const listAgentsTool = tools.find(tool => tool.name === 'listAgents');

  describe('Input Validation', () => {
    test('should accept valid input with no parameters', async () => {
      const validInput = {};

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList());

      const result = await listAgentsTool.handler(validInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.listAgentsParams,
        validInput,
        'listAgents'
      );
      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith(validInput);
      expect(result.isError).toBeUndefined();
    });

    test('should validate limit parameter - minimum value', async () => {
      const invalidInput = { limit: 0 };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Limit must be between 1 and 100');
      });

      const result = await listAgentsTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.listAgentsParams,
        invalidInput,
        'listAgents'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should validate limit parameter - maximum value', async () => {
      const invalidInput = { limit: 101 };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Limit must be between 1 and 100');
      });

      const result = await listAgentsTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalled();
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should accept valid limit parameter', async () => {
      const validInput = { limit: 50 };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(5));

      const result = await listAgentsTool.handler(validInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.listAgentsParams,
        validInput,
        'listAgents'
      );
      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith(validInput);
      expect(result.isError).toBeUndefined();
    });

    test('should accept valid cursor parameter', async () => {
      const validInput = { cursor: 'next-page-cursor' };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(2));

      const result = await listAgentsTool.handler(validInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.listAgentsParams,
        validInput,
        'listAgents'
      );
      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith(validInput);
      expect(result.isError).toBeUndefined();
    });

    test('should accept both limit and cursor parameters', async () => {
      const validInput = { limit: 25, cursor: 'pagination-cursor' };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(3));

      const result = await listAgentsTool.handler(validInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.listAgentsParams,
        validInput,
        'listAgents'
      );
      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith(validInput);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('API Call Formatting', () => {
    test('should format API call correctly with no parameters', async () => {
      const input = {};

      validateInput.mockReturnValue(input);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList());

      await listAgentsTool.handler(input);

      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith({});
      expect(defaultCursorClient.listAgents).toHaveBeenCalledTimes(1);
    });

    test('should format API call correctly with limit only', async () => {
      const input = { limit: 10 };

      validateInput.mockReturnValue(input);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(5));

      await listAgentsTool.handler(input);

      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith({ limit: 10 });
    });

    test('should format API call correctly with cursor only', async () => {
      const input = { cursor: 'abc123' };

      validateInput.mockReturnValue(input);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(2));

      await listAgentsTool.handler(input);

      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith({ cursor: 'abc123' });
    });

    test('should format API call correctly with both parameters', async () => {
      const input = { limit: 5, cursor: 'def456' };

      validateInput.mockReturnValue(input);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(3));

      await listAgentsTool.handler(input);

      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith({
        limit: 5,
        cursor: 'def456'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors properly', async () => {
      const invalidInput = { limit: -1 };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Limit must be a positive integer');
      });

      const result = await listAgentsTool.handler(invalidInput);

      expect(handleMCPError).toHaveBeenCalledWith(
        expect.any(ValidationError),
        'listAgents'
      );
      expect(result.isError).toBe(true);
    });

    test('should handle API errors with proper error classification', async () => {
      const validInput = { limit: 10 };

      validateInput.mockReturnValue(validInput);

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

        defaultCursorClient.listAgents.mockRejectedValue(apiError);

        const result = await listAgentsTool.handler(validInput);

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'listAgents'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const validInput = { limit: 5 };

      validateInput.mockReturnValue(validInput);

      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.listAgents.mockRejectedValue(networkError);

      const result = await listAgentsTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'listAgents');
    });

    test('should handle unexpected errors gracefully', async () => {
      const validInput = { cursor: 'test-cursor' };

      validateInput.mockReturnValue(validInput);

      const unexpectedError = new Error('Something unexpected happened');
      defaultCursorClient.listAgents.mockRejectedValue(unexpectedError);

      const result = await listAgentsTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(unexpectedError, 'listAgents');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with agent list', async () => {
      const validInput = {};
      const mockAgentList = createTestAgentList(3);

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('📋 Found 3 agent(s):'),
        expect.objectContaining({
          count: 3,
          agents: mockAgentList.agents,
          nextCursor: mockAgentList.nextCursor,
        })
      );
      expect(result.isError).toBeUndefined();
    });

    test('should format response when no agents exist', async () => {
      const validInput = {};
      const emptyAgentList = createTestAgentList(0);

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(emptyAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('📋 Found 0 agent(s):'),
        expect.objectContaining({
          count: 0,
          agents: [],
          nextCursor: null,
        })
      );
      expect(result.isError).toBeUndefined();
    });

    test('should format agent list with proper formatting', async () => {
      const validInput = { limit: 2 };
      const mockAgents = createTestAgentList(2);

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgents);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      const expectedMessage = expect.stringContaining('📋 Found 2 agent(s):');
      const expectedMessageWithBullets = expect.stringContaining('• Test Agent 0');
      const expectedMessageWithBullets2 = expect.stringContaining('• Test Agent 1');

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📋 Found 2 agent\(s\):/);
      expect(message).toMatch(/• Test Agent 0/);
      expect(message).toMatch(/• Test Agent 1/);
      expect(result.isError).toBeUndefined();
    });

    test('should include next cursor in response when available', async () => {
      const validInput = { limit: 5 };
      const mockAgentList = createTestAgentList(5); // This should have a nextCursor

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('📄 Next cursor: next-page-cursor'),
        expect.objectContaining({
          nextCursor: 'next-page-cursor',
        })
      );
      expect(result.isError).toBeUndefined();
    });

    test('should indicate no next cursor when null', async () => {
      const validInput = { limit: 2 };
      const mockAgentList = createTestAgentList(2); // This should have no nextCursor

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('📄 Next cursor: none'),
        expect.objectContaining({
          nextCursor: null,
        })
      );
      expect(result.isError).toBeUndefined();
    });

    test('should handle different agent statuses in response', async () => {
      const validInput = { limit: 3 };
      const mockAgentList = {
        agents: [
          { ...createTestAgentList(1).agents[0], status: 'CREATING' },
          { ...createTestAgentList(1).agents[0], id: 'agent-2', status: 'RUNNING' },
          { ...createTestAgentList(1).agents[0], id: 'agent-3', status: 'FINISHED' },
        ],
        nextCursor: null,
      };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/CREATING/);
      expect(message).toMatch(/RUNNING/);
      expect(message).toMatch(/FINISHED/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle agents with different creation dates', async () => {
      const validInput = { limit: 2 };
      const mockAgentList = {
        agents: [
          {
            ...createTestAgentList(1).agents[0],
            id: 'agent-1',
            createdAt: '2024-01-01T10:00:00Z',
          },
          {
            ...createTestAgentList(1).agents[0],
            id: 'agent-2',
            createdAt: '2024-01-02T15:30:00Z',
          },
        ],
        nextCursor: null,
      };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\/1\/2024/); // First agent date
      expect(message).toMatch(/1\/2\/2024/); // Second agent date
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle maximum limit value', async () => {
      const validInput = { limit: 100 };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(100));

      const result = await listAgentsTool.handler(validInput);

      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith({ limit: 100 });
      expect(result.isError).toBeUndefined();
    });

    test('should handle very long cursor strings', async () => {
      const longCursor = 'a'.repeat(1000);
      const validInput = { cursor: longCursor };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(createTestAgentList(1));

      const result = await listAgentsTool.handler(validInput);

      expect(defaultCursorClient.listAgents).toHaveBeenCalledWith({ cursor: longCursor });
      expect(result.isError).toBeUndefined();
    });

    test('should handle special characters in agent names', async () => {
      const mockAgentList = {
        agents: [
          {
            ...createTestAgentList(1).agents[0],
            id: 'agent-1',
            name: 'Agent with-special chars_123 & symbols!',
          },
        ],
        nextCursor: null,
      };

      const validInput = {};

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      expect(result.isError).toBeUndefined();
      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/Agent with-special chars_123 & symbols!/);
    });

    test('should handle empty agent summary gracefully', async () => {
      const mockAgentList = {
        agents: [
          {
            ...createTestAgentList(1).agents[0],
            id: 'agent-1',
            status: 'FINISHED',
            summary: null,
          },
        ],
        nextCursor: null,
      };

      const validInput = {};

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.listAgents.mockResolvedValue(mockAgentList);
      createSuccessResponse.mockClear();

      const result = await listAgentsTool.handler(validInput);

      expect(result.isError).toBeUndefined();
      // Should still work even with null summary
    });
  });
});