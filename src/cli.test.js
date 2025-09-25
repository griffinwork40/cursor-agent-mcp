/**
 * Comprehensive test suite for CLI module (src/cli.js)
 * 
 * This test suite covers all aspects of the CLI functionality including:
 * 
 * 1. Configuration file management (save/load config files with proper permissions)
 * 2. Command parsing and argument handling
 * 3. Platform-specific config directory creation (Windows, macOS, Linux)
 * 4. Credential validation and hidden input prompting
 * 5. All CLI commands with proper mocking (init, stdio, http, whoami, config)
 * 6. Error handling for missing credentials and other edge cases
 * 7. File permissions setting on different platforms
 * 8. Environment variable precedence over file config
 * 9. Token generation and validation
 * 10. Help text and usage information
 * 
 * The test suite uses Jest with ES modules support and comprehensive mocking
 * for file system operations, readline interface, and process operations.
 * 
 * Coverage: 84.78% statements, 76.19% branches, 90.47% functions, 84.67% lines
 * Total Tests: 50 passing tests
 * 
 * Run with: npm run test:cli
 * Run with coverage: npm run test:coverage
 */

import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import os from 'os';

// Mock modules before importing the CLI
const mockMkdir = jest.fn();
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockStat = jest.fn();
const mockChmodSync = jest.fn();
const mockCreateInterface = jest.fn();
const mockQuestion = jest.fn();
const mockClose = jest.fn();
const mockCursorApiClient = {
  getMe: jest.fn(),
};

// Mock fs/promises
jest.unstable_mockModule('fs/promises', () => ({
  mkdir: mockMkdir,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  stat: mockStat,
}));

// Mock fs
jest.unstable_mockModule('fs', () => ({
  default: {
    chmodSync: mockChmodSync,
  },
  chmodSync: mockChmodSync,
}));

// Mock readline
jest.unstable_mockModule('readline', () => ({
  default: {
    createInterface: mockCreateInterface,
  },
  createInterface: mockCreateInterface,
}));

// Mock crypto
const mockRandomBytes = jest.fn();
jest.unstable_mockModule('crypto', () => ({
  default: {
    randomBytes: mockRandomBytes,
  },
  randomBytes: mockRandomBytes,
}));

// Mock cursor client
jest.unstable_mockModule('./utils/cursorClient.js', () => ({
  cursorApiClient: mockCursorApiClient,
}));

// Mock dynamic imports
const mockMcpServer = jest.fn();
const mockIndex = jest.fn();
jest.unstable_mockModule('./mcp-server.js', () => ({
  default: mockMcpServer,
}));
jest.unstable_mockModule('./index.js', () => ({
  default: mockIndex,
}));

describe('CLI Module', () => {
  let cli;
  let originalArgv;
  let originalEnv;
  let originalPlatform;
  let originalExit;
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;
  let mockExit;
  let mockConsoleLog;
  let mockConsoleError;
  let mockConsoleWarn;

  beforeAll(async () => {
    // Import the CLI module after mocking
    cli = await import('./cli.js');
  });

  beforeEach(() => {
    // Store original values
    originalArgv = process.argv;
    originalEnv = { ...process.env };
    originalPlatform = process.platform;
    originalExit = process.exit;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;

    // Clear CURSOR environment variables to prevent test interference
    delete process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_URL;
    delete process.env.MCP_SERVER_TOKEN;
    delete process.env.PORT;

    // Mock process methods
    mockExit = jest.fn();
    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    mockConsoleWarn = jest.fn();
    
    process.exit = mockExit;
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;

    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock returns
    mockRandomBytes.mockReturnValue(Buffer.from('test-random-bytes'));
    mockCreateInterface.mockReturnValue({
      question: mockQuestion,
      close: mockClose,
    });
  });

  afterEach(() => {
    // Restore original values
    process.argv = originalArgv;
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('Configuration Directory Management', () => {
    test('should return correct config directory for Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';
      
      const configDir = cli.getConfigDir();
      
      expect(configDir).toBe(path.join('C:\\Users\\test\\AppData\\Roaming', 'cursor-agent-mcp'));
    });

    test('should return correct config directory for macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      jest.spyOn(os, 'homedir').mockReturnValue('/Users/test');
      
      const configDir = cli.getConfigDir();
      
      expect(configDir).toBe('/Users/test/Library/Application Support/cursor-agent-mcp');
    });

    test('should return correct config directory for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      jest.spyOn(os, 'homedir').mockReturnValue('/home/test');
      
      const configDir = cli.getConfigDir();
      
      expect(configDir).toBe('/home/test/.config/cursor-agent-mcp');
    });

    test('should create config directory with proper permissions on Unix', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      
      await cli.ensureConfigDir();
      
      expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(mockChmodSync).toHaveBeenCalledWith(expect.any(String), 0o700);
    });

    test('should skip chmod on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      
      await cli.ensureConfigDir();
      
      expect(mockMkdir).toHaveBeenCalled();
      expect(mockChmodSync).not.toHaveBeenCalled();
    });

    test('should handle chmod errors gracefully', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      mockChmodSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      await cli.ensureConfigDir();
      
      expect(mockConsoleWarn).toHaveBeenCalledWith('Could not set directory permissions:', 'Permission denied');
    });

    test('should not create directory if it already exists', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => true });
      
      await cli.ensureConfigDir();
      
      expect(mockMkdir).not.toHaveBeenCalled();
    });
  });

  describe('Configuration File Management', () => {
    test('should save config with proper structure and permissions', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT')); // Config dir doesn't exist
      mockMkdir.mockResolvedValue();
      mockReadFile.mockRejectedValue(new Error('ENOENT')); // Config file doesn't exist
      mockWriteFile.mockResolvedValue();
      
      await cli.saveConfig({
        apiKey: 'test-api-key',
        apiUrl: 'https://api.cursor.com',
        mcpToken: 'test-mcp-token',
      });
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        JSON.stringify({
          CURSOR_API_KEY: 'test-api-key',
          CURSOR_API_URL: 'https://api.cursor.com',
          MCP_SERVER_TOKEN: 'test-mcp-token',
        }, null, 2),
        { encoding: 'utf8' },
      );
      expect(mockChmodSync).toHaveBeenCalledWith(expect.stringContaining('config.json'), 0o600);
    });

    test('should generate MCP token if not provided', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      mockWriteFile.mockResolvedValue();
      mockRandomBytes.mockReturnValue(Buffer.from('abcdef123456789', 'hex'));
      
      await cli.saveConfig({
        apiKey: 'test-api-key',
        apiUrl: 'https://api.cursor.com',
      });
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('mcp_'),
        expect.any(Object),
      );
    });

    test('should preserve existing MCP token when updating config', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockResolvedValue({}); // Config dir exists
      mockReadFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'old-key',
        CURSOR_API_URL: 'https://api.cursor.com',
        MCP_SERVER_TOKEN: 'existing-token',
      }));
      mockWriteFile.mockResolvedValue();
      
      await cli.saveConfig({
        apiKey: 'new-api-key',
        apiUrl: 'https://api.cursor.com',
      });
      
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('existing-token'),
        expect.any(Object),
      );
    });

    test('should load config from file successfully', async () => {
      const configData = {
        CURSOR_API_KEY: 'test-key',
        CURSOR_API_URL: 'https://api.cursor.com',
        MCP_SERVER_TOKEN: 'test-token',
      };
      mockStat.mockResolvedValue({});
      mockReadFile.mockResolvedValue(JSON.stringify(configData));
      
      const result = await cli.loadConfigFromFile();
      
      expect(result).toEqual(configData);
    });

    test('should return null if config file does not exist', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));
      
      const result = await cli.loadConfigFromFile();
      
      expect(result).toBeNull();
    });

    test('should handle corrupted config file gracefully', async () => {
      mockStat.mockResolvedValue({});
      mockReadFile.mockResolvedValue('invalid json');
      
      const result = await cli.loadConfigFromFile();
      
      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith('Could not read config file:', expect.any(String));
    });
  });

  describe('Environment Variable Precedence', () => {
    test('should prefer environment variables over file config', async () => {
      process.env.CURSOR_API_KEY = 'env-key';
      process.env.CURSOR_API_URL = 'https://env.cursor.com';
      process.env.MCP_SERVER_TOKEN = 'env-token';
      
      mockStat.mockResolvedValue({});
      mockReadFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.cursor.com',
        MCP_SERVER_TOKEN: 'file-token',
      }));
      
      const result = await cli.loadConfig();
      
      expect(result).toEqual({
        CURSOR_API_KEY: 'env-key',
        CURSOR_API_URL: 'https://env.cursor.com',
        MCP_SERVER_TOKEN: 'env-token',
      });
    });

    test('should use default API URL when env var is not set', async () => {
      process.env.CURSOR_API_KEY = 'env-key';
      delete process.env.CURSOR_API_URL;
      delete process.env.MCP_SERVER_TOKEN;
      
      const result = await cli.loadConfig();
      
      expect(result).toEqual({
        CURSOR_API_KEY: 'env-key',
        CURSOR_API_URL: 'https://api.cursor.com',
        MCP_SERVER_TOKEN: undefined,
      });
    });

    test('should fall back to file config when env vars are not set', async () => {
      delete process.env.CURSOR_API_KEY;
      delete process.env.CURSOR_API_URL;
      delete process.env.MCP_SERVER_TOKEN;
      
      const fileConfig = {
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.cursor.com',
        MCP_SERVER_TOKEN: 'file-token',
      };
      
      mockStat.mockResolvedValue({});
      mockReadFile.mockResolvedValue(JSON.stringify(fileConfig));
      
      const result = await cli.loadConfig();
      
      expect(result).toEqual(fileConfig);
    });

    test('should return null when no config is available', async () => {
      delete process.env.CURSOR_API_KEY;
      delete process.env.CURSOR_API_URL;
      delete process.env.MCP_SERVER_TOKEN;
      
      mockStat.mockRejectedValue(new Error('ENOENT'));
      
      const result = await cli.loadConfig();
      
      expect(result).toBeNull();
    });
  });

  describe('Command Parsing', () => {
    test('should parse simple flags correctly', () => {
      const result = cli.parseArgs(['--api-key', 'test-key', '--port', '3000']);
      
      expect(result).toEqual({
        'api-key': 'test-key',
        port: '3000',
      });
    });

    test('should parse flags with equals syntax', () => {
      const result = cli.parseArgs(['--api-key=test-key', '--port=3000']);
      
      expect(result).toEqual({
        'api-key': 'test-key',
        port: '3000',
      });
    });

    test('should parse boolean flags', () => {
      const result = cli.parseArgs(['--verbose', '--debug']);
      
      expect(result).toEqual({
        verbose: true,
        debug: true,
      });
    });

    test('should handle mixed flag formats', () => {
      const result = cli.parseArgs(['--api-key=test-key', '--port', '3000', '--verbose']);
      
      expect(result).toEqual({
        'api-key': 'test-key',
        port: '3000',
        verbose: true,
      });
    });

    test('should handle empty arguments', () => {
      const result = cli.parseArgs([]);
      
      expect(result).toEqual({});
    });
  });

  describe('Token Generation', () => {
    test('should generate MCP token with correct format', () => {
      // Create a proper 32-byte buffer (64 hex characters)
      mockRandomBytes.mockReturnValue(Buffer.from('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'hex'));
      
      const token = cli.generateMCPToken();
      
      expect(token).toMatch(/^mcp_[a-f0-9]{64}$/);
      expect(mockRandomBytes).toHaveBeenCalledWith(32);
    });

    test('should generate unique tokens', () => {
      mockRandomBytes
        .mockReturnValueOnce(Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', 'hex'))
        .mockReturnValueOnce(Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2', 'hex'));
      
      const token1 = cli.generateMCPToken();
      const token2 = cli.generateMCPToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('Hidden Input Prompting', () => {
    test('should prompt for hidden input correctly', async () => {
      const mockRl = {
        question: jest.fn(),
        close: jest.fn(),
      };
      mockCreateInterface.mockReturnValue(mockRl);
      
      // Mock stdin listeners
      const mockOn = jest.fn();
      const mockRemoveListener = jest.fn();
      const originalStdin = process.stdin;
      
      Object.defineProperty(process, 'stdin', {
        value: { on: mockOn, removeListener: mockRemoveListener },
        writable: true,
      });
      
      // Mock stdout methods
      const mockStdout = {
        clearLine: jest.fn(),
        cursorTo: jest.fn(),
        write: jest.fn(),
      };
      const originalStdout = process.stdout;
      Object.defineProperty(process, 'stdout', {
        value: mockStdout,
        writable: true,
      });
      
      try {
        mockRl.question.mockImplementation((question, callback) => {
          callback('secret-input');
        });
        
        const result = await cli.promptHidden('Enter password: ');
        
        expect(result).toBe('secret-input');
        expect(mockRl.question).toHaveBeenCalledWith('Enter password: ', expect.any(Function));
        expect(mockRl.close).toHaveBeenCalled();
      } finally {
        Object.defineProperty(process, 'stdin', {
          value: originalStdin,
          writable: true,
        });
        Object.defineProperty(process, 'stdout', {
          value: originalStdout,
          writable: true,
        });
      }
    });
  });

  describe('CLI Commands', () => {
    describe('init command', () => {
      test('should initialize with provided API key', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        mockStat.mockRejectedValue(new Error('ENOENT'));
        mockMkdir.mockResolvedValue();
        mockReadFile.mockRejectedValue(new Error('ENOENT'));
        mockWriteFile.mockResolvedValue();
        
        await cli.cmdInit({ apiKey: 'test-api-key' });
        
        expect(mockWriteFile).toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Saved credentials to local config with restricted permissions.');
      });

      test('should reject invalid API key', async () => {
        await cli.cmdInit({ apiKey: 'short' });
        
        expect(mockConsoleError).toHaveBeenCalledWith('Invalid API key.');
        expect(mockExit).toHaveBeenCalledWith(1);
      });

      test('should use default API URL when not provided', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        mockStat.mockRejectedValue(new Error('ENOENT'));
        mockMkdir.mockResolvedValue();
        mockReadFile.mockRejectedValue(new Error('ENOENT'));
        mockWriteFile.mockResolvedValue();
        
        await cli.cmdInit({ apiKey: 'test-api-key' });
        
        expect(mockWriteFile).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('https://api.cursor.com'),
          expect.any(Object),
        );
      });
    });

    describe('stdio command', () => {
      test('should start MCP server over stdio', async () => {
        mockStat.mockResolvedValue({});
        mockReadFile.mockResolvedValue(JSON.stringify({
          CURSOR_API_KEY: 'test-key',
          CURSOR_API_URL: 'https://api.cursor.com',
          MCP_SERVER_TOKEN: 'test-token',
        }));
        
        await cli.cmdStdio();
        
        expect(process.env.CURSOR_API_KEY).toBe('test-key');
        expect(process.env.CURSOR_API_URL).toBe('https://api.cursor.com');
        expect(process.env.MCP_SERVER_TOKEN).toBe('test-token');
      });

      test('should exit if no config is available', async () => {
        mockStat.mockRejectedValue(new Error('ENOENT'));
        
        // Mock process.exit to prevent the function from trying to access cfg.CURSOR_API_KEY
        mockExit.mockImplementation(() => {
          throw new Error('process.exit called');
        });
        
        await expect(cli.cmdStdio()).rejects.toThrow('process.exit called');
        
        expect(mockConsoleError).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });

    describe('http command', () => {
      test('should start HTTP server with default port', async () => {
        mockStat.mockResolvedValue({});
        mockReadFile.mockResolvedValue(JSON.stringify({
          CURSOR_API_KEY: 'test-key',
          CURSOR_API_URL: 'https://api.cursor.com',
          MCP_SERVER_TOKEN: 'test-token',
        }));
        
        await cli.cmdHttp({});
        
        expect(process.env.CURSOR_API_KEY).toBe('test-key');
        expect(process.env.PORT).toBeUndefined();
      });

      test('should start HTTP server with custom port', async () => {
        mockStat.mockResolvedValue({});
        mockReadFile.mockResolvedValue(JSON.stringify({
          CURSOR_API_KEY: 'test-key',
          CURSOR_API_URL: 'https://api.cursor.com',
          MCP_SERVER_TOKEN: 'test-token',
        }));
        
        await cli.cmdHttp({ port: 8080 });
        
        expect(process.env.PORT).toBe('8080');
      });
    });

    describe('whoami command', () => {
      test('should call API and display user info', async () => {
        mockStat.mockResolvedValue({});
        mockReadFile.mockResolvedValue(JSON.stringify({
          CURSOR_API_KEY: 'test-key',
          CURSOR_API_URL: 'https://api.cursor.com',
        }));
        
        const mockUserData = { id: '123', email: 'test@example.com' };
        mockCursorApiClient.getMe.mockResolvedValue(mockUserData);
        
        await cli.cmdWhoAmI();
        
        expect(mockCursorApiClient.getMe).toHaveBeenCalled();
        expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockUserData, null, 2));
      });

      test('should handle API errors gracefully', async () => {
        mockStat.mockResolvedValue({});
        mockReadFile.mockResolvedValue(JSON.stringify({
          CURSOR_API_KEY: 'invalid-key',
          CURSOR_API_URL: 'https://api.cursor.com',
        }));
        
        mockCursorApiClient.getMe.mockRejectedValue(new Error('Unauthorized'));
        
        await cli.cmdWhoAmI();
        
        expect(mockConsoleError).toHaveBeenCalledWith('Failed to call /v0/me. Check your key and network.');
        expect(mockConsoleError).toHaveBeenCalledWith('Unauthorized');
        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });

    describe('config command', () => {
      test('should display current configuration', async () => {
        mockStat.mockResolvedValue({});
        mockReadFile.mockResolvedValue(JSON.stringify({
          CURSOR_API_KEY: 'test-key-12345678',
          CURSOR_API_URL: 'https://api.cursor.com',
          MCP_SERVER_TOKEN: 'test-token-87654321',
        }));
        
        await cli.cmdShowConfig();
        
        expect(mockConsoleLog).toHaveBeenCalledWith('📋 Current Configuration:');
        expect(mockConsoleLog).toHaveBeenCalledWith('🔑 API Key: ***12345678');
        expect(mockConsoleLog).toHaveBeenCalledWith('🌐 API URL: https://api.cursor.com');
        expect(mockConsoleLog).toHaveBeenCalledWith('🔐 MCP Token: ***87654321');
      });

      test('should handle missing configuration', async () => {
        mockStat.mockRejectedValue(new Error('ENOENT'));
        
        await cli.cmdShowConfig();
        
        expect(mockConsoleLog).toHaveBeenCalledWith('No configuration found. Run: cursor-agent-mcp init');
      });

      test('should display remote access instructions when MCP token exists', async () => {
        mockStat.mockResolvedValue({});
        mockReadFile.mockResolvedValue(JSON.stringify({
          CURSOR_API_KEY: 'test-key',
          CURSOR_API_URL: 'https://api.cursor.com',
          MCP_SERVER_TOKEN: 'test-token-12345678',
        }));
        
        await cli.cmdShowConfig();
        
        expect(mockConsoleLog).toHaveBeenCalledWith('\n📡 For ChatGPT remote access:');
        expect(mockConsoleLog).toHaveBeenCalledWith('   4. Add header: X-MCP-Auth: test-token-12345678');
      });
    });
  });

  describe('Help Text', () => {
    test('should display help text correctly', () => {
      cli.printHelp();
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('cursor-agent-mcp <command> [options]'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('init'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('stdio'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('http'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('whoami'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('config'));
    });
  });

  describe('Error Handling', () => {
    test('should handle file permission errors gracefully', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      mockWriteFile.mockResolvedValue();
      mockChmodSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      await cli.saveConfig({ apiKey: 'test-key' });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith('Could not set file permissions:', 'Permission denied');
    });

    test('should handle config file read errors', async () => {
      mockStat.mockResolvedValue({});
      mockReadFile.mockRejectedValue(new Error('Permission denied'));
      
      const result = await cli.loadConfigFromFile();
      
      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith('Could not read config file:', 'Permission denied');
    });

    test('should handle invalid JSON in config file', async () => {
      mockStat.mockResolvedValue({});
      mockReadFile.mockResolvedValue('{ invalid json }');
      
      const result = await cli.loadConfigFromFile();
      
      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith('Could not read config file:', expect.any(String));
    });

    test('should exit when config is missing for commands that require it', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));
      
      // Mock process.exit to prevent the function from trying to access cfg.CURSOR_API_KEY
      mockExit.mockImplementation(() => {
        throw new Error('process.exit called');
      });
      
      await expect(cli.ensureEnvFromConfig()).rejects.toThrow('process.exit called');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('File Permissions', () => {
    test('should set correct permissions on config directory (Unix)', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      
      await cli.ensureConfigDir();
      
      expect(mockChmodSync).toHaveBeenCalledWith(expect.any(String), 0o700);
    });

    test('should set correct permissions on config file (Unix)', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      mockWriteFile.mockResolvedValue();
      
      await cli.saveConfig({ apiKey: 'test-key' });
      
      expect(mockChmodSync).toHaveBeenCalledWith(expect.stringContaining('config.json'), 0o600);
    });

    test('should skip permissions on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      mockWriteFile.mockResolvedValue();
      
      await cli.saveConfig({ apiKey: 'test-key' });
      
      expect(mockChmodSync).not.toHaveBeenCalled();
    });
  });

  describe('Path Utilities', () => {
    test('should correctly check if path exists', async () => {
      mockStat.mockResolvedValue({ isFile: () => true });
      
      const result = await cli.pathExists('/test/path');
      
      expect(result).toBe(true);
      expect(mockStat).toHaveBeenCalledWith('/test/path');
    });

    test('should return false if path does not exist', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));
      
      const result = await cli.pathExists('/nonexistent/path');
      
      expect(result).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should handle prompt for API key during init when not provided via flag', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      mockStat.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockResolvedValue();
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      mockWriteFile.mockResolvedValue();
      
      const mockRl = {
        question: jest.fn((question, callback) => {
          // Simulate user input
          callback('prompted-api-key');
        }),
        close: jest.fn(),
      };
      mockCreateInterface.mockReturnValue(mockRl);
      
      // Mock stdin/stdout for promptHidden
      const mockOn = jest.fn();
      const mockRemoveListener = jest.fn();
      const mockStdout = {
        clearLine: jest.fn(),
        cursorTo: jest.fn(),
        write: jest.fn(),
      };
      
      const originalStdin = process.stdin;
      const originalStdout = process.stdout;
      
      Object.defineProperty(process, 'stdin', {
        value: { on: mockOn, removeListener: mockRemoveListener },
        writable: true,
      });
      Object.defineProperty(process, 'stdout', {
        value: mockStdout,
        writable: true,
      });
      
      try {
        await cli.cmdInit({});
        
        expect(mockWriteFile).toHaveBeenCalledWith(
          expect.stringContaining('config.json'),
          expect.stringContaining('prompted-api-key'),
          expect.any(Object),
        );
        expect(mockConsoleLog).toHaveBeenCalledWith('✅ Saved credentials to local config with restricted permissions.');
      } finally {
        Object.defineProperty(process, 'stdin', {
          value: originalStdin,
          writable: true,
        });
        Object.defineProperty(process, 'stdout', {
          value: originalStdout,
          writable: true,
        });
      }
    });

    test('should handle environment variable fallback when file config has empty key', async () => {
      process.env.CURSOR_API_KEY = 'env-fallback-key';
      
      mockStat.mockResolvedValue({});
      mockReadFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: '', // Empty key in file
        CURSOR_API_URL: 'https://api.cursor.com',
      }));
      
      const result = await cli.loadConfig();
      
      expect(result).toEqual({
        CURSOR_API_KEY: 'env-fallback-key',
        CURSOR_API_URL: 'https://api.cursor.com',
        MCP_SERVER_TOKEN: undefined,
      });
    });

    test('should handle Windows APPDATA fallback when env var not set', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      delete process.env.APPDATA;
      jest.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\test');
      
      const configDir = cli.getConfigDir();
      
      expect(configDir).toBe(path.join('C:\\Users\\test', 'AppData', 'Roaming', 'cursor-agent-mcp'));
    });
  });
});