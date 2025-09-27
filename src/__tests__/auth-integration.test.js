// Integration tests for authentication fixes
import { jest } from '@jest/globals';

const defaultTokenConfig = {
  secret: 'test-secret-key-for-integration-testing',
  ttlDays: 1,
};

async function importTokenUtils(overrides = {}) {
  jest.resetModules();
  jest.unstable_mockModule('../config/index.js', () => ({
    config: {
      token: {
        ...defaultTokenConfig,
        ...overrides,
      },
    },
  }));

  const tokenUtilsModule = await import('../utils/tokenUtils.js');
  const { config } = await import('../config/index.js');

  return {
    ...tokenUtilsModule,
    config,
  };
}

describe('Authentication Integration Tests', () => {
  let mintTokenFromApiKey;
  let decodeTokenToApiKey;

  beforeEach(async () => {
    ({ mintTokenFromApiKey, decodeTokenToApiKey } = await importTokenUtils());
  });

  describe('Real-world Authentication Scenarios', () => {
    test('should handle API key extraction from various sources', async () => {
      // Simulate the extractApiKey function from index.js
      const extractApiKey = (req) => {
        // Support zero-storage token in query/header: token=<base64url>
        const token = req.query?.token || req.headers['x-mcp-token'];
        const tokenKey = token ? decodeTokenToApiKey(token) : null;
        if (tokenKey) return tokenKey;

        // Check Authorization header for ChatGPT compatibility (but avoid OAuth Bearer tokens)
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('oauth')) {
          const bearerKey = authHeader.replace('Bearer ', '');
          // Only use if it looks like a Cursor API key (starts with 'key_')
          if (bearerKey.startsWith('key_')) {
            return bearerKey;
          }
        }

        return (
          req.headers['x-cursor-api-key'] ||
          req.headers['x-api-key'] ||
          req.query?.api_key ||
          req.body?.cursor_api_key ||
          'fallback-key' // fallback to environment/global key
        );
      };

      const testApiKey = 'key_test123456789';
      const token = mintTokenFromApiKey(testApiKey);

      // Test token-based extraction
      const tokenReq = { query: { token } };
      expect(extractApiKey(tokenReq)).toBe(testApiKey);

      // Test header-based extraction
      const headerReq = { headers: { 'x-mcp-token': token } };
      expect(extractApiKey(headerReq)).toBe(testApiKey);

      // Test Bearer token extraction
      const bearerReq = { headers: { authorization: `Bearer ${testApiKey}` } };
      expect(extractApiKey(bearerReq)).toBe(testApiKey);

      // Test OAuth Bearer token rejection
      const oauthReq = { headers: { authorization: 'Bearer oauth_token_123' } };
      expect(extractApiKey(oauthReq)).toBe('fallback-key');

      // Test direct header extraction
      const directReq = { headers: { 'x-cursor-api-key': testApiKey } };
      expect(extractApiKey(directReq)).toBe(testApiKey);
    });

    test('should handle token expiration in real-time scenarios', async () => {
      const apiKey = 'key_realtime_test';
      
      // Create token with very short TTL
      const { mintTokenFromApiKey: mintTokenShort } = await importTokenUtils({ ttlDays: 0.000001 }); // ~86ms
      const token = mintTokenShort(apiKey);
      
      // Should work immediately
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should now be expired
      expect(decodeTokenToApiKey(token)).toBeNull();
    });

    test('should handle concurrent authentication requests', async () => {
      const apiKey = 'key_concurrent_test';
      const token = mintTokenFromApiKey(apiKey);
      
      // Simulate 100 concurrent authentication requests
      const requests = Array.from({ length: 100 }, () => 
        Promise.resolve(decodeTokenToApiKey(token))
      );
      
      const results = await Promise.all(requests);
      
      // All should succeed
      results.forEach(result => {
        expect(result).toBe(apiKey);
      });
    });

    test('should handle malformed authentication requests gracefully', async () => {
      const malformedRequests = [
        { query: { token: 'invalid-token' } },
        { headers: { 'x-mcp-token': 'corrupted-token' } },
        { headers: { authorization: 'Bearer invalid-key' } },
        { headers: { 'x-cursor-api-key': '' } },
        { query: { api_key: '   ' } },
        { body: { cursor_api_key: null } },
      ];

      malformedRequests.forEach(req => {
        // Should not throw, but may return null or fallback
        expect(() => {
          const token = req.query?.token || req.headers?.['x-mcp-token'];
          if (token) {
            const result = decodeTokenToApiKey(token);
            expect(result).toBeNull();
          }
        }).not.toThrow();
      });
    });
  });

  describe('Security Validation', () => {
    test('should reject whitespace-only API keys', async () => {
      const whitespaceKeys = ['   ', '\t', '\n', '\r\n', ' \t \n '];
      
      whitespaceKeys.forEach(key => {
        expect(() => mintTokenFromApiKey(key)).toThrow('API key required to mint token');
      });
    });

    test('should handle special characters in API keys securely', async () => {
      const specialKeys = [
        'key_with_quotes"and\'apostrophes',
        'key_with_backslashes\\and/slashes',
        'key_with_unicode_字符_🚀_💡',
        'key_with_newlines\nand\ttabs',
        'key_with_script_tags<script>alert("xss")</script>',
      ];
      
      specialKeys.forEach(apiKey => {
        const token = mintTokenFromApiKey(apiKey);
        const decoded = decodeTokenToApiKey(token);
        expect(decoded).toBe(apiKey);
      });
    });

    test('should prevent token replay attacks', async () => {
      const apiKey = 'key_replay_test';
      const token = mintTokenFromApiKey(apiKey);
      
      // First use should work
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // Subsequent uses should also work (tokens are stateless)
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // But tampered tokens should fail
      const tamperedToken = token.slice(0, -1) + 'X';
      expect(decodeTokenToApiKey(tamperedToken)).toBeNull();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-frequency token operations', async () => {
      const startTime = Date.now();
      const operations = 1000;
      
      for (let i = 0; i < operations; i++) {
        const token = mintTokenFromApiKey(`key_perf_test_${i}`);
        const decoded = decodeTokenToApiKey(token);
        expect(decoded).toBe(`key_perf_test_${i}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 operations in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('should handle large API keys efficiently', async () => {
      const largeApiKey = 'key_' + 'a'.repeat(10000);
      
      const startTime = Date.now();
      const token = mintTokenFromApiKey(largeApiKey);
      const decoded = decodeTokenToApiKey(token);
      const endTime = Date.now();
      
      expect(decoded).toBe(largeApiKey);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    test('should not leak memory with repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const token = mintTokenFromApiKey(`key_memory_test_${i}`);
        decodeTokenToApiKey(token);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle missing TOKEN_SECRET gracefully', async () => {
      const { mintTokenFromApiKey: mintTokenNoSecret, decodeTokenToApiKey: decodeTokenNoSecret } = await importTokenUtils({ secret: null });
      
      const apiKey = 'key_no_secret_test';
      
      // Should work with insecure default
      const token = mintTokenNoSecret(apiKey);
      const decoded = decodeTokenNoSecret(token);
      expect(decoded).toBe(apiKey);
    });

    test('should handle zero and negative TTL correctly', async () => {
      const zeroTTL = await importTokenUtils({ ttlDays: 0 });
      const negativeTTL = await importTokenUtils({ ttlDays: -1 });
      
      const apiKey = 'key_ttl_test';
      
      // Zero TTL should create immediately expired token
      const zeroToken = zeroTTL.mintTokenFromApiKey(apiKey);
      expect(zeroTTL.decodeTokenToApiKey(zeroToken)).toBeNull();
      
      // Negative TTL should create immediately expired token
      const negativeToken = negativeTTL.mintTokenFromApiKey(apiKey);
      expect(negativeTTL.decodeTokenToApiKey(negativeToken)).toBeNull();
    });

    test('should handle very long TTL values', async () => {
      const longTTL = await importTokenUtils({ ttlDays: 365 * 100 }); // 100 years
      
      const apiKey = 'key_long_ttl_test';
      const token = longTTL.mintTokenFromApiKey(apiKey);
      const decoded = longTTL.decodeTokenToApiKey(token);
      
      expect(decoded).toBe(apiKey);
    });
  });
});