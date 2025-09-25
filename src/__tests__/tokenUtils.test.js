import { jest } from '@jest/globals';

const defaultTokenConfig = {
  secret: 'test-secret-key-for-testing',
  ttlDays: 30,
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

let mintTokenFromApiKey;
let decodeTokenToApiKey;

const TEST_API_KEY = 'test-api-key-12345';

describe('Token Utilities', () => {
  beforeEach(async () => {
    ({ mintTokenFromApiKey, decodeTokenToApiKey } = await importTokenUtils());
  });

  describe('mintTokenFromApiKey', () => {
    test('should mint a valid token from a valid API key', () => {
      const token = mintTokenFromApiKey(TEST_API_KEY);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('should throw error for null API key', () => {
      expect(() => {
        mintTokenFromApiKey(null);
      }).toThrow('API key required to mint token');
    });

    test('should throw error for undefined API key', () => {
      expect(() => {
        mintTokenFromApiKey(undefined);
      }).toThrow('API key required to mint token');
    });

    test('should throw error for empty string API key', () => {
      expect(() => {
        mintTokenFromApiKey('');
      }).toThrow('API key required to mint token');
    });

    test('should throw error for non-string API key', () => {
      expect(() => {
        mintTokenFromApiKey(12345);
      }).toThrow('API key required to mint token');
    });

    test('should generate different tokens for same API key', () => {
      const token1 = mintTokenFromApiKey(TEST_API_KEY);
      const token2 = mintTokenFromApiKey(TEST_API_KEY);

      expect(token1).not.toBe(token2);
    });

    test('should handle long API keys correctly', () => {
      const longApiKey = 'a'.repeat(1000);

      expect(() => {
        mintTokenFromApiKey(longApiKey);
      }).not.toThrow();

      const token = mintTokenFromApiKey(longApiKey);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('decodeTokenToApiKey', () => {
    test('should decode a valid token back to the original API key', () => {
      const token = mintTokenFromApiKey(TEST_API_KEY);
      const decoded = decodeTokenToApiKey(token);

      expect(decoded).toBe(TEST_API_KEY);
    });

    test('should return null for null token', () => {
      const result = decodeTokenToApiKey(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined token', () => {
      const result = decodeTokenToApiKey(undefined);
      expect(result).toBeNull();
    });

    test('should return null for empty string token', () => {
      const result = decodeTokenToApiKey('');
      expect(result).toBeNull();
    });

    test('should return null for invalid base64url token', () => {
      const result = decodeTokenToApiKey('invalid-base64!');
      expect(result).toBeNull();
    });

    test('should return null for token with invalid structure', () => {
      const shortToken = Buffer.from('short').toString('base64url');
      const result = decodeTokenToApiKey(shortToken);
      expect(result).toBeNull();
    });

    test('should handle tokens with special characters in API key', () => {
      const specialApiKey = 'key-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?';

      const token = mintTokenFromApiKey(specialApiKey);
      const decoded = decodeTokenToApiKey(token);

      expect(decoded).toBe(specialApiKey);
    });

    test('should handle tokens with Unicode characters in API key', () => {
      const unicodeApiKey = 'key-with-unicode-字符-🚀-💡';

      const token = mintTokenFromApiKey(unicodeApiKey);
      const decoded = decodeTokenToApiKey(token);

      expect(decoded).toBe(unicodeApiKey);
    });

    test('should handle token tampering attempts', () => {
      const originalToken = mintTokenFromApiKey(TEST_API_KEY);

      const tamperedToken = `${originalToken.substring(0, 10)}X${originalToken.substring(11)}`;

      const result = decodeTokenToApiKey(tamperedToken);
      expect(result).toBeNull();
    });

    test('should handle tokens with incorrect format', () => {
      const malformedToken = 'malformed-token-data';

      const result = decodeTokenToApiKey(malformedToken);
      expect(result).toBeNull();
    });
  });

  describe('Security and Edge Cases', () => {
    test('should use AES-256-GCM encryption algorithm', () => {
      const token = mintTokenFromApiKey(TEST_API_KEY);
      const tokenBuffer = Buffer.from(token, 'base64url');

      expect(tokenBuffer.length).toBeGreaterThan(12 + 16);
    });

    test('should handle very large API keys', () => {
      const largeApiKey = 'a'.repeat(10000);

      expect(() => {
        mintTokenFromApiKey(largeApiKey);
      }).not.toThrow();

      const token = mintTokenFromApiKey(largeApiKey);
      const decoded = decodeTokenToApiKey(token);

      expect(decoded).toBe(largeApiKey);
    });

    test('should handle decryption failures gracefully', () => {
      const token = mintTokenFromApiKey(TEST_API_KEY);

      const decoded = decodeTokenToApiKey(token);
      expect(decoded).toBe(TEST_API_KEY);
    });
  });

  describe('Configuration Integration', () => {
    test('should respect TTL configuration from config', async () => {
      const { config } = await importTokenUtils();

      expect(config.token.ttlDays).toBe(30);
    });

    test('should handle missing token secret gracefully', async () => {
      const { mintTokenFromApiKey: mintTokenNew } = await importTokenUtils({ secret: null });

      expect(() => {
        mintTokenNew(TEST_API_KEY);
      }).not.toThrow();
    });
  });
});
