const { jest, describe, beforeEach, afterEach, test, expect } = require('@jest/globals');

const mockFsPromises = {
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
};

jest.mock('fs/promises', () => mockFsPromises);

jest.mock('fs', () => ({
  chmodSync: jest.fn(),
  promises: mockFsPromises,
}));

const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

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

// Mock the dependencies that CLI imports
jest.mock('../utils/cursorClient.js', () => ({
  cursorApiClient: {
    getMe: jest.fn(),
  },
}));

jest.mock('../mcp-server.js', () => jest.fn());
jest.mock('../index.js', () => jest.fn());

// Import individual functions from CLI module
let getConfigDir, parseArgs, promptHidden, cmdInit, cmdStdio, cmdHttp, cmdWhoAmI, cmdShowConfig, printHelp, main, generateMCPToken, saveConfig, loadConfig, loadConfigFromFile, ensureConfigDir, ensureEnvFromConfig;

// Dynamic import to avoid issues
beforeAll(async () => {
  const cliModule = await import('../cli.js');
  getConfigDir = cliModule.getConfigDir;
  parseArgs = cliModule.parseArgs;
  promptHidden = cliModule.promptHidden;
  cmdInit = cliModule.cmdInit;
  cmdStdio = cliModule.cmdStdio;
  cmdHttp = cliModule.cmdHttp;
  cmdWhoAmI = cliModule.cmdWhoAmI;
  cmdShowConfig = cliModule.cmdShowConfig;
  printHelp = cliModule.printHelp;
  main = cliModule.main;
  generateMCPToken = cliModule.generateMCPToken;
  saveConfig = cliModule.saveConfig;
  loadConfig = cliModule.loadConfig;
  loadConfigFromFile = cliModule.loadConfigFromFile;
  ensureConfigDir = cliModule.ensureConfigDir;
  ensureEnvFromConfig = cliModule.ensureEnvFromConfig;
});

describe('CLI Module', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock successful file operations by default
    fsPromises.mkdir.mockResolvedValue();
    fsPromises.readFile.mockResolvedValue('{}');
    fsPromises.writeFile.mockResolvedValue();
    fsPromises.stat.mockResolvedValue({ isDirectory: () => true });

    // Mock process
    process.exit = jest.fn();
    process.env = { ...process.env };

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getConfigDir', () => {
    test('should return correct path for Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';

      const result = getConfigDir();
      expect(result).toBe('C:\\Users\\Test\\AppData\\Roaming/cursor-agent-mcp');
    });

    test('should return correct path for macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = getConfigDir();
      expect(path.join).toHaveBeenCalledWith('/home/testuser', 'Library', 'Application Support', 'cursor-agent-mcp');
    });

    test('should return correct path for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = getConfigDir();
      expect(path.join).toHaveBeenCalledWith('/home/testuser', '.config', 'cursor-agent-mcp');
    });
  });

  describe('parseArgs', () => {
    test('should parse flags with values', () => {
      const argv = ['--api-key', 'test-key', '--port', '3000', '--verbose'];
      const result = parseArgs(argv);

      expect(result).toEqual({
        'api-key': 'test-key',
        'port': '3000',
        'verbose': true,
      });
    });

    test('should parse flags with equals', () => {
      const argv = ['--api-key=test-key', '--port=3000'];
      const result = parseArgs(argv);

      expect(result).toEqual({
        'api-key': 'test-key',
        'port': '3000',
      });
    });

    test('should parse boolean flags without values', () => {
      const argv = ['--verbose', '--debug'];
      const result = parseArgs(argv);

      expect(result).toEqual({
        'verbose': true,
        'debug': true,
      });
    });

    test('should handle mixed flags', () => {
      const argv = ['--api-key=test-key', '--verbose', '--port', '3000', '--debug'];
      const result = parseArgs(argv);

      expect(result).toEqual({
        'api-key': 'test-key',
        'verbose': true,
        'port': '3000',
        'debug': true,
      });
    });

    test('should return empty object for no flags', () => {
      const result = parseArgs([]);
      expect(result).toEqual({});
    });
  });

  describe('generateMCPToken', () => {
    test('should generate MCP token with correct prefix', () => {
      const token = generateMCPToken();
      expect(token).toMatch(/^mcp_/);
      expect(token).toHaveLength(67); // 'mcp_' + 64 hex chars
    });
  });

  describe('ensureConfigDir', () => {
    test('should create config directory if it does not exist', async () => {
      fsPromises.stat.mockRejectedValue(new Error('Directory does not exist'));

      await ensureConfigDir();

      expect(fsPromises.mkdir).toHaveBeenCalledWith('/home/testuser/.config/cursor-agent-mcp', { recursive: true });
      expect(fs.chmodSync).toHaveBeenCalledWith('/home/testuser/.config/cursor-agent-mcp', 0o700);
    });

    test('should not create directory if it exists', async () => {
      await ensureConfigDir();

      expect(fsPromises.mkdir).not.toHaveBeenCalled();
    });

    test('should handle chmod errors gracefully', async () => {
      fsPromises.stat.mockRejectedValue(new Error('Directory does not exist'));
      fs.chmodSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await ensureConfigDir();

      expect(fsPromises.mkdir).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Could not set directory permissions:', 'Permission denied');
    });
  });

  describe('saveConfig', () => {
    test('should save config with provided values', async () => {
      const configData = {
        apiKey: 'test-api-key',
        apiUrl: 'https://custom.api.url',
        mcpToken: 'test-token',
      };

      await saveConfig(configData);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        '/home/testuser/.config/cursor-agent-mcp/config.json',
        JSON.stringify({
          CURSOR_API_KEY: 'test-api-key',
          CURSOR_API_URL: 'https://custom.api.url',
          MCP_SERVER_TOKEN: 'test-token',
        }, null, 2),
        { encoding: 'utf8' },
      );
    });

    test('should use default API URL if not provided', async () => {
      const configData = {
        apiKey: 'test-api-key',
        mcpToken: 'test-token',
      };

      await saveConfig(configData);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"CURSOR_API_URL": "https://api.cursor.com"'),
        expect.any(Object),
      );
    });

    test('should generate new token if not provided', async () => {
      const configData = {
        apiKey: 'test-api-key',
      };

      await saveConfig(configData);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/"MCP_SERVER_TOKEN": "mcp_[a-f0-9]{64}"/),
        expect.any(Object),
      );
    });

    test('should handle chmod errors gracefully', async () => {
      fs.chmodSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await saveConfig({ apiKey: 'test' });

      expect(console.warn).toHaveBeenCalledWith('Could not set file permissions:', 'Permission denied');
    });
  });

  describe('loadConfigFromFile', () => {
    test('should load and parse valid config file', async () => {
      const mockConfig = {
        CURSOR_API_KEY: 'test-key',
        CURSOR_API_URL: 'https://test.url',
        MCP_SERVER_TOKEN: 'test-token',
      };
      fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await loadConfigFromFile();

      expect(result).toEqual(mockConfig);
    });

    test('should return null if config file does not exist', async () => {
      fsPromises.stat.mockRejectedValue(new Error('File not found'));

      const result = await loadConfigFromFile();

      expect(result).toBeNull();
    });

    test('should return null and warn on parse error', async () => {
      fsPromises.readFile.mockResolvedValue('invalid json');

      const result = await loadConfigFromFile();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('Could not read config file:', expect.any(String));
    });
  });

  describe('loadConfig', () => {
    beforeEach(() => {
      delete process.env.CURSOR_API_KEY;
      delete process.env.CURSOR_API_URL;
      delete process.env.MCP_SERVER_TOKEN;
    });

    test('should load from environment variables when available', async () => {
      process.env.CURSOR_API_KEY = 'env-api-key';
      process.env.CURSOR_API_URL = 'https://env.url';
      process.env.MCP_SERVER_TOKEN = 'env-token';

      const result = await loadConfig();

      expect(result).toEqual({
        CURSOR_API_KEY: 'env-api-key',
        CURSOR_API_URL: 'https://env.url',
        MCP_SERVER_TOKEN: 'env-token',
      });
    });

    test('should load from file when env vars not set', async () => {
      process.env.CURSOR_API_KEY = '';
      const mockConfig = {
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.url',
        MCP_SERVER_TOKEN: 'file-token',
      };
      fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await loadConfig();

      expect(result).toEqual({
        CURSOR_API_KEY: 'file-key',
        CURSOR_API_URL: 'https://file.url',
        MCP_SERVER_TOKEN: 'file-token',
      });
    });

    test('should use default API URL when not in file', async () => {
      process.env.CURSOR_API_KEY = '';
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'file-key',
        MCP_SERVER_TOKEN: 'file-token',
      }));

      const result = await loadConfig();

      expect(result.CURSOR_API_URL).toBe('https://api.cursor.com');
    });

    test('should return null when no valid config found', async () => {
      process.env.CURSOR_API_KEY = '';
      fsPromises.stat.mockRejectedValue(new Error('File not found'));

      const result = await loadConfig();

      expect(result).toBeNull();
    });

    test('should return null when API key is empty string', async () => {
      process.env.CURSOR_API_KEY = '';
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: '',
        CURSOR_API_URL: 'https://test.url',
        MCP_SERVER_TOKEN: 'token',
      }));

      const result = await loadConfig();

      expect(result).toBeNull();
    });
  });

  describe('ensureEnvFromConfig', () => {
    test('should set environment variables from config', async () => {
      const mockConfig = {
        CURSOR_API_KEY: 'test-key',
        CURSOR_API_URL: 'https://test.url',
        MCP_SERVER_TOKEN: 'test-token',
      };
      fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      await ensureEnvFromConfig();

      expect(process.env.CURSOR_API_KEY).toBe('test-key');
      expect(process.env.CURSOR_API_URL).toBe('https://test.url');
      expect(process.env.MCP_SERVER_TOKEN).toBe('test-token');
    });

    test('should exit with error when no config found', async () => {
      fsPromises.stat.mockRejectedValue(new Error('File not found'));

      await ensureEnvFromConfig();

      expect(console.error).toHaveBeenCalledWith('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('promptHidden', () => {
    test('should return user input', async () => {
      const mockRl = {
        question: jest.fn((question, callback) => callback('user-input')),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const result = await promptHidden('Enter password: ');

      expect(result).toBe('user-input');
      expect(mockRl.question).toHaveBeenCalledWith('Enter password: ', expect.any(Function));
    });

    test('should handle special characters correctly', async () => {
      const mockRl = {
        question: jest.fn((question, callback) => callback('p@ssw0rd!')),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const result = await promptHidden('Enter: ');

      expect(result).toBe('p@ssw0rd!');
    });
  });

  describe('cmdInit', () => {
    test('should save config from flags', async () => {
      const flags = {
        'api-key': 'flag-key',
        'api-url': 'https://flag.url',
        'generate-token': false,
      };

      await cmdInit(flags);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"CURSOR_API_KEY": "flag-key"'),
        expect.any(Object),
      );
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"CURSOR_API_URL": "https://flag.url"'),
        expect.any(Object),
      );
      expect(console.log).toHaveBeenCalledWith('✅ Saved credentials to local config with restricted permissions.');
    });

    test('should prompt for API key when not provided', async () => {
      const mockRl = {
        question: jest.fn((question, callback) => callback('prompted-key')),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const flags = {};

      await cmdInit(flags);

      expect(mockRl.question).toHaveBeenCalledWith('Enter CURSOR_API_KEY: ', expect.any(Function));
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"CURSOR_API_KEY": "prompted-key"'),
        expect.any(Object),
      );
    });

    test('should exit with error for invalid API key', async () => {
      const flags = {
        'api-key': 'short', // Less than 8 characters
      };

      await cmdInit(flags);

      expect(console.error).toHaveBeenCalledWith('Invalid API key.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should exit with error for empty API key', async () => {
      const mockRl = {
        question: jest.fn((question, callback) => callback('')),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      const flags = {};

      await cmdInit(flags);

      expect(console.error).toHaveBeenCalledWith('Invalid API key.');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should generate MCP token by default', async () => {
      const flags = {
        'api-key': 'test-key',
      };

      await cmdInit(flags);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/"MCP_SERVER_TOKEN": "mcp_[a-f0-9]{64}"/),
        expect.any(Object),
      );
      expect(console.log).toHaveBeenCalledWith('✅ Saved credentials to local config with restricted permissions.');
      expect(console.log).toHaveBeenCalledWith('🔐 Generated MCP server token for remote access.');
    });

    test('should not generate token when generateToken is false', async () => {
      const flags = {
        'api-key': 'test-key',
        'generate-token': false,
      };

      await cmdInit(flags);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringMatching(/MCP_SERVER_TOKEN/),
        expect.any(Object),
      );
    });
  });

  describe('cmdStdio', () => {
    test('should import mcp-server module after ensuring config', async () => {
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'test-key',
        CURSOR_API_URL: 'https://test.url',
        MCP_SERVER_TOKEN: 'test-token',
      }));

      await cmdStdio();

      expect(fsPromises.readFile).toHaveBeenCalled();
      // We can't easily test the dynamic import, but we can verify the config loading happened
    });
  });

  describe('cmdHttp', () => {
    test('should set PORT environment variable when provided', async () => {
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'test-key',
        CURSOR_API_URL: 'https://test.url',
        MCP_SERVER_TOKEN: 'test-token',
      }));

      const flags = { port: '8080' };

      await cmdHttp(flags);

      expect(process.env.PORT).toBe('8080');
    });

    test('should not override PORT if not provided', async () => {
      const originalPort = process.env.PORT;
      delete process.env.PORT;

      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'test-key',
      }));

      await cmdHttp({});

      expect(process.env.PORT).toBeUndefined();
      process.env.PORT = originalPort;
    });
  });

  describe('cmdWhoAmI', () => {
    test('should call cursorApiClient.getMe and log result', async () => {
      const mockMeData = { user: 'testuser', email: 'test@example.com' };
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'test-key',
      }));

      // Mock the cursorClient
      const cursorClientMock = {
        getMe: jest.fn().mockResolvedValue(mockMeData),
      };
      jest.doMock('../utils/cursorClient.js', () => ({
        cursorApiClient: cursorClientMock,
      }));

      await cmdWhoAmI();

      expect(cursorClientMock.getMe).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(JSON.stringify(mockMeData, null, 2));
    });

    test('should handle API errors gracefully', async () => {
      fsPromises.readFile.mockResolvedValue(JSON.stringify({
        CURSOR_API_KEY: 'test-key',
      }));

      const cursorClientMock = {
        getMe: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      jest.doMock('../utils/cursorClient.js', () => ({
        cursorApiClient: cursorClientMock,
      }));

      await cmdWhoAmI();

      expect(console.error).toHaveBeenCalledWith('Failed to call /v0/me. Check your key and network.');
      expect(console.error).toHaveBeenCalledWith('API Error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('cmdShowConfig', () => {
    test('should show config with masked sensitive data', async () => {
      const mockConfig = {
        CURSOR_API_KEY: 'very-long-api-key-that-should-be-masked',
        CURSOR_API_URL: 'https://custom.api.url',
        MCP_SERVER_TOKEN: 'very-long-token-that-should-be-masked',
      };
      fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      await cmdShowConfig();

      expect(console.log).toHaveBeenCalledWith('📋 Current Configuration:');
      expect(console.log).toHaveBeenCalledWith('🔑 API Key: ***masked');
      expect(console.log).toHaveBeenCalledWith('🌐 API URL: https://custom.api.url');
      expect(console.log).toHaveBeenCalledWith('🔐 MCP Token: ***masked');
    });

    test('should show message when no config found', async () => {
      fsPromises.stat.mockRejectedValue(new Error('File not found'));

      await cmdShowConfig();

      expect(console.log).toHaveBeenCalledWith('No configuration found. Run: cursor-agent-mcp init');
    });

    test('should show default values when not set', async () => {
      const mockConfig = {
        CURSOR_API_KEY: 'test-key',
        CURSOR_API_URL: 'https://api.cursor.com',
      };
      fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      await cmdShowConfig();

      expect(console.log).toHaveBeenCalledWith('🔑 API Key: ***key');
      expect(console.log).toHaveBeenCalledWith('🌐 API URL: https://api.cursor.com');
      expect(console.log).toHaveBeenCalledWith('🔐 MCP Token: Not set');
    });

    test('should show remote access instructions when MCP token exists', async () => {
      const mockConfig = {
        CURSOR_API_KEY: 'test-key',
        MCP_SERVER_TOKEN: 'test-token',
      };
      fsPromises.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      await cmdShowConfig();

      expect(console.log).toHaveBeenCalledWith('\n📡 For ChatGPT remote access:');
      expect(console.log).toHaveBeenCalledWith('   1. Start HTTP server: cursor-agent-mcp http');
      expect(console.log).toHaveBeenCalledWith('   2. Expose via ngrok: ngrok http 3000');
      expect(console.log).toHaveBeenCalledWith('   3. Use URL: https://your-id.ngrok.io/sse');
      expect(console.log).toHaveBeenCalledWith('   4. Add header: X-MCP-Auth: test-token');
    });
  });

  describe('printHelp', () => {
    test('should print help information', () => {
      printHelp();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('cursor-agent-mcp <command> [options]'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('init'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('stdio'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('http'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('whoami'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('config'));
    });
  });

  describe('main', () => {
    test('should call cmdInit for init command', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'init', '--api-key', 'test-key'];

      // Mock cmdInit to verify it gets called
      const mockCmdInit = jest.fn();
      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdInit: mockCmdInit,
      }));

      await main();

      expect(mockCmdInit).toHaveBeenCalledWith({ 'api-key': 'test-key' });

      process.argv = originalArgv;
    });

    test('should call cmdStdio for stdio command', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'stdio'];

      const mockCmdStdio = jest.fn();
      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdStdio: mockCmdStdio,
      }));

      await main();

      expect(mockCmdStdio).toHaveBeenCalled();

      process.argv = originalArgv;
    });

    test('should call cmdHttp for http command', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'http', '--port', '8080'];

      const mockCmdHttp = jest.fn();
      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdHttp: mockCmdHttp,
      }));

      await main();

      expect(mockCmdHttp).toHaveBeenCalledWith({ 'port': '8080' });

      process.argv = originalArgv;
    });

    test('should call cmdWhoAmI for whoami command', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'whoami'];

      const mockCmdWhoAmI = jest.fn();
      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdWhoAmI: mockCmdWhoAmI,
      }));

      await main();

      expect(mockCmdWhoAmI).toHaveBeenCalled();

      process.argv = originalArgv;
    });

    test('should call cmdShowConfig for config command', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'config'];

      const mockCmdShowConfig = jest.fn();
      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdShowConfig: mockCmdShowConfig,
      }));

      await main();

      expect(mockCmdShowConfig).toHaveBeenCalled();

      process.argv = originalArgv;
    });

    test('should print help for unknown command', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'unknown'];

      const mockPrintHelp = jest.fn();
      jest.doMock('../cli.js', () => ({
        ...cliModule,
        printHelp: mockPrintHelp,
      }));

      await main();

      expect(mockPrintHelp).toHaveBeenCalled();

      process.argv = originalArgv;
    });

    test('should print help when no command provided', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js'];

      const mockPrintHelp = jest.fn();
      jest.doMock('../cli.js', () => ({
        ...cliModule,
        printHelp: mockPrintHelp,
      }));

      await main();

      expect(mockPrintHelp).toHaveBeenCalled();

      process.argv = originalArgv;
    });

    test('should handle errors in main and exit', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'init'];

      jest.doMock('../cli.js', () => ({
        ...cliModule,
        cmdInit: jest.fn().mockRejectedValue(new Error('Test error')),
      }));

      await main();

      expect(console.error).toHaveBeenCalledWith(expect.any(Error));
      expect(process.exit).toHaveBeenCalledWith(1);

      process.argv = originalArgv;
    });
  });
});