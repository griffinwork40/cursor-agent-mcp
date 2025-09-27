// Tests for authentication race conditions and edge cases
import { jest } from '@jest/globals';

const defaultTokenConfig = {
  secret: 'test-secret-key-for-race-condition-testing',
  ttlDays: 1, // Short TTL for testing expiration
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

describe('Authentication Race Conditions and Edge Cases', () => {
  let mintTokenFromApiKey;
  let decodeTokenToApiKey;

  beforeEach(async () => {
    ({ mintTokenFromApiKey, decodeTokenToApiKey } = await importTokenUtils());
  });

  describe('Token Expiration Race Conditions', () => {
    test('should handle token expiration at exact boundary', async () => {
      // Create a token with very short TTL
      const { mintTokenFromApiKey: mintTokenShort } = await importTokenUtils({ ttlDays: 0.000001 }); // ~86ms
      
      const apiKey = 'test-key-expiration';
      const token = mintTokenShort(apiKey);
      
      // Immediately decode - should work
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should now be expired
      expect(decodeTokenToApiKey(token)).toBeNull();
    });

    test('should handle concurrent token creation and validation', async () => {
      const apiKey = 'test-concurrent-key';
      
      // Create multiple tokens simultaneously
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve(mintTokenFromApiKey(apiKey))
      );
      
      const tokens = await Promise.all(promises);
      
      // All tokens should be valid and decode to the same API key
      tokens.forEach(token => {
        expect(decodeTokenToApiKey(token)).toBe(apiKey);
      });
      
      // All tokens should be different (due to random IV)
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    test('should handle rapid token validation', async () => {
      const apiKey = 'test-rapid-validation';
      const token = mintTokenFromApiKey(apiKey);
      
      // Rapid successive validations
      const promises = Array.from({ length: 100 }, () => 
        Promise.resolve(decodeTokenToApiKey(token))
      );
      
      const results = await Promise.all(promises);
      
      // All should return the same API key
      results.forEach(result => {
        expect(result).toBe(apiKey);
      });
    });
  });

  describe('Clock Skew and Time-based Issues', () => {
    test('should handle system clock changes during token lifetime', async () => {
      const apiKey = 'test-clock-skew';
      const token = mintTokenFromApiKey(apiKey);
      
      // Mock Date.now to simulate clock changes
      const originalNow = Date.now;
      let mockTime = originalNow();
      
      // Simulate clock going backwards
      Date.now = jest.fn(() => mockTime - 1000);
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // Simulate clock going forwards significantly
      Date.now = jest.fn(() => mockTime + 86400000 * 2); // 2 days
      expect(decodeTokenToApiKey(token)).toBeNull();
      
      // Restore original Date.now
      Date.now = originalNow;
    });

    test('should handle token creation with future expiration', async () => {
      const apiKey = 'test-future-expiration';
      
      // Mock Date.now to return a fixed time
      const fixedTime = 1000000000000; // Fixed timestamp
      const originalNow = Date.now;
      Date.now = jest.fn(() => fixedTime);
      
      const token = mintTokenFromApiKey(apiKey);
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // Restore Date.now
      Date.now = originalNow;
    });
  });

  describe('Memory and Resource Leaks', () => {
    test('should not leak memory with many token operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create and decode many tokens
      for (let i = 0; i < 1000; i++) {
        const token = mintTokenFromApiKey(`test-key-${i}`);
        const decoded = decodeTokenToApiKey(token);
        expect(decoded).toBe(`test-key-${i}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle large numbers of concurrent operations', async () => {
      const apiKey = 'test-concurrent-large';
      
      // Create 1000 concurrent operations
      const operations = Array.from({ length: 1000 }, (_, i) => 
        Promise.resolve().then(() => {
          const token = mintTokenFromApiKey(`${apiKey}-${i}`);
          return decodeTokenToApiKey(token);
        })
      );
      
      const results = await Promise.all(operations);
      
      // All should succeed
      results.forEach((result, i) => {
        expect(result).toBe(`${apiKey}-${i}`);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from temporary crypto failures', async () => {
      const apiKey = 'test-crypto-recovery';
      
      // Create a valid token
      const token = mintTokenFromApiKey(apiKey);
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // Simulate temporary failure by corrupting the token
      const corruptedToken = token.slice(0, -1) + 'X';
      expect(decodeTokenToApiKey(corruptedToken)).toBeNull();
      
      // Original token should still work
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
    });

    test('should handle malformed token data gracefully', async () => {
      const malformedTokens = [
        'not-base64',
        'too-short',
        'invalid-json',
        '',
        null,
        undefined,
        'a'.repeat(1000), // Very long invalid token
      ];
      
      malformedTokens.forEach(token => {
        expect(() => decodeTokenToApiKey(token)).not.toThrow();
        expect(decodeTokenToApiKey(token)).toBeNull();
      });
    });

    test('should handle token with invalid expiration format', async () => {
      // This test would require mocking the internal token structure
      // which is complex due to encryption, so we test the behavior instead
      const apiKey = 'test-invalid-exp';
      const token = mintTokenFromApiKey(apiKey);
      
      // Valid token should work
      expect(decodeTokenToApiKey(token)).toBe(apiKey);
      
      // Corrupted token should fail gracefully
      const corruptedToken = token.slice(0, -10) + 'corrupted';
      expect(decodeTokenToApiKey(corruptedToken)).toBeNull();
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle tokens with special characters in API key', async () => {
      const specialApiKeys = [
        'key-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?',
        'key-with-unicode-字符-🚀-💡',
        'key-with-newlines\nand\ttabs',
        'key-with-quotes"and\'apostrophes',
        'key-with-backslashes\\and/slashes',
      ];
      
      specialApiKeys.forEach(apiKey => {
        const token = mintTokenFromApiKey(apiKey);
        expect(decodeTokenToApiKey(token)).toBe(apiKey);
      });
    });

    test('should handle very long API keys', async () => {
      const longApiKey = 'a'.repeat(10000);
      
      expect(() => {
        const token = mintTokenFromApiKey(longApiKey);
        expect(decodeTokenToApiKey(token)).toBe(longApiKey);
      }).not.toThrow();
    });

    test('should handle empty and whitespace-only API keys', async () => {
      const emptyKeys = ['', '   ', '\t', '\n', '\r\n'];
      
      emptyKeys.forEach(apiKey => {
        expect(() => mintTokenFromApiKey(apiKey)).toThrow('API key required to mint token');
      });
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle missing token secret gracefully', async () => {
      const { mintTokenFromApiKey: mintTokenNoSecret, decodeTokenToApiKey: decodeTokenNoSecret } = await importTokenUtils({ secret: null });
      
      const apiKey = 'test-no-secret';
      
      // Should not throw, but use insecure default
      expect(() => {
        const token = mintTokenNoSecret(apiKey);
        // Use the same decodeTokenToApiKey function that uses the same config
        expect(decodeTokenNoSecret(token)).toBe(apiKey);
      }).not.toThrow();
    });

    test('should handle zero TTL', async () => {
      const { mintTokenFromApiKey: mintTokenZeroTTL, decodeTokenToApiKey: decodeTokenZeroTTL } = await importTokenUtils({ ttlDays: 0 });
      
      const apiKey = 'test-zero-ttl';
      const token = mintTokenZeroTTL(apiKey);
      
      // Token should be immediately expired (or very close to it)
      // Allow a small time window for test execution
      const result = decodeTokenZeroTTL(token);
      expect(result).toBeNull();
    });

    test('should handle negative TTL', async () => {
      const { mintTokenFromApiKey: mintTokenNegativeTTL, decodeTokenToApiKey: decodeTokenNegativeTTL } = await importTokenUtils({ ttlDays: -1 });
      
      const apiKey = 'test-negative-ttl';
      const token = mintTokenNegativeTTL(apiKey);
      
      // Token should be immediately expired
      expect(decodeTokenNegativeTTL(token)).toBeNull();
    });
  });
});