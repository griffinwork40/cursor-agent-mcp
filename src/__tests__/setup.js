// Test setup file for Jest
const { jest } = require('@jest/globals');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.CURSOR_API_KEY = 'mock_test_api_key';
process.env.CURSOR_API_URL = 'https://api.cursor.com';
process.env.TOKEN_SECRET = 'test_token_secret_for_jwt_signing';
process.env.TOKEN_TTL_DAYS = '30';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Only show errors during tests, suppress logs
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = originalConsoleError; // Keep errors visible
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});