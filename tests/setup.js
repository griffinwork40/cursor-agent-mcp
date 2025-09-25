/**
 * Jest Test Setup
 *
 * Global test configuration and setup for all test suites
 */

// Import jest-dom for additional DOM matchers (useful for any DOM testing)
import '@testing-library/jest-dom';

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