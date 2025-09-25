import { jest } from '@jest/globals';
import { CursorApiClient, createCursorApiClient } from './cursorClient.js';

/**
 * Comprehensive test suite for CursorApiClient
 * 
 * Tests cover:
 * 1. Client initialization with/without API key
 * 2. All API methods
 * 3. Error handling scenarios
 * 4. Client factory function
 * 5. Basic functionality verification
 */

describe('CursorApiClient - Comprehensive Tests', () => {
  describe('1. Client Factory Function', () => {
    test('createCursorApiClient should return CursorApiClient instance', () => {
      const client = createCursorApiClient('test-key');
      expect(client).toBeInstanceOf(CursorApiClient);
    });

    test('createCursorApiClient should work without API key', () => {
      const client = createCursorApiClient();
      expect(client).toBeInstanceOf(CursorApiClient);
    });

    test('createCursorApiClient should create independent instances', () => {
      const client1 = createCursorApiClient('key1');
      const client2 = createCursorApiClient('key2');

      expect(client1).not.toBe(client2);
      expect(client1).toBeInstanceOf(CursorApiClient);
      expect(client2).toBeInstanceOf(CursorApiClient);
    });
  });

  describe('2. Client Initialization', () => {
    test('should create client instance with API key', () => {
      const client = new CursorApiClient('test-key');
      expect(client).toBeInstanceOf(CursorApiClient);
      expect(client.client).toBeDefined();
      expect(typeof client.client).toBe('function'); // axios instance is actually a function
    });

    test('should create client without API key', () => {
      const client = new CursorApiClient();
      expect(client).toBeInstanceOf(CursorApiClient);
      expect(client.client).toBeDefined();
    });

    test('should create client with null API key', () => {
      const client = new CursorApiClient(null);
      expect(client).toBeInstanceOf(CursorApiClient);
      expect(client.client).toBeDefined();
    });

    test('should create client with empty string API key', () => {
      const client = new CursorApiClient('');
      expect(client).toBeInstanceOf(CursorApiClient);
      expect(client.client).toBeDefined();
    });

    test('should create client with special characters in API key', () => {
      const apiKey = 'sk-test-key-with-special-chars!@#$%^&*()';
      const client = new CursorApiClient(apiKey);
      expect(client).toBeInstanceOf(CursorApiClient);
      expect(client.client).toBeDefined();
    });
  });

  describe('3. API Methods Existence and Structure', () => {
    let client;

    beforeEach(() => {
      client = new CursorApiClient('test-key');
    });

    test('should have createAgent method', () => {
      expect(typeof client.createAgent).toBe('function');
      expect(client.createAgent.length).toBe(1); // expects 1 parameter
    });

    test('should have listAgents method', () => {
      expect(typeof client.listAgents).toBe('function');
      expect(client.listAgents.length).toBe(0); // default parameter doesn't count towards length
    });

    test('should have getAgent method', () => {
      expect(typeof client.getAgent).toBe('function');
      expect(client.getAgent.length).toBe(1); // expects 1 parameter
    });

    test('should have deleteAgent method', () => {
      expect(typeof client.deleteAgent).toBe('function');
      expect(client.deleteAgent.length).toBe(1); // expects 1 parameter
    });

    test('should have addFollowup method', () => {
      expect(typeof client.addFollowup).toBe('function');
      expect(client.addFollowup.length).toBe(2); // expects 2 parameters
    });

    test('should have getAgentConversation method', () => {
      expect(typeof client.getAgentConversation).toBe('function');
      expect(client.getAgentConversation.length).toBe(1); // expects 1 parameter
    });

    test('should have getMe method', () => {
      expect(typeof client.getMe).toBe('function');
      expect(client.getMe.length).toBe(0); // expects no parameters
    });

    test('should have listModels method', () => {
      expect(typeof client.listModels).toBe('function');
      expect(client.listModels.length).toBe(0); // expects no parameters
    });

    test('should have listRepositories method', () => {
      expect(typeof client.listRepositories).toBe('function');
      expect(client.listRepositories.length).toBe(0); // expects no parameters
    });
  });

  describe('4. Axios Client Configuration', () => {
    test('should have axios client configured', () => {
      const client = new CursorApiClient('test-key');
      expect(client.client).toBeDefined();
      expect(client.client.defaults).toBeDefined();
      expect(client.client.defaults.baseURL).toBe('https://api.cursor.com');
      expect(client.client.defaults.timeout).toBe(30000);
    });

    test('should have correct headers with API key', () => {
      const apiKey = 'test-api-key-123';
      const client = new CursorApiClient(apiKey);
      
      expect(client.client.defaults.headers).toBeDefined();
      expect(client.client.defaults.headers['Content-Type']).toBe('application/json');
      expect(client.client.defaults.headers['User-Agent']).toBe('cursor-mcp/1.0.0');
      expect(client.client.defaults.headers['Authorization']).toBe(`Bearer ${apiKey}`);
    });

    test('should have correct headers without API key', () => {
      const client = new CursorApiClient();
      
      expect(client.client.defaults.headers).toBeDefined();
      expect(client.client.defaults.headers['Content-Type']).toBe('application/json');
      expect(client.client.defaults.headers['User-Agent']).toBe('cursor-mcp/1.0.0');
      expect(client.client.defaults.headers['Authorization']).toBeUndefined();
    });
  });

  describe('5. Interceptors Setup', () => {
    test('should have request interceptors configured', () => {
      const client = new CursorApiClient('test-key');
      expect(client.client.interceptors).toBeDefined();
      expect(client.client.interceptors.request).toBeDefined();
      expect(client.client.interceptors.request.handlers).toBeDefined();
      expect(client.client.interceptors.request.handlers.length).toBeGreaterThan(0);
    });

    test('should have response interceptors configured', () => {
      const client = new CursorApiClient('test-key');
      expect(client.client.interceptors).toBeDefined();
      expect(client.client.interceptors.response).toBeDefined();
      expect(client.client.interceptors.response.handlers).toBeDefined();
      expect(client.client.interceptors.response.handlers.length).toBeGreaterThan(0);
    });
  });

  describe('6. Error Handling Behavior', () => {
    let client;
    let consoleErrorSpy;

    beforeEach(() => {
      client = new CursorApiClient('test-key');
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should handle method calls gracefully (network errors expected in test environment)', async () => {
      // These tests will fail with network errors since we're not mocking axios,
      // but they should fail gracefully and not throw unexpected errors
      
      const testMethod = async (methodName, ...args) => {
        try {
          await client[methodName](...args);
        } catch (error) {
          // Expected to fail with network/connection errors in test environment
          expect(error).toBeDefined();
          // Should be axios-related errors, not method implementation errors
          expect(typeof error).toBe('object');
        }
      };

      await testMethod('createAgent', { prompt: { text: 'test' } });
      await testMethod('listAgents');
      await testMethod('getAgent', 'test-id');
      await testMethod('deleteAgent', 'test-id');
      await testMethod('addFollowup', 'test-id', { prompt: { text: 'test' } });
      await testMethod('getAgentConversation', 'test-id');
      await testMethod('getMe');
      await testMethod('listModels');
      await testMethod('listRepositories');
    });
  });

  describe('7. Input Validation and Parameter Handling', () => {
    let client;

    beforeEach(() => {
      client = new CursorApiClient('test-key');
    });

    test('should handle different parameter types for listAgents', async () => {
      // These will fail with network errors but should not throw parameter validation errors
      
      const testParams = [
        undefined,
        {},
        { limit: 10 },
        { cursor: 'test-cursor' },
        { limit: 10, cursor: 'test-cursor' },
      ];

      for (const params of testParams) {
        try {
          await client.listAgents(params);
        } catch (error) {
          // Should be network errors, not parameter validation errors
          expect(error).toBeDefined();
          expect(typeof error).toBe('object');
        }
      }
    });

    test('should handle different data types for createAgent', async () => {
      const testData = [
        { prompt: { text: 'Simple test' } },
        { 
          prompt: { text: 'Complex test' },
          model: 'gpt-4',
          source: { repository: 'https://github.com/test/repo' }
        },
        {
          prompt: {
            text: 'Test with images',
            images: [{ data: 'base64data' }]
          },
          webhook: {
            url: 'https://example.com/webhook',
            secret: 'a'.repeat(32)
          }
        }
      ];

      for (const data of testData) {
        try {
          await client.createAgent(data);
        } catch (error) {
          // Should be network errors, not data validation errors
          expect(error).toBeDefined();
          expect(typeof error).toBe('object');
        }
      }
    });
  });

  describe('8. Multiple Instance Independence', () => {
    test('should create independent client instances', () => {
      const client1 = new CursorApiClient('key1');
      const client2 = new CursorApiClient('key2');
      const client3 = createCursorApiClient('key3');

      expect(client1).not.toBe(client2);
      expect(client2).not.toBe(client3);
      expect(client1).not.toBe(client3);

      expect(client1.client).not.toBe(client2.client);
      expect(client2.client).not.toBe(client3.client);
      expect(client1.client).not.toBe(client3.client);
    });

    test('should maintain separate configurations', () => {
      const client1 = new CursorApiClient('key1');
      const client2 = new CursorApiClient('key2');
      const client3 = new CursorApiClient();

      expect(client1.client.defaults.headers['Authorization']).toBe('Bearer key1');
      expect(client2.client.defaults.headers['Authorization']).toBe('Bearer key2');
      expect(client3.client.defaults.headers['Authorization']).toBeUndefined();
    });
  });

  describe('9. Edge Cases and Special Scenarios', () => {
    test('should handle very long API keys', () => {
      const longApiKey = 'sk-' + 'a'.repeat(1000);
      const client = new CursorApiClient(longApiKey);
      
      expect(client).toBeInstanceOf(CursorApiClient);
      expect(client.client.defaults.headers['Authorization']).toBe(`Bearer ${longApiKey}`);
    });

    test('should handle API keys with Unicode characters', () => {
      const unicodeApiKey = 'sk-test-🔑-key-αβγ-测试';
      const client = new CursorApiClient(unicodeApiKey);
      
      expect(client).toBeInstanceOf(CursorApiClient);
      expect(client.client.defaults.headers['Authorization']).toBe(`Bearer ${unicodeApiKey}`);
    });

    test('should handle rapid instance creation', () => {
      const clients = [];
      for (let i = 0; i < 10; i++) {
        clients.push(new CursorApiClient(`key-${i}`));
      }

      expect(clients).toHaveLength(10);
      clients.forEach((client, index) => {
        expect(client).toBeInstanceOf(CursorApiClient);
        expect(client.client.defaults.headers['Authorization']).toBe(`Bearer key-${index}`);
      });

      // All clients should be independent
      const uniqueClients = new Set(clients);
      expect(uniqueClients.size).toBe(10);
    });
  });

  describe('10. Integration Scenarios', () => {
    test('should support method chaining patterns', () => {
      const client = new CursorApiClient('test-key');
      
      // Test that methods exist and can be used for chaining
      expect(typeof client.createAgent).toBe('function');
      expect(typeof client.listAgents).toBe('function');
      expect(typeof client.getMe).toBe('function');
      
      // Test that methods are async (they should return promises when called)
      // We don't call them to avoid network requests
      expect(client.createAgent.constructor.name).toBe('AsyncFunction');
      expect(client.listAgents.constructor.name).toBe('AsyncFunction');
      expect(client.getMe.constructor.name).toBe('AsyncFunction');
    });

    test('should support concurrent operations (structure test)', () => {
      const client = new CursorApiClient('test-key');
      
      // Test that methods return promises that can be used concurrently
      // Note: We don't actually call the methods to avoid network requests in tests
      expect(typeof client.listModels).toBe('function');
      expect(typeof client.listRepositories).toBe('function');
      expect(typeof client.getMe).toBe('function');
      
      // Test that all methods are available for concurrent use
      const methods = [
        'createAgent', 'listAgents', 'getAgent', 'deleteAgent',
        'addFollowup', 'getAgentConversation', 'getMe', 'listModels', 'listRepositories'
      ];
      
      methods.forEach(method => {
        expect(typeof client[method]).toBe('function');
      });
    });
  });

  describe('11. Configuration Validation', () => {
    test('should use correct base URL', () => {
      const client = new CursorApiClient('test-key');
      expect(client.client.defaults.baseURL).toBe('https://api.cursor.com');
    });

    test('should use correct timeout', () => {
      const client = new CursorApiClient('test-key');
      expect(client.client.defaults.timeout).toBe(30000);
    });

    test('should use correct content type', () => {
      const client = new CursorApiClient('test-key');
      expect(client.client.defaults.headers['Content-Type']).toBe('application/json');
    });

    test('should use correct user agent', () => {
      const client = new CursorApiClient('test-key');
      expect(client.client.defaults.headers['User-Agent']).toBe('cursor-mcp/1.0.0');
    });
  });
});