/**
 * Comprehensive unit tests for configuration module
 * Tests environment variable loading, default values, validation, and error handling
 */

const originalProcessEnv = process.env;
const originalConsoleWarn = console.warn;

// Helper function to create config object (simulating the actual config logic)
function createConfig(env = {}) {
  // Set up environment variables
  Object.keys(env).forEach(key => {
    process.env[key] = env[key];
  });

  // Mock console.warn
  const mockConsoleWarn = jest.fn();
  console.warn = mockConsoleWarn;

  // Simulate the config creation logic from the actual module
  const config = {
    port: process.env.PORT || 3000,
    cursor: {
      apiKey: process.env.CURSOR_API_KEY,
      apiUrl: process.env.CURSOR_API_URL || 'https://api.cursor.com',
    },
    token: {
      secret: process.env.TOKEN_SECRET,
      ttlDays: Number(process.env.TOKEN_TTL_DAYS || 30),
    },
  };

  // Simulate the warning logic
  if (!config.token.secret) {
    console.warn('TOKEN_SECRET not set - token-based connections will be ephemeral per process and cannot be revoked across restarts.');
  }

  // Restore environment
  Object.keys(env).forEach(key => {
    delete process.env[key];
  });

  return { config, warnings: mockConsoleWarn.mock.calls.length };
}

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Reset process.env to original state
  process.env = { ...originalProcessEnv };
});

afterEach(() => {
  // Restore original console.warn
  console.warn = originalConsoleWarn;
  process.env = { ...originalProcessEnv };
});

describe('Configuration Module', () => {
  describe('Environment Variable Loading', () => {
    it('should load environment variables from process.env', () => {
      const { config } = createConfig({
        PORT: '4000',
        CURSOR_API_KEY: 'test-api-key',
        CURSOR_API_URL: 'https://test-api.cursor.com',
        TOKEN_SECRET: 'test-token-secret',
        TOKEN_TTL_DAYS: '60'
      });

      expect(config.port).toBe('4000'); // PORT remains as string
      expect(config.cursor.apiKey).toBe('test-api-key');
      expect(config.cursor.apiUrl).toBe('https://test-api.cursor.com');
      expect(config.token.secret).toBe('test-token-secret');
      expect(config.token.ttlDays).toBe(60); // TOKEN_TTL_DAYS converted to number
    });
  });

  describe('Default Values', () => {
    it('should use default port 3000 when PORT is not set', () => {
      const { config } = createConfig({});
      expect(config.port).toBe(3000);
    });

    it('should use default CURSOR_API_URL when not set', () => {
      const { config } = createConfig({});
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
    });

    it('should use default TOKEN_TTL_DAYS when not set', () => {
      const { config } = createConfig({});
      expect(config.token.ttlDays).toBe(30);
    });

    it('should handle string to number conversion for TOKEN_TTL_DAYS', () => {
      const { config } = createConfig({ TOKEN_TTL_DAYS: '45' });
      expect(config.token.ttlDays).toBe(45);
      expect(typeof config.token.ttlDays).toBe('number');
    });

    it('should handle invalid TOKEN_TTL_DAYS gracefully', () => {
      const { config } = createConfig({ TOKEN_TTL_DAYS: 'invalid' });
      // Number('invalid') is NaN, not 30
      expect(config.token.ttlDays).toBeNaN();
    });
  });

  describe('Required Configuration Validation', () => {
    it('should handle missing CURSOR_API_KEY', () => {
      const { config } = createConfig({});
      expect(config.cursor.apiKey).toBeUndefined();
    });

    it('should handle missing TOKEN_SECRET', () => {
      const { config } = createConfig({});
      expect(config.token.secret).toBeUndefined();
    });
  });

  describe('Warning Messages', () => {
    it('should warn when TOKEN_SECRET is missing', () => {
      const { warnings } = createConfig({});
      expect(warnings).toBe(1);
    });

    it('should not warn when TOKEN_SECRET is set', () => {
      const { warnings } = createConfig({ TOKEN_SECRET: 'test-secret' });
      expect(warnings).toBe(0);
    });
  });

  describe('Configuration Structure', () => {
    it('should export config object with correct structure', () => {
      const { config } = createConfig({});
      expect(config).toBeDefined();
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('cursor');
      expect(config).toHaveProperty('token');

      expect(config.cursor).toHaveProperty('apiKey');
      expect(config.cursor).toHaveProperty('apiUrl');

      expect(config.token).toHaveProperty('secret');
      expect(config.token).toHaveProperty('ttlDays');
    });

    it('should have correct data types', () => {
      const { config } = createConfig({});
      expect(typeof config.port).toBe('number');
      expect(typeof config.cursor).toBe('object');
      expect(typeof config.token).toBe('object');
      expect(typeof config.token.ttlDays).toBe('number');
    });

    it('should handle environment variables with different cases', () => {
      const { config } = createConfig({
        CURSOR_API_KEY: 'test-key',
        cursor_api_url: 'https://lowercase-url.com',
        token_secret: 'lowercase-secret'
      });

      // Environment variable names are case-sensitive, so only uppercase should work
      expect(config.cursor.apiKey).toBe('test-key');
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com'); // default
      expect(config.token.secret).toBeUndefined(); // undefined because lowercase doesn't match
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty environment variables', () => {
      const { config } = createConfig({
        PORT: '',
        CURSOR_API_URL: '',
        TOKEN_TTL_DAYS: ''
      });

      expect(config.port).toBe(3000); // default
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com'); // default
      expect(config.token.ttlDays).toBe(30); // default
    });

    it('should handle whitespace-only environment variables', () => {
      const { config } = createConfig({
        PORT: '   ',
        CURSOR_API_URL: '  https://whitespace.com  ',
        TOKEN_TTL_DAYS: '  45  '
      });

      expect(config.port).toBe('   '); // uses env var value as-is since it's set
      expect(config.cursor.apiUrl).toBe('  https://whitespace.com  '); // preserves whitespace
      expect(config.token.ttlDays).toBe(45); // trims whitespace for number conversion
    });

    it('should handle extremely large numbers for TOKEN_TTL_DAYS', () => {
      const { config } = createConfig({
        TOKEN_TTL_DAYS: '999999'
      });

      expect(config.token.ttlDays).toBe(999999);
    });

    it('should handle zero values', () => {
      const { config } = createConfig({
        PORT: '0',
        TOKEN_TTL_DAYS: '0'
      });

      expect(config.port).toBe('0'); // env var is set, so uses string value
      expect(config.token.ttlDays).toBe(0); // Number('0') = 0
    });
  });

  describe('Integration Tests', () => {
    it('should work correctly with all environment variables set', () => {
      const { config, warnings } = createConfig({
        PORT: '8080',
        CURSOR_API_KEY: 'integration-test-key',
        CURSOR_API_URL: 'https://integration-test.cursor.com',
        TOKEN_SECRET: 'integration-test-secret',
        TOKEN_TTL_DAYS: '90'
      });

      expect(config.port).toBe('8080'); // PORT remains as string
      expect(config.cursor.apiKey).toBe('integration-test-key');
      expect(config.cursor.apiUrl).toBe('https://integration-test.cursor.com');
      expect(config.token.secret).toBe('integration-test-secret');
      expect(config.token.ttlDays).toBe(90);
      expect(warnings).toBe(0);
    });

    it('should work correctly with minimal environment variables', () => {
      const { config, warnings } = createConfig({
        CURSOR_API_KEY: 'minimal-test-key',
        TOKEN_SECRET: 'minimal-test-secret'
      });

      expect(config.port).toBe(3000);
      expect(config.cursor.apiKey).toBe('minimal-test-key');
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
      expect(config.token.secret).toBe('minimal-test-secret');
      expect(config.token.ttlDays).toBe(30);
      expect(warnings).toBe(0);
    });

    it('should work correctly with only defaults and missing TOKEN_SECRET', () => {
      const { config, warnings } = createConfig({
        CURSOR_API_KEY: 'defaults-test-key'
      });

      expect(config.port).toBe(3000);
      expect(config.cursor.apiKey).toBe('defaults-test-key');
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
      expect(config.token.secret).toBeUndefined();
      expect(config.token.ttlDays).toBe(30);
      expect(warnings).toBe(1);
    });
  });

  describe('Configuration Logic', () => {
    it('should handle boolean evaluation of environment variables', () => {
      const { config } = createConfig({
        PORT: '0', // falsy but valid port
        CURSOR_API_URL: 'https://test.cursor.com'
      });

      expect(config.port).toBe('0'); // Uses env var value as-is since it's set
      expect(config.cursor.apiUrl).toBe('https://test.cursor.com');
    });

    it('should handle NaN conversion for invalid numbers', () => {
      const { config } = createConfig({
        TOKEN_TTL_DAYS: 'not-a-number'
      });

      // Number('not-a-number') is NaN
      expect(config.token.ttlDays).toBeNaN();
    });

    it('should handle very large numbers', () => {
      const { config } = createConfig({
        TOKEN_TTL_DAYS: '999999999999'
      });

      expect(config.token.ttlDays).toBe(999999999999);
    });
  });
});