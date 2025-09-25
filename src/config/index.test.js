import { jest } from '@jest/globals';

// Store original environment
const originalEnv = { ...process.env };

// Mock console.warn to capture warnings
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('Configuration Module', () => {
  beforeEach(() => {
    // Clear all environment variables
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    
    // Reset mocks
    jest.clearAllMocks();
    mockConsoleWarn.mockClear();
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  describe('Environment Variable Loading and Validation', () => {
    test('should load environment variables from process.env', async () => {
      process.env.PORT = '8080';
      process.env.CURSOR_API_KEY = 'test-api-key';
      process.env.CURSOR_API_URL = 'https://custom.api.com';
      process.env.TOKEN_SECRET = 'test-secret';
      process.env.TOKEN_TTL_DAYS = '60';

      // Dynamic import to get fresh config with new env vars
      const configModule = await import('./index.js?t=' + Date.now());
      const freshConfig = configModule.config;

      expect(freshConfig.port).toBe('8080');
      expect(freshConfig.cursor.apiKey).toBe('test-api-key');
      expect(freshConfig.cursor.apiUrl).toBe('https://custom.api.com');
      expect(freshConfig.token.secret).toBe('test-secret');
      expect(freshConfig.token.ttlDays).toBe(60);
    });

    test('should handle missing environment variables gracefully', async () => {
      // No environment variables set
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe(3000); // default
      expect(config.cursor.apiKey).toBeUndefined();
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com'); // default
      expect(config.token.secret).toBeUndefined();
      expect(config.token.ttlDays).toBe(30); // default
    });
  });

  describe('Default Value Assignment', () => {
    test('should assign correct default values', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe(3000);
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
      expect(config.token.ttlDays).toBe(30);
      expect(config.cursor.apiKey).toBeUndefined();
      expect(config.token.secret).toBeUndefined();
    });
  });

  describe('Configuration Object Structure and Type Validation', () => {
    test('should have correct structure and types', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      // Structure
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('cursor');
      expect(config).toHaveProperty('token');
      expect(config.cursor).toHaveProperty('apiKey');
      expect(config.cursor).toHaveProperty('apiUrl');
      expect(config.token).toHaveProperty('secret');
      expect(config.token).toHaveProperty('ttlDays');
      
      // Types (port is string from env, only ttlDays is converted to number)
      expect(typeof config.port).toBe('number');
      expect(typeof config.cursor.apiUrl).toBe('string');
      expect(typeof config.token.ttlDays).toBe('number');
    });
  });

  describe('Warning Behavior for Missing TOKEN_SECRET', () => {
    test('should warn when TOKEN_SECRET is not set', async () => {
      // Import without TOKEN_SECRET set
      await import('./index.js?t=' + Date.now());
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'TOKEN_SECRET not set - token-based connections will be ephemeral per process and cannot be revoked across restarts.'
      );
    });

    test('should not warn when TOKEN_SECRET is set', async () => {
      process.env.TOKEN_SECRET = 'test-secret';
      
      await import('./index.js?t=' + Date.now());
      
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    test('should warn when TOKEN_SECRET is empty string', async () => {
      process.env.TOKEN_SECRET = '';
      
      await import('./index.js?t=' + Date.now());
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'TOKEN_SECRET not set - token-based connections will be ephemeral per process and cannot be revoked across restarts.'
      );
    });
  });

  describe('Port Configuration', () => {
    test('should use default port when PORT not set', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.port).toBe(3000);
    });

    test('should use custom port when PORT is set', async () => {
      process.env.PORT = '8080';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.port).toBe('8080');
    });

    test('should preserve port as string (no conversion)', async () => {
      process.env.PORT = '9000';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(typeof configModule.config.port).toBe('string');
      expect(configModule.config.port).toBe('9000');
    });

    test('should handle invalid port values', async () => {
      process.env.PORT = 'invalid';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.port).toBe('invalid');
    });

    test('should handle zero port', async () => {
      process.env.PORT = '0';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.port).toBe('0');
    });

    test('should handle negative port', async () => {
      process.env.PORT = '-1';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.port).toBe('-1');
    });
  });

  describe('API URL Configuration', () => {
    test('should use default API URL when CURSOR_API_URL not set', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiUrl).toBe('https://api.cursor.com');
    });

    test('should use custom API URL when CURSOR_API_URL is set', async () => {
      process.env.CURSOR_API_URL = 'https://custom.cursor.api.com';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiUrl).toBe('https://custom.cursor.api.com');
    });

    test('should use default when API URL is empty string', async () => {
      process.env.CURSOR_API_URL = '';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiUrl).toBe('https://api.cursor.com'); // empty string falls back to default
    });

    test('should handle API URL with different protocols', async () => {
      const urls = [
        'http://api.cursor.com',
        'https://api.cursor.com',
        'ws://api.cursor.com',
        'wss://api.cursor.com',
      ];

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        // Clear environment first
        Object.keys(process.env).forEach(key => delete process.env[key]);
        process.env.CURSOR_API_URL = url;
        const configModule = await import('./index.js?t=' + Date.now() + '_' + i);
        expect(configModule.config.cursor.apiUrl).toBe(url);
      }
    });

    test('should handle API URL with ports and paths', async () => {
      process.env.CURSOR_API_URL = 'https://api.cursor.com:8080/v1';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiUrl).toBe('https://api.cursor.com:8080/v1');
    });
  });

  describe('Token TTL Configuration', () => {
    test('should use default TTL when TOKEN_TTL_DAYS not set', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.token.ttlDays).toBe(30);
    });

    test('should use custom TTL when TOKEN_TTL_DAYS is set', async () => {
      process.env.TOKEN_TTL_DAYS = '60';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.token.ttlDays).toBe(60);
    });

    test('should convert TTL string to number', async () => {
      process.env.TOKEN_TTL_DAYS = '90';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(typeof configModule.config.token.ttlDays).toBe('number');
      expect(configModule.config.token.ttlDays).toBe(90);
    });

    test('should handle zero TTL', async () => {
      process.env.TOKEN_TTL_DAYS = '0';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.token.ttlDays).toBe(0);
    });

    test('should handle negative TTL', async () => {
      process.env.TOKEN_TTL_DAYS = '-1';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.token.ttlDays).toBe(-1);
    });

    test('should handle invalid TTL values', async () => {
      process.env.TOKEN_TTL_DAYS = 'invalid';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(Number.isNaN(configModule.config.token.ttlDays)).toBe(true);
    });

    test('should handle decimal TTL values', async () => {
      process.env.TOKEN_TTL_DAYS = '30.5';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.token.ttlDays).toBe(30.5);
    });

    test('should handle very large TTL values', async () => {
      process.env.TOKEN_TTL_DAYS = '999999';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.token.ttlDays).toBe(999999);
    });
  });

  describe('Cursor API Key Configuration', () => {
    test('should be undefined when CURSOR_API_KEY not set', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiKey).toBeUndefined();
    });

    test('should use custom API key when CURSOR_API_KEY is set', async () => {
      process.env.CURSOR_API_KEY = 'sk-test-api-key-12345';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiKey).toBe('sk-test-api-key-12345');
    });

    test('should handle empty API key', async () => {
      process.env.CURSOR_API_KEY = '';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiKey).toBe('');
    });

    test('should handle API key with special characters', async () => {
      const specialKey = 'sk-test-key-with-special-chars!@#$%^&*()';
      process.env.CURSOR_API_KEY = specialKey;
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiKey).toBe(specialKey);
    });

    test('should handle very long API key', async () => {
      const longKey = 'a'.repeat(1000);
      process.env.CURSOR_API_KEY = longKey;
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.cursor.apiKey).toBe(longKey);
    });

    test('should preserve API key type as string', async () => {
      process.env.CURSOR_API_KEY = 'sk-test-key';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(typeof configModule.config.cursor.apiKey).toBe('string');
    });
  });

  describe('Environment Variable Precedence', () => {
    test('should prioritize environment variables over defaults', async () => {
      process.env.PORT = '8080';
      process.env.CURSOR_API_URL = 'https://custom.api.com';
      process.env.TOKEN_TTL_DAYS = '60';
      
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe('8080');
      expect(config.cursor.apiUrl).toBe('https://custom.api.com');
      expect(config.token.ttlDays).toBe(60);
    });

    test('should use defaults when environment variables are not set', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe(3000);
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
      expect(config.token.ttlDays).toBe(30);
    });

    test('should handle mixed environment variable and default usage', async () => {
      process.env.PORT = '8080';
      // CURSOR_API_URL and TOKEN_TTL_DAYS not set
      
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe('8080'); // from env
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com'); // default
      expect(config.token.ttlDays).toBe(30); // default
    });
  });

  describe('Invalid Environment Variable Handling', () => {
    test('should handle undefined environment variables', async () => {
      process.env.PORT = undefined;
      process.env.CURSOR_API_KEY = undefined;
      
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe('undefined'); // undefined becomes string "undefined"
      expect(config.cursor.apiKey).toBe('undefined'); // undefined becomes string "undefined"
    });

    test('should handle null environment variables', async () => {
      process.env.PORT = null;
      process.env.CURSOR_API_KEY = null;
      
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe('null'); // null becomes string "null"
      expect(config.cursor.apiKey).toBe('null'); // converted to string
    });

    test('should handle whitespace-only environment variables', async () => {
      process.env.PORT = '   ';
      process.env.CURSOR_API_KEY = '   ';
      
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe('   '); // whitespace is truthy, so it's used
      expect(config.cursor.apiKey).toBe('   ');
    });

    test('should not warn when TOKEN_SECRET contains whitespace', async () => {
      process.env.TOKEN_SECRET = '   ';
      
      await import('./index.js?t=' + Date.now());
      
      // Should not warn because whitespace is truthy
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Export Structure', () => {
    test('should export config as named export', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      
      expect(configModule).toHaveProperty('config');
      expect(configModule.config).toBeDefined();
    });

    test('should not export other properties', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      
      const exportedKeys = Object.keys(configModule);
      expect(exportedKeys).toEqual(['config']);
    });

    test('should export config as object', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      
      expect(typeof configModule.config).toBe('object');
      expect(configModule.config).not.toBeNull();
    });

    test('should have consistent export structure across different environments', async () => {
      // Test with different environment setups
      const environments = [
        { PORT: '8080', CURSOR_API_KEY: 'test-key' },
        { TOKEN_SECRET: 'secret', TOKEN_TTL_DAYS: '60' },
        {}, // empty environment
      ];

      for (const env of environments) {
        // Set environment
        Object.keys(process.env).forEach(key => delete process.env[key]);
        Object.assign(process.env, env);
        
        const configModule = await import('./index.js?t=' + Date.now());
        const config = configModule.config;
        
        // Should always have the same structure
        expect(config).toHaveProperty('port');
        expect(config).toHaveProperty('cursor');
        expect(config).toHaveProperty('token');
        expect(config.cursor).toHaveProperty('apiKey');
        expect(config.cursor).toHaveProperty('apiUrl');
        expect(config.token).toHaveProperty('secret');
        expect(config.token).toHaveProperty('ttlDays');
      }
    });

    test('should be importable as ES module', async () => {
      // This test ensures the module can be imported using ES6 import syntax
      await expect(async () => {
        const configModule = await import('./index.js?t=' + Date.now());
        const { config } = configModule;
        expect(config).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle very large port numbers', async () => {
      process.env.PORT = '65535';
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.port).toBe('65535');
    });

    test('should handle very large TTL values', async () => {
      process.env.TOKEN_TTL_DAYS = '365000'; // 1000 years
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config.token.ttlDays).toBe(365000);
    });

    test('should handle Unicode characters in environment variables', async () => {
      process.env.CURSOR_API_KEY = 'sk-test-key-🚀-测试';
      process.env.CURSOR_API_URL = 'https://api.cursor.com/测试';
      
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.cursor.apiKey).toBe('sk-test-key-🚀-测试');
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com/测试');
    });
  });

  describe('Integration Tests', () => {
    test('should work with all environment variables set', async () => {
      process.env.PORT = '8080';
      process.env.CURSOR_API_KEY = 'sk-test-key-12345';
      process.env.CURSOR_API_URL = 'https://custom.api.com';
      process.env.TOKEN_SECRET = 'test-secret-key';
      process.env.TOKEN_TTL_DAYS = '60';
      
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      expect(config.port).toBe('8080');
      expect(config.cursor.apiKey).toBe('sk-test-key-12345');
      expect(config.cursor.apiUrl).toBe('https://custom.api.com');
      expect(config.token.secret).toBe('test-secret-key');
      expect(config.token.ttlDays).toBe(60);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    test('should work with no environment variables set', async () => {
      const configModule = await import('./index.js?t=' + Date.now());
      const config = configModule.config;
      
      // All defaults should be used
      expect(config.port).toBe(3000);
      expect(config.cursor.apiKey).toBeUndefined();
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
      expect(config.token.secret).toBeUndefined();
      expect(config.token.ttlDays).toBe(30);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'TOKEN_SECRET not set - token-based connections will be ephemeral per process and cannot be revoked across restarts.'
      );
    });

    test('should maintain configuration consistency across multiple imports', async () => {
      const configModule1 = await import('./index.js?t=' + Date.now());
      const config1 = configModule1.config;
      
      const configModule2 = await import('./index.js?t=' + Date.now() + 1);
      const config2 = configModule2.config;
      
      // Both should have the same default values
      expect(config1.port).toBe(config2.port);
      expect(config1.cursor.apiUrl).toBe(config2.cursor.apiUrl);
      expect(config1.token.ttlDays).toBe(config2.token.ttlDays);
    });
  });

  describe('Dotenv Integration', () => {
    test('should work with dotenv loading', async () => {
      // This test verifies that the module loads without errors
      // The actual dotenv loading is tested implicitly through other tests
      const configModule = await import('./index.js?t=' + Date.now());
      expect(configModule.config).toBeDefined();
      expect(typeof configModule.config).toBe('object');
    });
  });
});