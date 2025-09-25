import { jest } from '@jest/globals';

// Mock the config module
jest.mock('../config/index.js', () => ({
  config: {
    cursor: {
      apiUrl: 'https://api.cursor.com',
      apiKey: 'test-api-key'
    }
  }
}));

// Mock axios
jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
  };

  return {
    __esModule: true,
    default: mockAxios,
  };
});

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  error: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
};

// Global test utilities
export const createMockResponse = (data, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {},
});

export const createMockError = (message, status = 500, responseData = null) => {
  const error = new Error(message);
  error.response = {
    status,
    statusText: 'Error',
    data: responseData || { error: { message, code: 'TEST_ERROR' } },
  };
  return error;
};

export const createMockClient = () => ({
  createAgent: jest.fn(),
  listAgents: jest.fn(),
  getAgent: jest.fn(),
  deleteAgent: jest.fn(),
  addFollowup: jest.fn(),
  getAgentConversation: jest.fn(),
  getMe: jest.fn(),
  listModels: jest.fn(),
  listRepositories: jest.fn(),
});

// Test data factories
export const createTestAgent = (overrides = {}) => ({
  id: 'test-agent-id',
  name: 'Test Agent',
  status: 'RUNNING',
  createdAt: '2024-01-01T00:00:00Z',
  summary: 'Test summary',
  source: {
    repository: 'https://github.com/test/repo',
    ref: 'main',
  },
  target: {
    url: 'https://github.com/test/repo/pull/1',
    branchName: 'agent-branch',
  },
  ...overrides,
});

export const createTestAgentList = (count = 3) => ({
  agents: Array.from({ length: count }, (_, i) =>
    createTestAgent({
      id: `test-agent-${i}`,
      name: `Test Agent ${i}`,
    })
  ),
  nextCursor: count > 3 ? 'next-page-cursor' : null,
});

export const createTestModels = () => ({
  models: ['gpt-4', 'gpt-4-turbo', 'claude-3-sonnet', 'claude-3-haiku'],
});

export const createTestRepositories = () => ({
  repositories: [
    { name: 'repo1', owner: 'user1', repository: 'https://github.com/user1/repo1' },
    { name: 'repo2', owner: 'user2', repository: 'https://github.com/user2/repo2' },
  ],
});

export const createTestConversation = () => ({
  id: 'test-agent-id',
  messages: [
    {
      type: 'user_message',
      text: 'Create a hello world function',
      timestamp: '2024-01-01T00:00:00Z',
    },
    {
      type: 'assistant_message',
      text: 'I created the hello world function successfully',
      timestamp: '2024-01-01T00:01:00Z',
    },
  ],
});

export const createTestApiKeyInfo = () => ({
  apiKeyName: 'Test API Key',
  createdAt: '2024-01-01T00:00:00Z',
  userEmail: 'test@example.com',
});