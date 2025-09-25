/**
 * Comprehensive unit tests for configuration module
 * Tests environment variable loading, default values, validation, and error handling
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const CONFIG_ENV_KEYS = ['PORT', 'CURSOR_API_KEY', 'CURSOR_API_URL', 'TOKEN_SECRET', 'TOKEN_TTL_DAYS'];
const originalProcessEnvSnapshot = { ...process.env };
const UNDEFINED_TOKEN = '__CONFIG_UNDEFINED__';
const NAN_TOKEN = '__CONFIG_NAN__';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configModuleUrl = pathToFileURL(path.resolve(__dirname, 'index.js')).href;

function restoreUndefinedValues(value) {
  if (value === UNDEFINED_TOKEN) {
    return undefined;
  }

  if (value === NAN_TOKEN) {
    return Number.NaN;
  }

  if (Array.isArray(value)) {
    return value.map(item => restoreUndefinedValues(item));
  }

  if (value && typeof value === 'object') {
    Object.keys(value).forEach(key => {
      value[key] = restoreUndefinedValues(value[key]);
    });
  }

  return value;
}

function runConfigProcess(overrides = {}) {
  const env = { ...originalProcessEnvSnapshot };
  CONFIG_ENV_KEYS.forEach(key => {
    delete env[key];
  });
  Object.entries(overrides).forEach(([key, value]) => {
    env[key] = value;
  });

  const script = `
    import { config } from '${configModuleUrl}';
    const UNDEFINED_TOKEN = '${UNDEFINED_TOKEN}';
    const NAN_TOKEN = '${NAN_TOKEN}';
    const json = JSON.stringify(config, (_, value) => {
      if (value === undefined) {
        return UNDEFINED_TOKEN;
      }

      if (typeof value === 'number' && Number.isNaN(value)) {
        return NAN_TOKEN;
      }

      return value;
    });
    console.log(json);
  `;

  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    env,
    encoding: 'utf-8'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || `Process exited with code ${result.status}`);
  }

  const stdout = result.stdout.trim();
  const parsedConfig = stdout ? JSON.parse(stdout) : {};
  const config = restoreUndefinedValues(parsedConfig);
  const warningsCount = result.stderr
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean).length;

  return { config, warningsCount };
}

async function loadConfig(overrides = {}) {
  return runConfigProcess(overrides);
}

// Tests remain similar to original but using loadConfig helper

describe('Configuration Module', () => {
  describe('Environment Variable Loading', () => {
    it('should load environment variables from process.env', async () => {
      const { config } = await loadConfig({
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
    it('should use default port 3000 when PORT is not set', async () => {
      const { config } = await loadConfig({});
      expect(config.port).toBe(3000);
    });

    it('should use default CURSOR_API_URL when not set', async () => {
      const { config } = await loadConfig({});
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
    });

    it('should use default TOKEN_TTL_DAYS when not set', async () => {
      const { config } = await loadConfig({});
      expect(config.token.ttlDays).toBe(30);
    });

    it('should handle string to number conversion for TOKEN_TTL_DAYS', async () => {
      const { config } = await loadConfig({ TOKEN_TTL_DAYS: '45' });
      expect(config.token.ttlDays).toBe(45);
      expect(typeof config.token.ttlDays).toBe('number');
    });

    it('should handle invalid TOKEN_TTL_DAYS gracefully', async () => {
      const { config } = await loadConfig({ TOKEN_TTL_DAYS: 'invalid' });
      // Number('invalid') is NaN, not 30
      expect(config.token.ttlDays).toBeNaN();
    });
  });

  describe('Required Configuration Validation', () => {
    it('should handle missing CURSOR_API_KEY', async () => {
      const { config } = await loadConfig({});
      expect(config.cursor.apiKey).toBeUndefined();
    });

    it('should handle missing TOKEN_SECRET', async () => {
      const { config } = await loadConfig({});
      expect(config.token.secret).toBeUndefined();
    });
  });

  describe('Warning Messages', () => {
    it('should warn when TOKEN_SECRET is missing', async () => {
      const { warningsCount } = await loadConfig({});
      expect(warningsCount).toBe(1);
    });

    it('should not warn when TOKEN_SECRET is set', async () => {
      const { warningsCount } = await loadConfig({ TOKEN_SECRET: 'test-secret' });
      expect(warningsCount).toBe(0);
    });
  });

  describe('Configuration Structure', () => {
    it('should export config object with correct structure', async () => {
      const { config } = await loadConfig({});
      expect(config).toBeDefined();
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('cursor');
      expect(config).toHaveProperty('token');

      expect(config.cursor).toHaveProperty('apiKey');
      expect(config.cursor).toHaveProperty('apiUrl');

      expect(config.token).toHaveProperty('secret');
      expect(config.token).toHaveProperty('ttlDays');
    });

    it('should have correct data types', async () => {
      const { config } = await loadConfig({});
      expect(typeof config.port).toBe('number');
      expect(typeof config.cursor).toBe('object');
      expect(typeof config.token).toBe('object');
      expect(typeof config.token.ttlDays).toBe('number');
    });

    it('should handle environment variables with different cases', async () => {
      const { config } = await loadConfig({
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
    it('should handle empty environment variables', async () => {
      const { config } = await loadConfig({
        PORT: '',
        CURSOR_API_URL: '',
        TOKEN_TTL_DAYS: ''
      });

      expect(config.port).toBe(3000); // default
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com'); // default
      expect(config.token.ttlDays).toBe(30); // default
    });

    it('should handle whitespace-only environment variables', async () => {
      const { config } = await loadConfig({
        PORT: '   ',
        CURSOR_API_URL: '  https://whitespace.com  ',
        TOKEN_TTL_DAYS: '  45  '
      });

      expect(config.port).toBe('   '); // uses env var value as-is since it's set
      expect(config.cursor.apiUrl).toBe('  https://whitespace.com  '); // preserves whitespace
      expect(config.token.ttlDays).toBe(45); // trims whitespace for number conversion
    });

    it('should handle extremely large numbers for TOKEN_TTL_DAYS', async () => {
      const { config } = await loadConfig({
        TOKEN_TTL_DAYS: '999999'
      });

      expect(config.token.ttlDays).toBe(999999);
    });

    it('should handle zero values', async () => {
      const { config } = await loadConfig({
        PORT: '0',
        TOKEN_TTL_DAYS: '0'
      });

      expect(config.port).toBe('0'); // env var is set, so uses string value
      expect(config.token.ttlDays).toBe(0); // Number('0') = 0
    });
  });

  describe('Integration Tests', () => {
    it('should work correctly with all environment variables set', async () => {
      const { config, warningsCount } = await loadConfig({
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
      expect(warningsCount).toBe(0);
    });

    it('should work correctly with minimal environment variables', async () => {
      const { config, warningsCount } = await loadConfig({
        CURSOR_API_KEY: 'minimal-test-key',
        TOKEN_SECRET: 'minimal-test-secret'
      });

      expect(config.port).toBe(3000);
      expect(config.cursor.apiKey).toBe('minimal-test-key');
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
      expect(config.token.secret).toBe('minimal-test-secret');
      expect(config.token.ttlDays).toBe(30);
      expect(warningsCount).toBe(0);
    });

    it('should work correctly with only defaults and missing TOKEN_SECRET', async () => {
      const { config, warningsCount } = await loadConfig({
        CURSOR_API_KEY: 'defaults-test-key'
      });

      expect(config.port).toBe(3000);
      expect(config.cursor.apiKey).toBe('defaults-test-key');
      expect(config.cursor.apiUrl).toBe('https://api.cursor.com');
      expect(config.token.secret).toBeUndefined();
      expect(config.token.ttlDays).toBe(30);
      expect(warningsCount).toBe(1);
    });
  });

  describe('Configuration Logic', () => {
    it('should handle boolean evaluation of environment variables', async () => {
      const { config } = await loadConfig({
        PORT: '0', // falsy but valid port
        CURSOR_API_URL: 'https://test.cursor.com'
      });

      expect(config.port).toBe('0'); // Uses env var value as-is since it's set
      expect(config.cursor.apiUrl).toBe('https://test.cursor.com');
    });

    it('should handle NaN conversion for invalid numbers', async () => {
      const { config } = await loadConfig({
        TOKEN_TTL_DAYS: 'not-a-number'
      });

      // Number('not-a-number') is NaN
      expect(config.token.ttlDays).toBeNaN();
    });

    it('should handle very large numbers', async () => {
      const { config } = await loadConfig({
        TOKEN_TTL_DAYS: '999999999999'
      });

      expect(config.token.ttlDays).toBe(999999999999);
    });
  });
});
