import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import fsPromises from 'fs/promises';

// Mock dependencies
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

jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((question, callback) => callback('test-input')),
    close: jest.fn(),
  })),
}));

// Import the functions we need to test
import {
  loadConfig,
  promptHidden,
  ensureEnvFromConfig,
} from '../cli.js';

describe('CLI Environment and Input Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful responses
    fsPromises.mkdir.mockResolvedValue();
    fsPromises.readFile.mockResolvedValue('{}');
    fsPromises.writeFile.mockResolvedValue();
    fsPromises.stat.mockResolvedValue({ isDirectory: () => true });

    // Clear environment variables
    delete process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_URL;
    delete process.env.MCP_SERVER_TOKEN;
  });

  describe('Environment Variable Handling', () => {
    describe('loadConfig with environment variables', () => {
      test('should handle partial environment variable configuration', async () => {
        process.env.CURSOR_API_KEY = 'partial-env-key';
        process.env.CURSOR_API_URL = 'https://partial-env.cursor.com';
        // MCP_SERVER_TOKEN not set

        const result = await loadConfig();

        expect(result).toEqual({
          CURSOR_API_KEY: 'partial-env-key',
          CURSOR_API_URL: 'https://partial-env.cursor.com',
          MCP_SERVER_TOKEN: undefined,
        });
      });

      test('should handle environment variables with special characters', async () => {
        process.env.CURSOR_API_KEY = 'key-with-dashes_and_underscores';
        process.env.CURSOR_API_URL = 'https://test.cursor.com/path?param=value';
        process.env.MCP_SERVER_TOKEN = 'token_with_123_numbers';

        const result = await loadConfig();

        expect(result).toEqual({
          CURSOR_API_KEY: 'key-with-dashes_and_underscores',
          CURSOR_API_URL: 'https://test.cursor.com/path?param=value',
          MCP_SERVER_TOKEN: 'token_with_123_numbers',
        });
      });

      test('should handle empty environment variables', async () => {
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

      test('should handle whitespace-only environment variables', async () => {
        process.env.CURSOR_API_KEY = '   ';
        process.env.CURSOR_API_URL = '\t\n  ';
        process.env.MCP_SERVER_TOKEN = '  ';

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

      test('should prioritize environment variables over file when both exist', async () => {
        process.env.CURSOR_API_KEY = 'env-priority-key';
        process.env.CURSOR_API_URL = 'https://env-priority.cursor.com';

        const fileConfig = {
          CURSOR_API_KEY: 'file-key',
          CURSOR_API_URL: 'https://file.cursor.com',
          MCP_SERVER_TOKEN: 'file-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(fileConfig));

        const result = await loadConfig();

        expect(result.CURSOR_API_KEY).toBe('env-priority-key');
        expect(result.CURSOR_API_URL).toBe('https://env-priority.cursor.com');
        expect(result.MCP_SERVER_TOKEN).toBe('file-token'); // File token should be used since env is undefined
      });
    });

    describe('ensureEnvFromConfig', () => {
      test('should set all environment variables from config', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'config-api-key',
          CURSOR_API_URL: 'https://config.cursor.com',
          MCP_SERVER_TOKEN: 'config-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        await ensureEnvFromConfig();

        expect(process.env.CURSOR_API_KEY).toBe('config-api-key');
        expect(process.env.CURSOR_API_URL).toBe('https://config.cursor.com');
        expect(process.env.MCP_SERVER_TOKEN).toBe('config-token');
      });

      test('should use default API URL when not in config', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'config-api-key',
          MCP_SERVER_TOKEN: 'config-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        await ensureEnvFromConfig();

        expect(process.env.CURSOR_API_URL).toBe('https://api.cursor.com');
      });

      test('should handle missing MCP_SERVER_TOKEN', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'config-api-key',
          CURSOR_API_URL: 'https://config.cursor.com',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        await ensureEnvFromConfig();

        expect(process.env.CURSOR_API_KEY).toBe('config-api-key');
        expect(process.env.CURSOR_API_URL).toBe('https://config.cursor.com');
        expect(process.env.MCP_SERVER_TOKEN).toBeUndefined();
      });

      test('should handle config with empty API key', async () => {
        const mockConfig = {
          CURSOR_API_KEY: '',
          CURSOR_API_URL: 'https://config.cursor.com',
          MCP_SERVER_TOKEN: 'config-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock console and process
        const originalConsoleError = console.error;
        const originalProcessExit = process.exit;
        console.error = jest.fn();
        process.exit = jest.fn();

        await ensureEnvFromConfig();

        expect(console.error).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
        expect(process.exit).toHaveBeenCalledWith(1);

        console.error = originalConsoleError;
        process.exit = originalProcessExit;
      });

      test('should handle config with missing API key', async () => {
        const mockConfig = {
          CURSOR_API_URL: 'https://config.cursor.com',
          MCP_SERVER_TOKEN: 'config-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock console and process
        const originalConsoleError = console.error;
        const originalProcessExit = process.exit;
        console.error = jest.fn();
        process.exit = jest.fn();

        await ensureEnvFromConfig();

        expect(console.error).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
        expect(process.exit).toHaveBeenCalledWith(1);

        console.error = originalConsoleError;
        process.exit = originalProcessExit;
      });
    });
  });

  describe('Input Validation and Prompting', () => {
    describe('promptHidden', () => {
      test('should return user input from readline', async () => {
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback('user-secret-input');
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        // Re-import after mocking
        const { promptHidden } = await import('../cli.js');

        const result = await promptHidden('Enter secret: ');

        expect(result).toBe('user-secret-input');
        expect(mockRl.question).toHaveBeenCalledWith('Enter secret: ', expect.any(Function));
        expect(mockRl.close).toHaveBeenCalled();
      });

      test('should handle special characters in input', async () => {
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback('p@ssw0rd!#$%^&*()');
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        const { promptHidden } = await import('../cli.js');

        const result = await promptHidden('Password: ');

        expect(result).toBe('p@ssw0rd!#$%^&*()');
      });

      test('should handle numeric input', async () => {
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback('123456789');
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        const { promptHidden } = await import('../cli.js');

        const result = await promptHidden('Number: ');

        expect(result).toBe('123456789');
      });

      test('should handle empty input', async () => {
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback('');
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        const { promptHidden } = await import('../cli.js');

        const result = await promptHidden('Input: ');

        expect(result).toBe('');
      });

      test('should handle whitespace input', async () => {
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback('   \t  \n  ');
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        const { promptHidden } = await import('../cli.js');

        const result = await promptHidden('Input: ');

        expect(result).toBe('   \t  \n  ');
      });

      test('should handle keyboard interrupt (Ctrl+C)', async () => {
        const mockRl = {
          question: jest.fn(),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        const mockStdin = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              // Simulate Ctrl+C
              handler('\u0004');
            }
          }),
          removeListener: jest.fn(),
        };

        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        // Mock process.stdin
        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        const { promptHidden } = await import('../cli.js');

        const result = await promptHidden('Input: ');

        expect(result).toBe('\u0004');
      });

      test('should handle Enter key properly', async () => {
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback('input-after-enter');
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        const mockStdin = {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              // Simulate Enter key
              handler('\n');
            }
          }),
          removeListener: jest.fn(),
        };

        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        Object.defineProperty(process, 'stdin', {
          value: mockStdin,
          writable: true,
        });

        const { promptHidden } = await import('../cli.js');

        const result = await promptHidden('Input: ');

        expect(result).toBe('input-after-enter');
      });
    });
  });

  describe('API Key Validation', () => {
    test('should accept valid API key formats', async () => {
      const validKeys = [
        'cursor_sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
        'cursor_sk_live_1234567890abcdefghijklmnopqrstuvwxyz',
        'test-key-123',
        'a'.repeat(100), // Very long key
      ];

      for (const key of validKeys) {
        // Mock the prompt to return the test key
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback(key);
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        const { cmdInit } = await import('../cli.js');

        // Mock console methods to avoid exit
        const originalConsoleLog = console.log;
        const originalProcessExit = process.exit;
        console.log = jest.fn();
        process.exit = jest.fn();

        await cmdInit({});

        expect(process.exit).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('✅ Saved credentials to local config with restricted permissions.');

        console.log = originalConsoleLog;
        process.exit = originalProcessExit;
      }
    });

    test('should reject invalid API key formats', async () => {
      const invalidKeys = [
        'short', // Less than 8 characters
        '', // Empty
        '   ', // Whitespace only
        'a'.repeat(7), // Exactly 7 characters
      ];

      for (const key of invalidKeys) {
        const mockRl = {
          question: jest.fn((question, callback) => {
            callback(key);
          }),
          close: jest.fn(),
        };

        const mockCreateInterface = jest.fn(() => mockRl);
        jest.doMock('readline', () => ({
          createInterface: mockCreateInterface,
        }));

        const { cmdInit } = await import('../cli.js');

        // Mock console methods
        const originalConsoleError = console.error;
        const originalProcessExit = process.exit;
        console.error = jest.fn();
        process.exit = jest.fn();

        await cmdInit({});

        expect(console.error).toHaveBeenCalledWith('Invalid API key.');
        expect(process.exit).toHaveBeenCalledWith(1);

        console.error = originalConsoleError;
        process.exit = originalProcessExit;
      }
    });

    test('should trim whitespace from API keys', async () => {
      const keyWithWhitespace = '  test-key-with-spaces  ';

      const mockRl = {
        question: jest.fn((question, callback) => {
          callback(keyWithWhitespace);
        }),
        close: jest.fn(),
      };

      const mockCreateInterface = jest.fn(() => mockRl);
      jest.doMock('readline', () => ({
        createInterface: mockCreateInterface,
      }));

      const { cmdInit } = await import('../cli.js');

      // Mock console methods to avoid exit
      const originalConsoleLog = console.log;
      const originalProcessExit = process.exit;
      console.log = jest.fn();
      process.exit = jest.fn();

      await cmdInit({});

      expect(process.exit).not.toHaveBeenCalled();

      console.log = originalConsoleLog;
      process.exit = originalProcessExit;
    });
  });
});