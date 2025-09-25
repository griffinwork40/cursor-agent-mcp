import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockError,
  createTestApiKeyInfo,
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
    getMe: jest.fn(),
  },
  defaultCursorClient: {
    getMe: jest.fn(),
  },
}));

import { handleMCPError, createSuccessResponse } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('getMe Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.getMe.mockResolvedValue(createTestApiKeyInfo());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getMeTool = tools.find(tool => tool.name === 'getMe');

  describe('API Call Formatting', () => {
    test('should make API call with no input parameters', async () => {
      const result = await getMeTool.handler();

      expect(defaultCursorClient.getMe).toHaveBeenCalledWith();
      expect(defaultCursorClient.getMe).toHaveBeenCalledTimes(1);
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

        defaultCursorClient.getMe.mockRejectedValue(apiError);

        const result = await getMeTool.handler();

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'getMe'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.getMe.mockRejectedValue(networkError);

      const result = await getMeTool.handler();

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'getMe');
    });

    test('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Something unexpected happened');
      defaultCursorClient.getMe.mockRejectedValue(unexpectedError);

      const result = await getMeTool.handler();

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(unexpectedError, 'getMe');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with API key information', async () => {
      const mockApiKeyInfo = createTestApiKeyInfo();
      defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
      createSuccessResponse.mockClear();

      const result = await getMeTool.handler();

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('🔑 API Key Information:'),
        mockApiKeyInfo
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📋 Name: Test API Key/);
      expect(message).toMatch(/📅 Created: 1\/1\/2024/);
      expect(message).toMatch(/👤 User Email: test@example.com/);
    });

    test('should handle null or undefined user email gracefully', async () => {
      const mockApiKeyInfo = createTestApiKeyInfo();
      mockApiKeyInfo.userEmail = null;

      defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
      createSuccessResponse.mockClear();

      const result = await getMeTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/👤 User Email: Not available/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle different API key names', async () => {
      const testNames = [
        'Production API Key',
        'Development Key',
        'My Personal API Key',
        'CI/CD Key',
      ];

      for (const apiKeyName of testNames) {
        const mockApiKeyInfo = createTestApiKeyInfo();
        mockApiKeyInfo.apiKeyName = apiKeyName;

        defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
        createSuccessResponse.mockClear();

        const result = await getMeTool.handler();

        const message = createSuccessResponse.mock.calls[0][0];
        expect(message).toMatch(new RegExp(`📋 Name: ${apiKeyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        expect(result.isError).toBeUndefined();
      }
    });

    test('should format different creation dates properly', async () => {
      const testDates = [
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z',
        '2024-06-15T14:30:45Z',
        '2023-03-10T09:15:30Z',
      ];

      for (const dateString of testDates) {
        const mockApiKeyInfo = createTestApiKeyInfo();
        mockApiKeyInfo.createdAt = dateString;

        defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
        createSuccessResponse.mockClear();

        const result = await getMeTool.handler();

        const message = createSuccessResponse.mock.calls[0][0];
        expect(message).toMatch(/📅 Created:/);
        expect(result.isError).toBeUndefined();
      }
    });

    test('should handle different user email formats', async () => {
      const testEmails = [
        'user@example.com',
        'test.user@company.org',
        'user+tag@domain.co.uk',
        '123@numbers.com',
      ];

      for (const email of testEmails) {
        const mockApiKeyInfo = createTestApiKeyInfo();
        mockApiKeyInfo.userEmail = email;

        defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
        createSuccessResponse.mockClear();

        const result = await getMeTool.handler();

        const message = createSuccessResponse.mock.calls[0][0];
        expect(message).toMatch(new RegExp(`👤 User Email: ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        expect(result.isError).toBeUndefined();
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle API key names with special characters', async () => {
      const specialNames = [
        'API Key "with quotes"',
        'API Key \'with apostrophe\'',
        'API Key & special chars!',
        'API Key-with-dashes',
        'API Key_with_underscores',
        'API Key.with.dots',
      ];

      for (const apiKeyName of specialNames) {
        const mockApiKeyInfo = createTestApiKeyInfo();
        mockApiKeyInfo.apiKeyName = apiKeyName;

        defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
        createSuccessResponse.mockClear();

        const result = await getMeTool.handler();

        const message = createSuccessResponse.mock.calls[0][0];
        expect(message).toMatch(new RegExp(`📋 Name: ${apiKeyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
        expect(result.isError).toBeUndefined();
      }
    });

    test('should handle empty API key name gracefully', async () => {
      const mockApiKeyInfo = createTestApiKeyInfo();
      mockApiKeyInfo.apiKeyName = '';

      defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
      createSuccessResponse.mockClear();

      const result = await getMeTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📋 Name: /);
      expect(result.isError).toBeUndefined();
    });

    test('should handle very long API key names', async () => {
      const longName = 'a'.repeat(1000);
      const mockApiKeyInfo = createTestApiKeyInfo();
      mockApiKeyInfo.apiKeyName = longName;

      defaultCursorClient.getMe.mockResolvedValue(mockApiKeyInfo);
      createSuccessResponse.mockClear();

      const result = await getMeTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(new RegExp(`📋 Name: ${longName.substring(0, 50)}`));
      expect(result.isError).toBeUndefined();
    });
  });
});