import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockResponse,
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
    createAgentRequest: {
      parse: jest.fn(),
    },
  },
}));

// Mock the cursorClient module
jest.mock('../../utils/cursorClient.js', () => ({
  defaultCursorClient: {
    createAgent: jest.fn(),
  },
  defaultCursorClient: {
    createAgent: jest.fn(),
  },
}));

import { handleMCPError, validateInput, createSuccessResponse, schemas } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('createAgent Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createAgentTool = tools.find(tool => tool.name === 'createAgent');

  describe('Input Validation', () => {
    test('should validate required prompt field', async () => {
      const invalidInput = {
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Prompt text is required');
      });

      const result = await createAgentTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.createAgentRequest,
        invalidInput,
        'createAgent'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should validate required source.repository field', async () => {
      const invalidInput = {
        prompt: { text: 'Create a hello world function' },
        model: 'gpt-4',
      };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Repository is required');
      });

      const result = await createAgentTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.createAgentRequest,
        invalidInput,
        'createAgent'
      );
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should set default model when not provided', async () => {
      const inputWithoutModel = {
        prompt: { text: 'Create a hello world function' },
        source: { repository: 'https://github.com/test/repo' },
      };

      validateInput.mockImplementation((schema, data) => {
        if (schema === schemas.createAgentRequest) {
          return { ...data, model: 'default' };
        }
        return data;
      });

      defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());

      const result = await createAgentTool.handler(inputWithoutModel);

      expect(validateInput).toHaveBeenCalledWith(
        schemas.createAgentRequest,
        inputWithoutModel,
        'createAgent'
      );
      expect(defaultCursorClient.createAgent).toHaveBeenCalledWith({
        ...inputWithoutModel,
        model: 'default',
      });
      expect(result.isError).toBeUndefined();
    });

    test('should validate prompt text is not empty', async () => {
      const invalidInput = {
        prompt: { text: '' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Prompt text cannot be empty');
      });

      const result = await createAgentTool.handler(invalidInput);

      expect(validateInput).toHaveBeenCalled();
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should validate image data format when images are provided', async () => {
      const inputWithInvalidImage = {
        prompt: {
          text: 'Create a function with image',
          images: [
            {
              data: '', // Invalid empty data
              dimension: { width: 100, height: 100 },
            },
          ],
        },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Image data cannot be empty');
      });

      const result = await createAgentTool.handler(inputWithInvalidImage);

      expect(validateInput).toHaveBeenCalled();
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });

    test('should validate webhook URL format', async () => {
      const inputWithInvalidWebhook = {
        prompt: { text: 'Create a hello world function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
        webhook: { url: 'not-a-valid-url' },
      };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Invalid webhook URL');
      });

      const result = await createAgentTool.handler(inputWithInvalidWebhook);

      expect(validateInput).toHaveBeenCalled();
      expect(handleMCPError).toHaveBeenCalled();
      expect(result.isError).toBe(true);
    });
  });

  describe('API Call Formatting', () => {
    test('should format API call correctly with all required fields', async () => {
      const validInput = {
        prompt: { text: 'Create a hello world function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      const expectedApiCallData = {
        ...validInput,
        model: 'default', // Should be set by validation
      };

      validateInput.mockReturnValue(expectedApiCallData);
      defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());

      await createAgentTool.handler(validInput);

      expect(defaultCursorClient.createAgent).toHaveBeenCalledWith(expectedApiCallData);
      expect(defaultCursorClient.createAgent).toHaveBeenCalledTimes(1);
    });

    test('should include optional fields when provided', async () => {
      const validInput = {
        prompt: {
          text: 'Create a complex function',
          images: [
            {
              data: 'base64-image-data',
              dimension: { width: 100, height: 100 },
            },
          ],
        },
        source: {
          repository: 'https://github.com/test/repo',
          ref: 'develop',
        },
        model: 'claude-3-sonnet',
        target: {
          autoCreatePr: true,
          branchName: 'feature-branch',
        },
        webhook: {
          url: 'https://webhook.example.com/cursor',
          secret: 'very-long-secret-key-at-least-32-characters',
        },
      };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());

      await createAgentTool.handler(validInput);

      expect(defaultCursorClient.createAgent).toHaveBeenCalledWith(validInput);
    });

    test('should handle empty optional fields gracefully', async () => {
      const validInput = {
        prompt: { text: 'Create a simple function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
        target: {}, // Empty target object
        webhook: { url: 'https://webhook.example.com' }, // No secret
      };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());

      await createAgentTool.handler(validInput);

      expect(defaultCursorClient.createAgent).toHaveBeenCalledWith(validInput);
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors properly', async () => {
      const invalidInput = {
        prompt: { text: '' }, // Empty text should fail
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockImplementation(() => {
        throw new ValidationError('Prompt text cannot be empty');
      });

      const result = await createAgentTool.handler(invalidInput);

      expect(handleMCPError).toHaveBeenCalledWith(
        expect.any(ValidationError),
        'createAgent'
      );
      expect(result.isError).toBe(true);
    });

    test('should handle API errors with proper error classification', async () => {
      const validInput = {
        prompt: { text: 'Create a function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

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

        defaultCursorClient.createAgent.mockRejectedValue(apiError);

        const result = await createAgentTool.handler(validInput);

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'createAgent'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const validInput = {
        prompt: { text: 'Create a function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockReturnValue(validInput);

      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.createAgent.mockRejectedValue(networkError);

      const result = await createAgentTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'createAgent');
    });

    test('should handle unexpected errors gracefully', async () => {
      const validInput = {
        prompt: { text: 'Create a function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockReturnValue(validInput);

      const unexpectedError = new Error('Something unexpected happened');
      defaultCursorClient.createAgent.mockRejectedValue(unexpectedError);

      const result = await createAgentTool.handler(validInput);

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(unexpectedError, 'createAgent');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with agent details', async () => {
      const validInput = {
        prompt: { text: 'Create a hello world function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      const mockAgent = createTestAgent({
        id: 'unique-agent-id',
        status: 'CREATING',
        createdAt: '2024-01-01T10:00:00Z',
      });

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(mockAgent);
      createSuccessResponse.mockClear();

      const result = await createAgentTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully created agent!'),
        expect.objectContaining({
          agentId: mockAgent.id,
          status: mockAgent.status,
          url: mockAgent.target.url,
          createdAt: mockAgent.createdAt,
        })
      );
      expect(result.isError).toBeUndefined();
    });

    test('should handle different agent statuses in response', async () => {
      const validInput = {
        prompt: { text: 'Create a function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      const testStatuses = ['CREATING', 'RUNNING', 'FINISHED', 'ERROR', 'EXPIRED'];

      for (const status of testStatuses) {
        const mockAgent = createTestAgent({ status });
        validateInput.mockReturnValue(validInput);
        defaultCursorClient.createAgent.mockResolvedValue(mockAgent);
        createSuccessResponse.mockClear();

        const result = await createAgentTool.handler(validInput);

        expect(createSuccessResponse).toHaveBeenCalledWith(
          expect.stringContaining(`📊 Status: ${status}`),
          expect.objectContaining({ status })
        );
        expect(result.isError).toBeUndefined();
      }
    });

    test('should format response with repository and branch information', async () => {
      const validInput = {
        prompt: { text: 'Create a function' },
        source: {
          repository: 'https://github.com/test/repo',
          ref: 'feature-branch',
        },
        model: 'gpt-4',
      };

      const mockAgent = createTestAgent({
        source: {
          repository: 'https://github.com/test/repo',
          ref: 'feature-branch',
        },
        target: {
          branchName: 'agent-feature-branch',
        },
      });

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(mockAgent);
      createSuccessResponse.mockClear();

      const result = await createAgentTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('🔗 Repository: https://github.com/test/repo'),
        expect.any(Object)
      );
      expect(result.isError).toBeUndefined();
    });

    test('should handle null/undefined optional response fields', async () => {
      const validInput = {
        prompt: { text: 'Create a function' },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      const mockAgent = createTestAgent({
        summary: null,
        target: {
          branchName: null,
        },
      });

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(mockAgent);
      createSuccessResponse.mockClear();

      const result = await createAgentTool.handler(validInput);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('📝 Summary: No summary yet'),
        expect.any(Object)
      );
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long prompt text', async () => {
      const longPrompt = 'a'.repeat(10000);
      const validInput = {
        prompt: { text: longPrompt },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());

      const result = await createAgentTool.handler(validInput);

      expect(defaultCursorClient.createAgent).toHaveBeenCalledWith(validInput);
      expect(result.isError).toBeUndefined();
    });

    test('should handle special characters in repository URL', async () => {
      const specialRepoUrl = 'https://github.com/test/repo-with-special-chars_123';
      const validInput = {
        prompt: { text: 'Create a function' },
        source: { repository: specialRepoUrl },
        model: 'gpt-4',
      };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());

      const result = await createAgentTool.handler(validInput);

      expect(defaultCursorClient.createAgent).toHaveBeenCalledWith(validInput);
      expect(result.isError).toBeUndefined();
    });

    test('should handle multiple images in prompt', async () => {
      const validInput = {
        prompt: {
          text: 'Create a function with multiple images',
          images: [
            {
              data: 'base64-image-1',
              dimension: { width: 100, height: 100 },
            },
            {
              data: 'base64-image-2',
              dimension: { width: 200, height: 150 },
            },
            {
              data: 'base64-image-3',
              dimension: { width: 300, height: 200 },
            },
          ],
        },
        source: { repository: 'https://github.com/test/repo' },
        model: 'gpt-4',
      };

      validateInput.mockReturnValue(validInput);
      defaultCursorClient.createAgent.mockResolvedValue(createTestAgent());

      const result = await createAgentTool.handler(validInput);

      expect(defaultCursorClient.createAgent).toHaveBeenCalledWith(validInput);
      expect(result.isError).toBeUndefined();
    });
  });
});