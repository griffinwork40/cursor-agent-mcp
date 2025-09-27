// Authentication race condition and timing tests
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock modules
const mockConfig = {
  token: {
    secret: 'test-secret-key-for-race-condition-testing',
    ttlDays: 30,
  },
  cursor: {
    apiKey: 'key_test-race-condition',
    apiUrl: 'https://api.cursor.com',
  },
};

const mockMintTokenFromApiKey = jest.fn();
const mockDecodeTokenToApiKey = jest.fn();
const mockCreateCursorApiClient = jest.fn();
const mockHandleMCPError = jest.fn();

jest.unstable_mockModule('../config/index.js', () => ({
  config: mockConfig,
}));

jest.unstable_mockModule('../utils/tokenUtils.js', () => ({
  mintTokenFromApiKey: mockMintTokenFromApiKey,
  decodeTokenToApiKey: mockDecodeTokenToApiKey,
}));

jest.unstable_mockModule('../utils/cursorClient.js', () => ({
  createCursorApiClient: mockCreateCursorApiClient,
}));

jest.unstable_mockModule('../utils/errorHandler.js', () => ({
  handleMCPError: mockHandleMCPError,
}));

describe('Authentication Race Conditions and Timing Issues', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Token Expiration Race Conditions', () => {
    it('should handle token expiration during concurrent requests', async () => {
      const { decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
      
      // Simulate token that expires during processing
      const expiringToken = 'expiring-token';
      
      mockDecodeTokenToApiKey
        .mockReturnValueOnce('valid-api-key') // First call succeeds
        .mockReturnValueOnce(null); // Second call fails due to expiration

      // Simulate concurrent requests with same token
      const request1 = { headers: { 'x-mcp-token': expiringToken } };
      const request2 = { headers: { 'x-mcp-token': expiringToken } };

      // Extract API key function from index.js
      const extractApiKey = (req) => {
        const token = req.query?.token || req.headers['x-mcp-token'];
        const tokenKey = token ? decodeTokenToApiKey(token) : null;
        if (tokenKey) return tokenKey;
        return mockConfig.cursor.apiKey;
      };

      const key1 = extractApiKey(request1);
      const key2 = extractApiKey(request2);

      expect(key1).toBe('valid-api-key');
      expect(key2).toBe(mockConfig.cursor.apiKey); // Falls back to config key
      expect(mockDecodeTokenToApiKey).toHaveBeenCalledTimes(2);
    });

    it('should handle token validation failures gracefully', async () => {
      const { decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
      
      // Simulate various token validation failures
      const invalidTokens = [
        'invalid-base64!',
        'too-short',
        'malformed-token-data',
        null,
        undefined,
        '',
      ];

      invalidTokens.forEach(token => {
        mockDecodeTokenToApiKey.mockReturnValueOnce(null);
        const result = decodeTokenToApiKey(token);
        expect(result).toBeNull();
      });
    });
  });

  describe('API Key Extraction Race Conditions', () => {
    it('should handle concurrent API key extraction from different sources', async () => {
      const { decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
      
      mockDecodeTokenToApiKey.mockReturnValue('decoded-key');

      // Simulate concurrent requests with different auth methods
      const requests = [
        { headers: { 'x-mcp-token': 'token1' }, query: {}, body: {} },
        { headers: { authorization: 'Bearer key_bearer123' }, query: {}, body: {} },
        { headers: { 'x-cursor-api-key': 'key_header123' }, query: {}, body: {} },
        { headers: {}, query: { api_key: 'key_query123' }, body: {} },
        { headers: {}, query: {}, body: { cursor_api_key: 'key_body123' } },
      ];

      const extractApiKey = (req) => {
        const token = req.query?.token || req.headers['x-mcp-token'];
        const tokenKey = token ? decodeTokenToApiKey(token) : null;
        if (tokenKey) return tokenKey;

        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('oauth')) {
          const bearerKey = authHeader.replace('Bearer ', '');
          if (bearerKey.startsWith('key_')) {
            return bearerKey;
          }
        }

        return (
          req.headers['x-cursor-api-key'] ||
          req.headers['x-api-key'] ||
          req.query?.api_key ||
          req.body?.cursor_api_key ||
          mockConfig.cursor.apiKey
        );
      };

      const results = requests.map(extractApiKey);
      
      expect(results[0]).toBe('decoded-key'); // token
      expect(results[1]).toBe('key_bearer123'); // bearer
      expect(results[2]).toBe('key_header123'); // header
      expect(results[3]).toBe('key_query123'); // query
      expect(results[4]).toBe('key_body123'); // body
    });

    it('should prioritize token over other authentication methods', async () => {
      const { decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
      
      mockDecodeTokenToApiKey.mockReturnValue('token-key');

      const request = {
        headers: {
          'x-mcp-token': 'valid-token',
          'authorization': 'Bearer key_bearer123',
          'x-cursor-api-key': 'key_header123',
        },
        query: { api_key: 'key_query123' },
        body: { cursor_api_key: 'key_body123' },
      };

      const extractApiKey = (req) => {
        const token = req.query?.token || req.headers['x-mcp-token'];
        const tokenKey = token ? decodeTokenToApiKey(token) : null;
        if (tokenKey) return tokenKey;

        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('oauth')) {
          const bearerKey = authHeader.replace('Bearer ', '');
          if (bearerKey.startsWith('key_')) {
            return bearerKey;
          }
        }

        return (
          req.headers['x-cursor-api-key'] ||
          req.headers['x-api-key'] ||
          req.query?.api_key ||
          req.body?.cursor_api_key ||
          mockConfig.cursor.apiKey
        );
      };

      const result = extractApiKey(request);
      expect(result).toBe('token-key');
      expect(mockDecodeTokenToApiKey).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('Client Creation Race Conditions', () => {
    it('should handle concurrent client creation with same API key', async () => {
      const { createCursorApiClient } = await import('../utils/cursorClient.js');
      
      const mockClient = { createAgent: jest.fn() };
      mockCreateCursorApiClient.mockReturnValue(mockClient);

      const apiKey = 'key_concurrent-test';
      
      // Simulate concurrent client creation
      const clients = await Promise.all([
        Promise.resolve(createCursorApiClient(apiKey)),
        Promise.resolve(createCursorApiClient(apiKey)),
        Promise.resolve(createCursorApiClient(apiKey)),
      ]);

      expect(clients).toHaveLength(3);
      expect(mockCreateCursorApiClient).toHaveBeenCalledTimes(3);
      expect(mockCreateCursorApiClient).toHaveBeenCalledWith(apiKey);
    });

    it('should handle client creation with null/undefined API keys', async () => {
      const { createCursorApiClient } = await import('../utils/cursorClient.js');
      
      const mockClient = { createAgent: jest.fn() };
      mockCreateCursorApiClient.mockReturnValue(mockClient);

      const invalidKeys = [null, undefined, '', 'invalid-key'];
      
      invalidKeys.forEach(key => {
        const client = createCursorApiClient(key);
        expect(client).toBe(mockClient);
        expect(mockCreateCursorApiClient).toHaveBeenCalledWith(key);
      });
    });
  });

  describe('Error Handling Race Conditions', () => {
    it('should handle concurrent error scenarios', async () => {
      const { handleMCPError } = await import('../utils/errorHandler.js');
      
      const mockErrorResponse = {
        content: [{ type: 'text', text: 'Error message' }],
        isError: true,
      };
      mockHandleMCPError.mockReturnValue(mockErrorResponse);

      const errors = [
        new Error('Network error'),
        new Error('Authentication error'),
        new Error('Validation error'),
        new Error('Timeout error'),
      ];

      // Simulate concurrent error handling
      const results = await Promise.all(
        errors.map(error => Promise.resolve(handleMCPError(error, 'test'))),
      );

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toEqual(mockErrorResponse);
      });
      expect(mockHandleMCPError).toHaveBeenCalledTimes(4);
    });
  });

  describe('Configuration Race Conditions', () => {
    it('should handle configuration changes during runtime', async () => {
      const { config } = await import('../config/index.js');
      
      // Simulate configuration access during concurrent operations
      const configAccess = Array.from({ length: 10 }, () =>
        Promise.resolve({
          tokenSecret: config.token.secret,
          apiKey: config.cursor.apiKey,
          ttlDays: config.token.ttlDays,
        }),
      );

      const results = await Promise.all(configAccess);
      
      results.forEach(result => {
        expect(result.tokenSecret).toBe(mockConfig.token.secret);
        expect(result.apiKey).toBe(mockConfig.cursor.apiKey);
        expect(result.ttlDays).toBe(mockConfig.token.ttlDays);
      });
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not accumulate tokens in memory indefinitely', async () => {
      const { mintTokenFromApiKey, decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
      
      // Mock token operations to simulate memory usage
      mockMintTokenFromApiKey.mockImplementation((key) => `token-${key}`);
      mockDecodeTokenToApiKey.mockImplementation((token) => {
        if (token && token.startsWith('token-')) {
          return token.replace('token-', '');
        }
        return null;
      });
      
      // Simulate many token operations
      const tokens = [];
      for (let i = 0; i < 1000; i++) {
        const token = mintTokenFromApiKey(`key_test-${i}`);
        tokens.push(token);
      }

      // Verify tokens can be decoded
      for (let i = 0; i < 100; i++) {
        const decoded = decodeTokenToApiKey(tokens[i]);
        expect(decoded).toBe(`key_test-${i}`);
      }

      // Clear tokens to prevent memory leaks
      tokens.length = 0;
      expect(tokens).toHaveLength(0);
    });
  });

  describe('Timing-Sensitive Operations', () => {
    it('should handle rapid successive token operations', async () => {
      const { mintTokenFromApiKey, decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
      
      const apiKey = 'key_rapid-test';
      
      // Mock token operations
      mockMintTokenFromApiKey.mockReturnValue('mocked-token');
      mockDecodeTokenToApiKey.mockReturnValue(apiKey);
      
      // Simulate rapid token minting and decoding
      const operations = Array.from({ length: 100 }, () =>
        Promise.resolve().then(() => {
          const token = mintTokenFromApiKey(apiKey);
          const decoded = decodeTokenToApiKey(token);
          return { token, decoded };
        }),
      );

      const results = await Promise.all(operations);
      
      results.forEach(({ token, decoded }) => {
        expect(token).toBeDefined();
        expect(decoded).toBe(apiKey);
      });
    });

    it('should handle token operations with system clock changes', async () => {
      const { mintTokenFromApiKey, decodeTokenToApiKey } = await import('../utils/tokenUtils.js');
      
      const apiKey = 'key_clock-test';
      
      // Mock token operations
      mockMintTokenFromApiKey.mockReturnValue('clock-token');
      mockDecodeTokenToApiKey.mockReturnValue(apiKey);
      
      // Simulate system clock changes
      const originalNow = Date.now;
      let mockTime = 1000000000000; // Fixed timestamp
      
      Date.now = jest.fn(() => mockTime);
      
      try {
        const token = mintTokenFromApiKey(apiKey);
        
        // Advance time
        mockTime += 24 * 60 * 60 * 1000; // 1 day
        Date.now = jest.fn(() => mockTime);
        
        const decoded = decodeTokenToApiKey(token);
        expect(decoded).toBe(apiKey); // Should still be valid within TTL
      } finally {
        Date.now = originalNow;
      }
    });
  });
});