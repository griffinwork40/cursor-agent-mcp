import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import fsPromises from 'fs/promises';

// Mock all external dependencies
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

// Mock the modules that CLI imports dynamically
jest.mock('../utils/cursorClient.js', () => ({
  cursorApiClient: {
    getMe: jest.fn(),
    createAgent: jest.fn(),
    listAgents: jest.fn(),
    getAgent: jest.fn(),
    deleteAgent: jest.fn(),
    addFollowup: jest.fn(),
    getAgentConversation: jest.fn(),
    listModels: jest.fn(),
    listRepositories: jest.fn(),
  },
}));

jest.mock('../mcp-server.js', () => ({
  default: jest.fn(),
  // Mock the exported functions if any
}));

jest.mock('../index.js', () => ({
  default: jest.fn(),
  // Mock the exported functions if any
}));

jest.mock('../config/index.js', () => ({
  config: {
    port: 3000,
    cursor: {
      apiKey: 'mock-api-key',
      apiUrl: 'https://api.cursor.com',
    },
    token: {
      secret: 'mock-token-secret',
      ttlDays: 30,
    },
  },
}));

// Import the CLI module after mocking
import * as cliModule from '../cli.js';

// Get the functions we need to test
const {
  cmdStdio,
  cmdHttp,
  cmdWhoAmI,
  cmdInit,
  main,
} from cliModule;

describe('CLI Integration Tests', () => {
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
    delete process.env.PORT;

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Mock process.exit
    process.exit = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Command Integration', () => {
    describe('cmdStdio', () => {
      test('should load config and import mcp-server module', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'test-api-key',
          CURSOR_API_URL: 'https://test.cursor.com',
          MCP_SERVER_TOKEN: 'test-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the dynamic import
        const mockMcpServer = jest.fn();
        jest.doMock('../mcp-server.js', () => mockMcpServer);

        await cmdStdio();

        // Verify config was loaded
        expect(fsPromises.readFile).toHaveBeenCalled();

        // Verify mcp-server was imported
        expect(mockMcpServer).toHaveBeenCalled();
      });

      test('should handle missing config gracefully', async () => {
        fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

        // Mock console methods to avoid exit during test
        const originalConsoleError = console.error;
        const originalProcessExit = process.exit;
        console.error = jest.fn();
        process.exit = jest.fn();

        await cmdStdio();

        expect(console.error).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
        expect(process.exit).toHaveBeenCalledWith(1);

        console.error = originalConsoleError;
        process.exit = originalProcessExit;
      });

      test('should set environment variables from config', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'stdio-api-key',
          CURSOR_API_URL: 'https://stdio.cursor.com',
          MCP_SERVER_TOKEN: 'stdio-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the dynamic import
        const mockMcpServer = jest.fn();
        jest.doMock('../mcp-server.js', () => mockMcpServer);

        await cmdStdio();

        expect(process.env.CURSOR_API_KEY).toBe('stdio-api-key');
        expect(process.env.CURSOR_API_URL).toBe('https://stdio.cursor.com');
        expect(process.env.MCP_SERVER_TOKEN).toBe('stdio-token');
      });
    });

    describe('cmdHttp', () => {
      test('should load config and import index module with default port', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'http-api-key',
          CURSOR_API_URL: 'https://http.cursor.com',
          MCP_SERVER_TOKEN: 'http-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the dynamic import
        const mockIndex = jest.fn();
        jest.doMock('../index.js', () => mockIndex);

        await cmdHttp({});

        expect(process.env.PORT).toBeUndefined(); // Should not be set when not provided
        expect(mockIndex).toHaveBeenCalled();
      });

      test('should load config and import index module with custom port', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'http-api-key',
          CURSOR_API_URL: 'https://http.cursor.com',
          MCP_SERVER_TOKEN: 'http-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the dynamic import
        const mockIndex = jest.fn();
        jest.doMock('../index.js', () => mockIndex);

        await cmdHttp({ port: '8080' });

        expect(process.env.PORT).toBe('8080');
        expect(mockIndex).toHaveBeenCalled();
      });

      test('should handle missing config gracefully', async () => {
        fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

        // Mock console methods to avoid exit during test
        const originalConsoleError = console.error;
        const originalProcessExit = process.exit;
        console.error = jest.fn();
        process.exit = jest.fn();

        await cmdHttp({});

        expect(console.error).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
        expect(process.exit).toHaveBeenCalledWith(1);

        console.error = originalConsoleError;
        process.exit = originalProcessExit;
      });

      test('should set environment variables from config', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'http-api-key',
          CURSOR_API_URL: 'https://http.cursor.com',
          MCP_SERVER_TOKEN: 'http-token',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the dynamic import
        const mockIndex = jest.fn();
        jest.doMock('../index.js', () => mockIndex);

        await cmdHttp({ port: '3000' });

        expect(process.env.CURSOR_API_KEY).toBe('http-api-key');
        expect(process.env.CURSOR_API_URL).toBe('https://http.cursor.com');
        expect(process.env.MCP_SERVER_TOKEN).toBe('http-token');
        expect(process.env.PORT).toBe('3000');
      });
    });

    describe('cmdWhoAmI', () => {
      test('should call cursor API and display user information', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'whoami-api-key',
          CURSOR_API_URL: 'https://whoami.cursor.com',
          MCP_SERVER_TOKEN: 'whoami-token',
        };

        const mockUserData = {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
          created_at: '2023-01-01T00:00:00Z',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the cursor client
        const mockCursorClient = {
          getMe: jest.fn().mockResolvedValue(mockUserData),
        };

        jest.doMock('../utils/cursorClient.js', () => ({
          cursorApiClient: mockCursorClient,
        }));

        await cmdWhoAmI();

        expect(mockCursorClient.getMe).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockUserData, null, 2));
      });

      test('should handle API errors gracefully', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'whoami-api-key',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the cursor client with error
        const mockCursorClient = {
          getMe: jest.fn().mockRejectedValue(new Error('Authentication failed')),
        };

        jest.doMock('../utils/cursorClient.js', () => ({
          cursorApiClient: mockCursorClient,
        }));

        await cmdWhoAmI();

        expect(console.error).toHaveBeenCalledWith('Failed to call /v0/me. Check your key and network.');
        expect(console.error).toHaveBeenCalledWith('Authentication failed');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      test('should handle network errors', async () => {
        const mockConfig = {
          CURSOR_API_KEY: 'whoami-api-key',
        };

        fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

        // Mock the cursor client with network error
        const mockCursorClient = {
          getMe: jest.fn().mockRejectedValue({
            message: 'Network Error',
            code: 'ECONNREFUSED',
          }),
        };

        jest.doMock('../utils/cursorClient.js', () => ({
          cursorApiClient: mockCursorClient,
        }));

        await cmdWhoAmI();

        expect(console.error).toHaveBeenCalledWith('Failed to call /v0/me. Check your key and network.');
        expect(console.error).toHaveBeenCalledWith('Network Error');
        expect(process.exit).toHaveBeenCalledWith(1);
      });

      test('should handle missing config gracefully', async () => {
        fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

        // Mock console methods to avoid exit during test
        const originalConsoleError = console.error;
        const originalProcessExit = process.exit;
        console.error = jest.fn();
        process.exit = jest.fn();

        await cmdWhoAmI();

        expect(console.error).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
        expect(process.exit).toHaveBeenCalledWith(1);

        console.error = originalConsoleError;
        process.exit = originalProcessExit;
      });
    });

    describe('cmdInit', () => {
      test('should handle all flag combinations', async () => {
        const testCases = [
          {
            flags: { 'api-key': 'flag-key', 'api-url': 'https://flag.url' },
            expectedConfig: {
              CURSOR_API_KEY: 'flag-key',
              CURSOR_API_URL: 'https://flag.url',
              MCP_SERVER_TOKEN: expect.stringMatching(/^mcp_[a-f0-9]{64}$/),
            },
          },
          {
            flags: { 'api-key': 'flag-key', 'api-url': 'https://flag.url', 'generate-token': false },
            expectedConfig: {
              CURSOR_API_KEY: 'flag-key',
              CURSOR_API_URL: 'https://flag.url',
              MCP_SERVER_TOKEN: undefined,
            },
          },
          {
            flags: {},
            expectedPromptCall: true,
          },
        ];

        for (const testCase of testCases) {
          // Mock console methods
          const originalConsoleLog = console.log;
          const originalProcessExit = process.exit;
          console.log = jest.fn();
          process.exit = jest.fn();

          if (testCase.expectedPromptCall) {
            // Mock readline for prompt
            const mockRl = {
              question: jest.fn((question, callback) => callback('prompted-key')),
              close: jest.fn(),
            };
            const mockCreateInterface = jest.fn(() => mockRl);
            jest.doMock('readline', () => ({
              createInterface: mockCreateInterface,
            }));
          }

          await cmdInit(testCase.flags);

          if (testCase.expectedPromptCall) {
            expect(process.exit).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith('✅ Saved credentials to local config with restricted permissions.');
          }

          console.log = originalConsoleLog;
          process.exit = originalProcessExit;
        }
      });

      test('should handle config merge with existing file', async () => {
        const existingConfig = {
          CURSOR_API_KEY: 'existing-key',
          CURSOR_API_URL: 'https://existing.cursor.com',
          MCP_SERVER_TOKEN: 'existing-token',
        };

        fsPromises.readFile.mockResolvedValueOnce(JSON.stringify(existingConfig));

        const flags = { 'api-key': 'new-key' };

        await cmdInit(flags);

        const writeCall = fsPromises.writeFile.mock.calls[0];
        const savedConfig = JSON.parse(writeCall[1]);

        expect(savedConfig.CURSOR_API_KEY).toBe('new-key');
        expect(savedConfig.CURSOR_API_URL).toBe('https://existing.cursor.com');
        expect(savedConfig.MCP_SERVER_TOKEN).toBe('existing-token');
      });
    });
  });

  describe('Main Command Router', () => {
    test('should route all commands correctly', async () => {
      const commands = [
        { command: 'init', args: ['--api-key', 'test-key'] },
        { command: 'stdio', args: [] },
        { command: 'http', args: ['--port', '8080'] },
        { command: 'whoami', args: [] },
        { command: 'config', args: [] },
        { command: 'help', args: [] },
        { command: 'unknown', args: [] },
      ];

      for (const { command, args } of commands) {
        const originalArgv = process.argv;
        process.argv = ['node', 'cli.js', command, ...args];

        // Mock the specific command function
        const commandMocks = {
          cmdInit: jest.fn(),
          cmdStdio: jest.fn(),
          cmdHttp: jest.fn(),
          cmdWhoAmI: jest.fn(),
          cmdShowConfig: jest.fn(),
          printHelp: jest.fn(),
        };

        jest.doMock('../cli.js', () => ({
          ...cliModule,
          ...commandMocks,
        }));

        const { main } = await import('../cli.js');

        await main();

        if (command === 'unknown') {
          expect(commandMocks.printHelp).toHaveBeenCalled();
        } else {
          expect(commandMocks[`cmd${command.charAt(0).toUpperCase() + command.slice(1)}`] || commandMocks.printHelp).toHaveBeenCalled();
        }

        process.argv = originalArgv;
      }
    });

    test('should handle command parsing edge cases', async () => {
      const edgeCases = [
        {
          argv: ['node', 'cli.js', 'init', '--api-key=test-key', '--invalid-flag'],
          expectedCommand: 'init',
          expectedFlags: { 'api-key': 'test-key', 'invalid-flag': true },
        },
        {
          argv: ['node', 'cli.js', 'http', '--port=3000', '--verbose'],
          expectedCommand: 'http',
          expectedFlags: { 'port': '3000', 'verbose': true },
        },
        {
          argv: ['node', 'cli.js', '--flag-without-command'],
          expectedCommand: 'help',
          expectedFlags: { 'flag-without-command': true },
        },
      ];

      for (const { argv, expectedCommand, expectedFlags } of edgeCases) {
        const originalArgv = process.argv;
        process.argv = argv;

        const mockPrintHelp = jest.fn();
        const mockCmdInit = jest.fn();
        const mockCmdHttp = jest.fn();

        jest.doMock('../cli.js', () => ({
          ...cliModule,
          printHelp: mockPrintHelp,
          cmdInit: mockCmdInit,
          cmdHttp: mockCmdHttp,
        }));

        const { main } = await import('../cli.js');

        await main();

        if (expectedCommand === 'help') {
          expect(mockPrintHelp).toHaveBeenCalled();
        } else if (expectedCommand === 'init') {
          expect(mockCmdInit).toHaveBeenCalledWith(expectedFlags);
        } else if (expectedCommand === 'http') {
          expect(mockCmdHttp).toHaveBeenCalledWith(expectedFlags);
        }

        process.argv = originalArgv;
      }
    });

    test('should handle errors in command execution', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'init', '--api-key', 'short'];

      const mockCmdInit = jest.fn().mockRejectedValue(new Error('Test error'));
      const mockPrintHelp = jest.fn();

      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdInit: mockCmdInit,
        printHelp: mockPrintHelp,
      }));

      const { main } = await import('../cli.js');

      await main();

      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);

      process.argv = originalArgv;
    });
  });

  describe('Cross-Command Integration', () => {
    test('should maintain config consistency across commands', async () => {
      // First, initialize config
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'init', '--api-key', 'integration-test-key', '--api-url', 'https://integration.cursor.com'];

      await main();

      expect(fsPromises.writeFile).toHaveBeenCalled();
      const initCall = fsPromises.writeFile.mock.calls[0];
      const initConfig = JSON.parse(initCall[1]);

      expect(initConfig.CURSOR_API_KEY).toBe('integration-test-key');
      expect(initConfig.CURSOR_API_URL).toBe('https://integration.cursor.com');

      // Reset mock to test subsequent commands
      fsPromises.writeFile.mockClear();

      // Then test whoami command
      process.argv = ['node', 'cli.js', 'whoami'];

      const mockCursorClient = {
        getMe: jest.fn().mockResolvedValue({ id: 'test-user', email: 'test@example.com' }),
      };

      jest.doMock('../utils/cursorClient.js', () => ({
        cursorApiClient: mockCursorClient,
      }));

      await main();

      expect(mockCursorClient.getMe).toHaveBeenCalled();

      process.argv = originalArgv;
    });

    test('should handle config file corruption', async () => {
      // Corrupt the config file
      fsPromises.readFile.mockResolvedValue('invalid json {');

      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'stdio'];

      const mockCmdStdio = jest.fn();
      const mockPrintHelp = jest.fn();

      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdStdio: mockCmdStdio,
        printHelp: mockPrintHelp,
      }));

      const { main } = await import('../cli.js');

      await main();

      // Should still work and create a new config directory
      expect(fsPromises.mkdir).toHaveBeenCalled();

      process.argv = originalArgv;
    });

    test('should handle concurrent config access', async () => {
      // Simulate multiple rapid config operations
      const promises = [
        main(['node', 'cli.js', 'config']),
        main(['node', 'cli.js', 'config']),
        main(['node', 'cli.js', 'config']),
      ];

      // Mock a valid config
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'concurrent-key',
        CURSOR_API_URL: 'https://concurrent.cursor.com',
        MCP_SERVER_TOKEN: 'concurrent-token',
      }));

      await Promise.all(promises);

      // Should handle concurrent reads without issues
      expect(fsPromises.readFile).toHaveBeenCalledTimes(3);
    });
  });
});