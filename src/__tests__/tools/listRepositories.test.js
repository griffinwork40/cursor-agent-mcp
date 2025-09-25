import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTools } from '../../tools/index.js';
import {
  createMockClient,
  createMockError,
  createTestRepositories,
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
    listRepositories: jest.fn(),
  },
  defaultCursorClient: {
    listRepositories: jest.fn(),
  },
}));

import { handleMCPError, createSuccessResponse } from '../../utils/errorHandler.js';
import { defaultCursorClient } from '../../utils/cursorClient.js';

describe('listRepositories Tool', () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    tools = createTools(mockClient);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default successful response
    defaultCursorClient.listRepositories.mockResolvedValue(createTestRepositories());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const listRepositoriesTool = tools.find(tool => tool.name === 'listRepositories');

  describe('API Call Formatting', () => {
    test('should make API call with no input parameters', async () => {
      const result = await listRepositoriesTool.handler();

      expect(defaultCursorClient.listRepositories).toHaveBeenCalledWith();
      expect(defaultCursorClient.listRepositories).toHaveBeenCalledTimes(1);
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

        defaultCursorClient.listRepositories.mockRejectedValue(apiError);

        const result = await listRepositoriesTool.handler();

        expect(result.isError).toBe(true);
        expect(handleMCPError).toHaveBeenCalledWith(
          expect.any(expectedError),
          'listRepositories'
        );
      }
    });

    test('should handle network errors gracefully', async () => {
      const networkError = createMockError('Network Error', 500);
      delete networkError.response; // Remove response to simulate network error

      defaultCursorClient.listRepositories.mockRejectedValue(networkError);

      const result = await listRepositoriesTool.handler();

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(networkError, 'listRepositories');
    });

    test('should handle unexpected errors gracefully', async () => {
      const unexpectedError = new Error('Something unexpected happened');
      defaultCursorClient.listRepositories.mockRejectedValue(unexpectedError);

      const result = await listRepositoriesTool.handler();

      expect(result.isError).toBe(true);
      expect(handleMCPError).toHaveBeenCalledWith(unexpectedError, 'listRepositories');
    });
  });

  describe('Response Processing', () => {
    test('should format successful response with repositories list', async () => {
      const mockRepositories = createTestRepositories();
      defaultCursorClient.listRepositories.mockResolvedValue(mockRepositories);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('📁 Accessible Repositories:'),
        { repositories: mockRepositories.repositories }
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📁 Accessible Repositories:/);
      expect(message).toMatch(/1\. repo1 \(user1\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/user1\/repo1/);
      expect(message).toMatch(/2\. repo2 \(user2\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/user2\/repo2/);
      expect(message).toMatch(/📊 Total: 2 repositories/);
    });

    test('should handle empty repositories list', async () => {
      const emptyRepositories = { repositories: [] };
      defaultCursorClient.listRepositories.mockResolvedValue(emptyRepositories);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining('📁 Accessible Repositories:'),
        { repositories: [] }
      );
      expect(result.isError).toBeUndefined();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📁 Accessible Repositories:/);
      expect(message).toMatch(/📊 Total: 0 repositories/);
    });

    test('should handle different repository formats', async () => {
      const customRepositories = {
        repositories: [
          { name: 'frontend-app', owner: 'myorg', repository: 'https://github.com/myorg/frontend-app' },
          { name: 'backend-api', owner: 'myorg', repository: 'https://github.com/myorg/backend-api' },
          { name: 'shared-utils', owner: 'myteam', repository: 'https://github.com/myteam/shared-utils' },
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(customRepositories);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. frontend-app \(myorg\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/myorg\/frontend-app/);
      expect(message).toMatch(/2\. backend-api \(myorg\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/myorg\/backend-api/);
      expect(message).toMatch(/3\. shared-utils \(myteam\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/myteam\/shared-utils/);
      expect(message).toMatch(/📊 Total: 3 repositories/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle repository names with special characters', async () => {
      const specialRepositories = {
        repositories: [
          { name: 'repo-with-dashes', owner: 'user', repository: 'https://github.com/user/repo-with-dashes' },
          { name: 'repo_with_underscores', owner: 'user', repository: 'https://github.com/user/repo_with_underscores' },
          { name: 'repo.with.dots', owner: 'user', repository: 'https://github.com/user/repo.with.dots' },
          { name: 'repo "with quotes"', owner: 'user', repository: 'https://github.com/user/repo "with quotes"' },
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(specialRepositories);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. repo-with-dashes \(user\)/);
      expect(message).toMatch(/2\. repo_with_underscores \(user\)/);
      expect(message).toMatch(/3\. repo\.with\.dots \(user\)/);
      expect(message).toMatch(/4\. repo "with quotes" \(user\)/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle single repository in list', async () => {
      const singleRepository = {
        repositories: [
          { name: 'my-single-repo', owner: 'myuser', repository: 'https://github.com/myuser/my-single-repo' }
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(singleRepository);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📁 Accessible Repositories:/);
      expect(message).toMatch(/1\. my-single-repo \(myuser\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/myuser\/my-single-repo/);
      expect(message).toMatch(/📊 Total: 1 repositories/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle large number of repositories', async () => {
      const manyRepositories = {
        repositories: Array.from({ length: 25 }, (_, i) => ({
          name: `repo-${i + 1}`,
          owner: `user${i + 1}`,
          repository: `https://github.com/user${i + 1}/repo-${i + 1}`
        }))
      };

      defaultCursorClient.listRepositories.mockResolvedValue(manyRepositories);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/📁 Accessible Repositories:/);
      expect(message).toMatch(/1\. repo-1 \(user1\)/);
      expect(message).toMatch(/25\. repo-25 \(user25\)/);
      expect(message).toMatch(/📊 Total: 25 repositories/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle different GitHub URL formats', async () => {
      const differentUrls = {
        repositories: [
          { name: 'github-com', owner: 'user', repository: 'https://github.com/user/github-com' },
          { name: 'github-enterprise', owner: 'org', repository: 'https://github.enterprise.com/org/github-enterprise' },
          { name: 'gitlab-repo', owner: 'user', repository: 'https://gitlab.com/user/gitlab-repo' },
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(differentUrls);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/🔗 https:\/\/github\.com\/user\/github-com/);
      expect(message).toMatch(/🔗 https:\/\/github\.enterprise\.com\/org\/github-enterprise/);
      expect(message).toMatch(/🔗 https:\/\/gitlab\.com\/user\/gitlab-repo/);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty repository names gracefully', async () => {
      const repositoriesWithEmpty = {
        repositories: [
          { name: '', owner: 'user', repository: 'https://github.com/user/empty-name' },
          { name: 'valid-repo', owner: 'user', repository: 'https://github.com/user/valid-repo' },
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(repositoriesWithEmpty);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\.  \(user\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/user\/empty-name/);
      expect(message).toMatch(/2\. valid-repo \(user\)/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle empty owner names gracefully', async () => {
      const repositoriesWithEmptyOwner = {
        repositories: [
          { name: 'repo1', owner: '', repository: 'https://github.com//repo1' },
          { name: 'repo2', owner: 'valid-user', repository: 'https://github.com/valid-user/repo2' },
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(repositoriesWithEmptyOwner);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. repo1 \(\)/);
      expect(message).toMatch(/🔗 https:\/\/github\.com\/\/repo1/);
      expect(message).toMatch(/2\. repo2 \(valid-user\)/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle repositories with unicode characters', async () => {
      const unicodeRepositories = {
        repositories: [
          { name: '中文仓库', owner: '用户', repository: 'https://github.com/用户/中文仓库' },
          { name: 'русский-репозиторий', owner: 'пользователь', repository: 'https://github.com/пользователь/русский-репозиторий' },
          { name: '🚀-awesome-repo', owner: 'user', repository: 'https://github.com/user/🚀-awesome-repo' },
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(unicodeRepositories);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(/1\. 中文仓库 \(用户\)/);
      expect(message).toMatch(/2\. русский-репозиторий \(пользователь\)/);
      expect(message).toMatch(/3\. 🚀-awesome-repo \(user\)/);
      expect(result.isError).toBeUndefined();
    });

    test('should handle repositories with very long names', async () => {
      const longName = 'a'.repeat(200);
      const repositoriesWithLongName = {
        repositories: [
          { name: longName, owner: 'user', repository: `https://github.com/user/${longName}` },
          { name: 'short', owner: 'user', repository: 'https://github.com/user/short' },
        ]
      };

      defaultCursorClient.listRepositories.mockResolvedValue(repositoriesWithLongName);
      createSuccessResponse.mockClear();

      const result = await listRepositoriesTool.handler();

      const message = createSuccessResponse.mock.calls[0][0];
      expect(message).toMatch(new RegExp(`1\. ${longName.substring(0, 50)}`));
      expect(message).toMatch(/2\. short \(user\)/);
      expect(message).toMatch(/📊 Total: 2 repositories/);
      expect(result.isError).toBeUndefined();
    });
  });
});