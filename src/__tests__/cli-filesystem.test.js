import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import fs from 'fs';
import fsPromises from 'fs/promises';

// Mock all dependencies
jest.mock('fs', () => ({
  chmodSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/testuser'),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('a'.repeat(64))),
}));

// Import the functions we need to test
import {
  getConfigDir,
  ensureConfigDir,
  saveConfig,
  loadConfigFromFile,
  loadConfig,
} from '../cli.js';

describe('CLI Filesystem Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful responses
    fsPromises.mkdir.mockResolvedValue();
    fsPromises.readFile.mockResolvedValue('{}');
    fsPromises.writeFile.mockResolvedValue();
    fsPromises.stat.mockResolvedValue({ isDirectory: () => true });
  });

  describe('getConfigDir', () => {
    test('should handle various platform configurations', () => {
      // Test different platform scenarios
      const testCases = [
        {
          platform: 'win32',
          appdata: 'C:\\Users\\Test\\AppData\\Roaming',
          expected: 'C:\\Users\\Test\\AppData\\Roaming/cursor-agent-mcp',
        },
        {
          platform: 'darwin',
          expected: '/home/testuser/Library/Application Support/cursor-agent-mcp',
        },
        {
          platform: 'linux',
          expected: '/home/testuser/.config/cursor-agent-mcp',
        },
      ];

      testCases.forEach(({ platform, appdata, expected }) => {
        Object.defineProperty(process, 'platform', { value: platform });
        if (appdata) {
          process.env.APPDATA = appdata;
        } else {
          delete process.env.APPDATA;
        }

        const result = getConfigDir();
        if (platform === 'win32') {
          expect(result).toBe(expected);
        } else {
          expect(result).toBe(expected);
        }
      });
    });

    test('should handle missing APPDATA on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      delete process.env.APPDATA;

      const result = getConfigDir();
      expect(result).toBe('/home/testuser/AppData/Roaming/cursor-agent-mcp');
    });
  });

  describe('ensureConfigDir', () => {
    test('should create directory with correct permissions on Unix systems', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      await ensureConfigDir();

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        '/home/testuser/.config/cursor-agent-mcp',
        { recursive: true },
      );
      expect(fs.chmodSync).toHaveBeenCalledWith(
        '/home/testuser/.config/cursor-agent-mcp',
        0o700,
      );
    });

    test('should not set permissions on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      await ensureConfigDir();

      expect(fsPromises.mkdir).toHaveBeenCalled();
      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    test('should handle permission errors gracefully', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));
      fs.chmodSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Mock console methods
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      await ensureConfigDir();

      expect(console.warn).toHaveBeenCalledWith(
        'Could not set directory permissions:',
        'Permission denied',
      );

      console.warn = originalConsoleWarn;
    });

    test('should handle mkdir errors', async () => {
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));
      fsPromises.mkdir.mockRejectedValue(new Error('Cannot create directory'));

      await expect(ensureConfigDir()).rejects.toThrow('Cannot create directory');
    });
  });

  describe('saveConfig', () => {
    test('should create config directory before saving', async () => {
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      const configData = {
        apiKey: 'test-key',
        apiUrl: 'https://test.url',
        mcpToken: 'test-token',
      };

      await saveConfig(configData);

      expect(fsPromises.mkdir).toHaveBeenCalled();
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    test('should save config with correct JSON format', async () => {
      const configData = {
        apiKey: 'test-api-key',
        apiUrl: 'https://custom.api.url',
        mcpToken: 'test-token',
      };

      await saveConfig(configData);

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const configPath = writeCall[0];
      const configContent = writeCall[1];

      expect(configPath).toBe('/home/testuser/.config/cursor-agent-mcp/config.json');
      expect(configContent).toBe(JSON.stringify({
        CURSOR_API_KEY: 'test-api-key',
        CURSOR_API_URL: 'https://custom.api.url',
        MCP_SERVER_TOKEN: 'test-token',
      }, null, 2));
    });

    test('should set correct file permissions on Unix systems', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      await saveConfig({ apiKey: 'test' });

      expect(fs.chmodSync).toHaveBeenCalledWith(
        '/home/testuser/.config/cursor-agent-mcp/config.json',
        0o600,
      );
    });

    test('should not set file permissions on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      await saveConfig({ apiKey: 'test' });

      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    test('should handle file permission errors gracefully', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      fs.chmodSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Mock console methods
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      await saveConfig({ apiKey: 'test' });

      expect(console.warn).toHaveBeenCalledWith(
        'Could not set file permissions:',
        'Permission denied',
      );

      console.warn = originalConsoleWarn;
    });

    test('should merge with existing config', async () => {
      const existingConfig = {
        CURSOR_API_KEY: 'existing-key',
        CURSOR_API_URL: 'https://existing.url',
        MCP_SERVER_TOKEN: 'existing-token',
      };

      // Mock reading existing config
      const mockReadFile = fsPromises.readFile;
      mockReadFile.mockResolvedValueOnce(JSON.stringify(existingConfig));

      const newConfigData = {
        apiKey: 'new-key',
        apiUrl: 'https://new.url',
      };

      await saveConfig(newConfigData);

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const configContent = JSON.parse(writeCall[1]);

      expect(configContent.CURSOR_API_KEY).toBe('new-key');
      expect(configContent.CURSOR_API_URL).toBe('https://new.url');
      expect(configContent.MCP_SERVER_TOKEN).toBe('existing-token'); // Should preserve existing token
    });

    test('should generate new token when not provided and none exists', async () => {
      const existingConfig = {
        CURSOR_API_KEY: 'existing-key',
      };

      fsPromises.readFile.mockResolvedValueOnce(JSON.stringify(existingConfig));

      await saveConfig({ apiKey: 'new-key' });

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const configContent = JSON.parse(writeCall[1]);

      expect(configContent.MCP_SERVER_TOKEN).toMatch(/^mcp_/);
      expect(configContent.MCP_SERVER_TOKEN).toHaveLength(67);
    });
  });

  describe('loadConfigFromFile', () => {
    test('should handle corrupted JSON files', async () => {
      fsPromises.readFile.mockResolvedValue('invalid json content');

      // Mock console methods
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      const result = await loadConfigFromFile();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'Could not read config file:',
        expect.any(SyntaxError),
      );

      console.warn = originalConsoleWarn;
    });

    test('should handle file read errors', async () => {
      fsPromises.readFile.mockRejectedValue(new Error('File read error'));

      // Mock console methods
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      const result = await loadConfigFromFile();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'Could not read config file:',
        'File read error',
      );

      console.warn = originalConsoleWarn;
    });

    test('should handle missing config file', async () => {
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await loadConfigFromFile();

      expect(result).toBeNull();
    });

    test('should parse valid JSON config correctly', async () => {
      const configData = {
        CURSOR_API_KEY: 'test-key-12345',
        CURSOR_API_URL: 'https://test.cursor.com',
        MCP_SERVER_TOKEN: 'test-token-abcdef',
      };

      fsPromises.readFile.mockResolvedValue(JSON.stringify(configData));

      const result = await loadConfigFromFile();

      expect(result).toEqual(configData);
    });

    test('should handle empty config file', async () => {
      fsPromises.readFile.mockResolvedValue('{}');

      const result = await loadConfigFromFile();

      expect(result).toEqual({});
    });
  });

  describe('loadConfig', () => {
    beforeEach(() => {
      // Clear environment variables for each test
      delete process.env.CURSOR_API_KEY;
      delete process.env.CURSOR_API_URL;
      delete process.env.MCP_SERVER_TOKEN;
    });

    test('should prioritize environment variables over file config', async () => {
      process.env.CURSOR_API_KEY = 'env-api-key';
      process.env.CURSOR_API_URL = 'https://env.cursor.com';
      process.env.MCP_SERVER_TOKEN = 'env-token';

      const fileConfig = {
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.cursor.com',
        MCP_SERVER_TOKEN: 'file-token',
      };

      fsPromises.readFile.mockResolvedValue(JSON.stringify(fileConfig));

      const result = await loadConfig();

      expect(result).toEqual({
        CURSOR_API_KEY: 'env-api-key',
        CURSOR_API_URL: 'https://env.cursor.com',
        MCP_SERVER_TOKEN: 'env-token',
      });
    });

    test('should fall back to file config when env vars are empty', async () => {
      process.env.CURSOR_API_KEY = '';
      process.env.CURSOR_API_URL = '';
      process.env.MCP_SERVER_TOKEN = '';

      const fileConfig = {
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.cursor.com',
        MCP_SERVER_TOKEN: 'file-token',
      };

      fsPromises.readFile.mockResolvedValue(JSON.stringify(fileConfig));

      const result = await loadConfig();

      expect(result).toEqual({
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.cursor.com',
        MCP_SERVER_TOKEN: 'file-token',
      });
    });

    test('should use default API URL when not specified in file', async () => {
      process.env.CURSOR_API_KEY = '';

      const fileConfig = {
        CURSOR_API_KEY: 'file-key',
        MCP_SERVER_TOKEN: 'file-token',
      };

      fsPromises.readFile.mockResolvedValue(JSON.stringify(fileConfig));

      const result = await loadConfig();

      expect(result.CURSOR_API_URL).toBe('https://api.cursor.com');
    });

    test('should return null when API key is empty string in file', async () => {
      process.env.CURSOR_API_KEY = '';

      const fileConfig = {
        CURSOR_API_KEY: '',
        CURSOR_API_URL: 'https://test.cursor.com',
        MCP_SERVER_TOKEN: 'file-token',
      };

      fsPromises.readFile.mockResolvedValue(JSON.stringify(fileConfig));

      const result = await loadConfig();

      expect(result).toBeNull();
    });

    test('should return null when API key is missing from file', async () => {
      process.env.CURSOR_API_KEY = '';

      const fileConfig = {
        CURSOR_API_URL: 'https://test.cursor.com',
        MCP_SERVER_TOKEN: 'file-token',
      };

      fsPromises.readFile.mockResolvedValue(JSON.stringify(fileConfig));

      const result = await loadConfig();

      expect(result).toBeNull();
    });

    test('should handle missing MCP_SERVER_TOKEN in environment', async () => {
      process.env.CURSOR_API_KEY = 'env-key';
      process.env.CURSOR_API_URL = 'https://env.cursor.com';
      delete process.env.MCP_SERVER_TOKEN;

      const result = await loadConfig();

      expect(result).toEqual({
        CURSOR_API_KEY: 'env-key',
        CURSOR_API_URL: 'https://env.cursor.com',
        MCP_SERVER_TOKEN: undefined,
      });
    });

    test('should handle missing MCP_SERVER_TOKEN in file', async () => {
      process.env.CURSOR_API_KEY = '';

      const fileConfig = {
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.cursor.com',
      };

      fsPromises.readFile.mockResolvedValue(JSON.stringify(fileConfig));

      const result = await loadConfig();

      expect(result.MCP_SERVER_TOKEN).toBeUndefined();
    });

    test('should handle file read errors gracefully', async () => {
      process.env.CURSOR_API_KEY = '';
      fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

      const result = await loadConfig();

      expect(result).toBeNull();
    });
  });
});