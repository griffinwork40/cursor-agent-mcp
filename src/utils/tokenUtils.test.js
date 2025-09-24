import { mintTokenFromApiKey, decodeTokenToApiKey } from '../utils/tokenUtils.js';

describe('Token Utilities', () => {
  const testApiKey = 'test-api-key-12345';

  describe('mintTokenFromApiKey', () => {
    test('should create a valid token from API key', () => {
      const token = mintTokenFromApiKey(testApiKey);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      // Token should be base64url encoded
      expect(() => {
        Buffer.from(token, 'base64url');
      }).not.toThrow();
    });

    test('should create different tokens for same API key', () => {
      const token1 = mintTokenFromApiKey(testApiKey);
      const token2 = mintTokenFromApiKey(testApiKey);
      
      // Tokens should be different due to random IV
      expect(token1).not.toBe(token2);
    });

    test('should throw error for invalid API key', () => {
      expect(() => {
        mintTokenFromApiKey(null);
      }).toThrow('API key required to mint token');
      
      expect(() => {
        mintTokenFromApiKey(undefined);
      }).toThrow('API key required to mint token');
      
      expect(() => {
        mintTokenFromApiKey(123);
      }).toThrow('API key required to mint token');
    });

    test('should throw error for empty API key', () => {
      expect(() => {
        mintTokenFromApiKey('');
      }).toThrow('API key required to mint token');
    });
  });

  describe('decodeTokenToApiKey', () => {
    test('should decode valid token back to API key', () => {
      const token = mintTokenFromApiKey(testApiKey);
      const decodedApiKey = decodeTokenToApiKey(token);
      
      expect(decodedApiKey).toBe(testApiKey);
    });

    test('should return null for invalid token', () => {
      const invalidToken = 'invalid-token';
      const result = decodeTokenToApiKey(invalidToken);
      
      expect(result).toBeNull();
    });

    test('should return null for empty token', () => {
      const result = decodeTokenToApiKey('');
      expect(result).toBeNull();
    });

    test('should return null for null token', () => {
      const result = decodeTokenToApiKey(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined token', () => {
      const result = decodeTokenToApiKey(undefined);
      expect(result).toBeNull();
    });

    test('should return null for malformed token', () => {
      const malformedToken = 'not-base64url-encoded';
      const result = decodeTokenToApiKey(malformedToken);
      
      expect(result).toBeNull();
    });

    test('should return null for token with wrong structure', () => {
      // Create a valid base64url string but with wrong internal structure
      const wrongStructure = Buffer.from('wrong-structure').toString('base64url');
      const result = decodeTokenToApiKey(wrongStructure);
      
      expect(result).toBeNull();
    });
  });

  describe('Token round-trip', () => {
    test('should preserve API key through mint/decode cycle', () => {
      const originalApiKey = 'sk-test-key-12345';
      const token = mintTokenFromApiKey(originalApiKey);
      const decodedApiKey = decodeTokenToApiKey(token);
      
      expect(decodedApiKey).toBe(originalApiKey);
    });

    test('should work with various API key formats', () => {
      const apiKeys = [
        'sk-1234567890abcdef',
        'cursor_api_key_12345',
        'test-key-with-special-chars!@#$%',
        'a'.repeat(100), // Long key
        'short',
      ];

      apiKeys.forEach(apiKey => {
        const token = mintTokenFromApiKey(apiKey);
        const decodedApiKey = decodeTokenToApiKey(token);
        expect(decodedApiKey).toBe(apiKey);
      });
    });
  });

  describe('Token security', () => {
    test('should use different IV for each token', () => {
      const token1 = mintTokenFromApiKey(testApiKey);
      const token2 = mintTokenFromApiKey(testApiKey);
      
      // Extract IVs from tokens
      const buf1 = Buffer.from(token1, 'base64url');
      const buf2 = Buffer.from(token2, 'base64url');
      
      const iv1 = buf1.subarray(0, 12);
      const iv2 = buf2.subarray(0, 12);
      
      // IVs should be different
      expect(iv1.equals(iv2)).toBe(false);
    });

    test('should include authentication tag', () => {
      const token = mintTokenFromApiKey(testApiKey);
      const buf = Buffer.from(token, 'base64url');
      
      // Should have IV (12 bytes) + tag (16 bytes) + ciphertext
      expect(buf.length).toBeGreaterThan(28);
      
      // Extract tag
      const tag = buf.subarray(12, 28);
      expect(tag.length).toBe(16);
    });
  });

  describe('Edge cases', () => {
    test('should handle very long API keys', () => {
      const longApiKey = 'a'.repeat(10000);
      const token = mintTokenFromApiKey(longApiKey);
      const decodedApiKey = decodeTokenToApiKey(token);
      
      expect(decodedApiKey).toBe(longApiKey);
    });

    test('should handle API keys with special characters', () => {
      const specialApiKey = 'sk-test-key-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?';
      const token = mintTokenFromApiKey(specialApiKey);
      const decodedApiKey = decodeTokenToApiKey(token);
      
      expect(decodedApiKey).toBe(specialApiKey);
    });

    test('should handle Unicode API keys', () => {
      const unicodeApiKey = 'sk-test-key-with-unicode-🚀-测试';
      const token = mintTokenFromApiKey(unicodeApiKey);
      const decodedApiKey = decodeTokenToApiKey(token);
      
      expect(decodedApiKey).toBe(unicodeApiKey);
    });
  });
});