/**
 * Jest Test Setup
 *
 * Global test configuration and setup for all test suites
 */

import http from 'node:http';

// Ensure HTTP servers created in tests are listening so Supertest doesn't close them mid-request
const originalCreateServer = http.createServer;
http.createServer = (...args) => {
  const server = originalCreateServer(...args);

  if (!server.listening) {
    const originalListen = server.listen.bind(server);
    const originalClose = server.close.bind(server);

    originalListen(0);

    server.listen = (...listenArgs) => {
      if (server.listening) {
        if (listenArgs.length === 0) {
          return server;
        }
        originalClose();
      }

      return originalListen(...listenArgs);
    };
  }

  return server;
};

// Import jest-dom for additional DOM matchers when a DOM environment is available
const hasDomEnvironment = typeof window !== 'undefined' && typeof document !== 'undefined';

if (hasDomEnvironment) {
  import('@testing-library/jest-dom').catch((error) => {
    console.warn('Failed to load @testing-library/jest-dom matchers:', error);
  });
}

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.CURSOR_API_KEY = 'test-api-key-for-testing';

// Global test utilities
global.testUtils = {
  // Helper to create mock responses
  createMockResponse: (data, status = 200) => ({
    status,
    data,
    headers: { 'content-type': 'application/json' }
  }),

  // Helper to create mock errors
  createMockError: (message, status = 500) => ({
    response: {
      status,
      data: { error: message }
    }
  }),

  // Helper to wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate unique IDs for tests
  generateId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
};

// Mock console methods to reduce noise in tests (unless explicitly needed)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Mock console methods for cleaner test output
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset environment variables to defaults
  process.env.CURSOR_API_KEY = 'test-api-key-for-testing';

  // Clear any timers
  jest.clearAllTimers();
});