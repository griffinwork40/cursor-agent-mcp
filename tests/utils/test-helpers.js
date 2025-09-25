/**
 * Test Helper Utilities
 *
 * Common utilities and helpers for writing tests
 */

import axios from 'axios';
import nock from 'nock';
import sinon from 'sinon';

const setAxiosMockResponse = (method, url, payload) => {
  if (axios && typeof axios.__setMockResponse === 'function') {
    axios.__setMockResponse(method, url, payload);
  }
};

const setAxiosMockError = (method, url, error) => {
  if (axios && typeof axios.__setMockError === 'function') {
    axios.__setMockError(method, url, error);
  }
};

/**
 * HTTP Request Mocking Utilities
 */
export const mockHttp = {
  // Mock successful API responses
  mockApiSuccess: (url, method = 'get', responseData = {}, statusCode = 200) => {
    setAxiosMockResponse(method, url, responseData);

    return nock('https://api.cursor.com')
      .intercept(url, method)
      .reply(statusCode, responseData);
  },

  // Mock API errors
  mockApiError: (url, method = 'get', errorMessage = 'API Error', statusCode = 500) => {
    const error = new Error(errorMessage);
    error.response = {
      status: statusCode,
      data: { error: errorMessage }
    };

    setAxiosMockError(method, url, error);

    return nock('https://api.cursor.com')
      .intercept(url, method)
      .replyWithError({
        code: statusCode,
        message: errorMessage
      });
  },

  // Mock network timeout
  mockTimeout: (url, method = 'get', timeoutMs = 5000) => {
    const error = new Error(`timeout of ${timeoutMs}ms exceeded`);
    error.code = 'ECONNABORTED';
    setAxiosMockError(method, url, error);

    return nock('https://api.cursor.com')
      .intercept(url, method)
      .delay(timeoutMs)
      .reply(200, {});
  },

  // Clean up all mocks
  cleanAll: () => {
    nock.cleanAll();
    if (axios && typeof axios.__reset === 'function') {
      axios.__reset();
    }
  }
};

/**
 * Timer and Async Utilities
 */
export const asyncHelpers = {
  // Wait for a specific amount of time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Wait for condition to be true
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }
};

/**
 * Mock Data Generators
 */
export const mockData = {
  // Generate mock agent data
  generateAgent: (overrides = {}) => ({
    id: `agent-${Date.now()}`,
    name: 'Test Agent',
    prompt: 'Test prompt',
    model: 'claude-3-5-sonnet',
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  // Generate mock repository data
  generateRepository: (overrides = {}) => ({
    id: `repo-${Date.now()}`,
    name: 'test-repo',
    url: 'https://github.com/test/repo',
    description: 'Test repository',
    ...overrides
  }),

  // Generate mock user data
  generateUser: (overrides = {}) => ({
    id: `user-${Date.now()}`,
    email: 'test@example.com',
    name: 'Test User',
    apiKey: 'test-api-key',
    ...overrides
  }),

  // Generate mock model data
  generateModel: (overrides = {}) => ({
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    maxTokens: 4096,
    ...overrides
  })
};

/**
 * Assertion Helpers
 */
export const assertions = {
  // Assert that a function throws an error
  expectToThrow: async (fn, expectedError) => {
    let error;
    try {
      await fn();
    } catch (e) {
      error = e;
    }

    if (!error) {
      throw new Error('Expected function to throw an error');
    }

    if (expectedError && !error.message.includes(expectedError)) {
      throw new Error(`Expected error message to include "${expectedError}", got "${error.message}"`);
    }

    return error;
  },

  // Assert that an object has required properties
  expectToHaveProperties: (obj, properties) => {
    properties.forEach(prop => {
      if (!(prop in obj)) {
        throw new Error(`Expected object to have property "${prop}"`);
      }
    });
  }
};

/**
 * Sinon Utilities
 */
export const sinonHelpers = {
  // Create a sandbox for spies and stubs
  createSandbox: () => sinon.createSandbox(),

  // Stub a method and return a value
  stubMethod: (object, method, returnValue) => {
    const stub = sinon.stub(object, method).returns(returnValue);
    return stub;
  },

  // Spy on a method
  spyOnMethod: (object, method) => {
    return sinon.spy(object, method);
  }
};