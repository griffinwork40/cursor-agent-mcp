import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockError,
  createTestModels,
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
  createSuccessResponse: jest.fn((message, data) => ({
    content: [{ type: 'text', text: message }],
  })),
}));

// Mock the cursorClient module
jest.mock('../../utils/cursorClient.js', () => ({
  defaultCursorClient: {
    listModels: jest.fn(),
  },
  defaultCursorClient: {
    listModels: jest.fn(),
  },
}));

import { handleMCPError, createSuccessResponse } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('listModels Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.listModels.mockResolvedValue(createTestModels());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const listModelsTool = tools.find(tool => tool.name === 'listModels');

  describe('API Call Formatting', () => {
    test('should make API call with no input parameters', async () => {
      const result = await listModelsTool.handler();

      expect(defaultCursorClient.listModels).toHaveBeenCalledWith();
      expect(defaultCursorClient.listModels).toHaveBeenCalledTimes(1);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors with proper error classification', async () => {
      // Test different HTTP status codes
      const testCases = [
        { status: 400, expectedError: ApiError },
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

        defaultCursorClient.listModels.mockRejectedValue(apiError);

        const result = await listModelsTool.handler();

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'listModels'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.listModels.mockRejectedValue(networkError);

      const result = await listModelsTool.handler();

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'listModels');
    });

    test('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Something unexpected happened');
      defaultCursorClient.listModels.mockRejectedValue(unexpectedError);

      const result = await listModelsTool.handler();

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(unexpectedError, 'listModels');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with models list', async () => {
      const mockModels = createTestModels();
      defaultCursorClient.listModels.mockResolvedValue(mockModels);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('🤖 Available Models:'),
        { models: mockModels.models }
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/🤖 Available Models:/);
      expect(message).toMatch(/1\. gpt-4/);
      expect(message).toMatch(/2\. gpt-4-turbo/);
      expect(message).toMatch(/3\. claude-3-sonnet/);
      expect(message).toMatch(/4\. claude-3-haiku/);
      expect(message).toMatch(/📊 Total: 4 models available/);
    });

    test('should handle empty models list', async () => {
      const emptyModels = { models: [] };
      defaultCursorClient.listModels.mockResolvedValue(emptyModels);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('🤖 Available Models:'),
        { models: [] }
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/🤖 Available Models:/);
      expect(message).toMatch(/📊 Total: 0 models available/);
    });

    test('should handle different model names', async () => {
      const customModels = {
        models: [
          'gpt-4o',
          'claude-3.5-sonnet',
          'gemini-pro',
          'llama-2-70b',
          'custom-model-v1',
        ]
      };

      defaultCursorClient.listModels.mockResolvedValue(customModels);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. gpt-4o/);
      expect(message).toMatch(/2\. claude-3.5-sonnet/);
      expect(message).toMatch(/3\. gemini-pro/);
      expect(message).toMatch(/4\. llama-2-70b/);
      expect(message).toMatch(/5\. custom-model-v1/);
      expect(message).toMatch(/📊 Total: 5 models available/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle model names with special characters', async () => {
      const specialModels = {
        models: [
          'model-with-dashes',
          'model_with_underscores',
          'model.with.dots',
          'model-with-numbers-123',
          'model "with quotes"',
          'model/with/slashes',
        ]
      };

      defaultCursorClient.listModels.mockResolvedValue(specialModels);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. model-with-dashes/);
      expect(message).toMatch(/2\. model_with_underscores/);
      expect(message).toMatch(/3\. model\.with\.dots/);
      expect(message).toMatch(/4\. model-with-numbers-123/);
      expect(message).toMatch(/5\. model "with quotes"/);
      expect(message).toMatch(/6\. model\/with\/slashes/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle very long model names', async () => {
      const longModelName = 'a'.repeat(100);
      const modelsWithLongName = {
        models: [longModelName, 'short-model']
      };

      defaultCursorClient.listModels.mockResolvedValue(modelsWithLongName);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(new RegExp(`1\. ${longModelName.substring(0, 50)}`));
      expect(message).toMatch(/2\. short-model/);
      expect(message).toMatch(/📊 Total: 2 models available/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle single model in list', async () => {
      const singleModel = { models: ['gpt-4-only'] };
      defaultCursorClient.listModels.mockResolvedValue(singleModel);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/🤖 Available Models:/);
      expect(message).toMatch(/1\. gpt-4-only/);
      expect(message).toMatch(/📊 Total: 1 models available/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle large number of models', async () => {
      const manyModels = {
        models: Array.from({ length: 50 }, (_, i) => `model-${i + 1}`)
      };

      defaultCursorClient.listModels.mockResolvedValue(manyModels);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/🤖 Available Models:/);
      expect(message).toMatch(/1\. model-1/);
      expect(message).toMatch(/50\. model-50/);
      expect(message).toMatch(/📊 Total: 50 models available/);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty model names gracefully', async () => {
      const modelsWithEmpty = { models: ['', 'valid-model', ''] };
      defaultCursorClient.listModels.mockResolvedValue(modelsWithEmpty);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. /);
      expect(message).toMatch(/2\. valid-model/);
      expect(message).toMatch(/3\. /);
      expect(message).toMatch(/📊 Total: 3 models available/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle models with unicode characters', async () => {
      const unicodeModels = {
        models: [
          '模型-1', // Chinese
          'модель-2', // Russian
          '🤖-model-3', // Emoji
          'model-ñ-4', // Spanish
        ]
      };

      defaultCursorClient.listModels.mockResolvedValue(unicodeModels);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. 模型-1/);
      expect(message).toMatch(/2\. модель-2/);
      expect(message).toMatch(/3\. 🤖-model-3/);
      expect(message).toMatch(/4\. model-ñ-4/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle models with only whitespace', async () => {
      const whitespaceModels = {
        models: ['   ', '\t', '\n', 'valid-model']
      };

      defaultCursorClient.listModels.mockResolvedValue(whitespaceModels);
      createSuccessResponse.mockClear();

      const result = await listModelsTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\.   /);
      expect(message).toMatch(/2\. 	/);
      expect(message).toMatch(/3\. /);
      expect(message).toMatch(/4\. valid-model/);
      expect(result.isError).toBeUndefined();
    });
  });
});