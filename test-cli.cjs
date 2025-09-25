#!/usr/bin/env node

/**
 * Simple test runner for CLI functionality
 * This tests the core functions without relying on Jest's module system
 */

const fs = require('fs');
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// Mock all dependencies
const originalFs = { ...fs };
const originalFsPromises = { ...fsPromises };
const originalOs = { ...os };
const originalPath = { ...path };
const originalCrypto = { ...crypto };
const originalReadline = { ...readline };

// Test counter
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Test utilities
function test(name, fn) {
  testsRun++;
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    testsFailed++;
  }
}

function expect(value) {
  return {
    toBe: (expected) => {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, got ${value}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    toMatch: (pattern) => {
      if (!pattern.test(value)) {
        throw new Error(`Expected ${value} to match ${pattern}`);
      }
    },
    toThrow: (expectedError) => {
      let threw = false;
      try {
        value();
      } catch (error) {
        threw = true;
        if (expectedError && !(error instanceof expectedError)) {
          throw new Error(`Expected ${expectedError.name}, got ${error.constructor.name}`);
        }
      }
      if (!threw) {
        throw new Error('Expected function to throw');
      }
    }
  };
}

function beforeEach(fn) {
  // Reset mocks
  Object.assign(fs, {
    chmodSync: jest.fn(),
    ...originalFs,
  });

  Object.assign(fsPromises, {
    mkdir: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('{}'),
    writeFile: jest.fn().mockResolvedValue(),
    stat: jest.fn().mockResolvedValue({ isDirectory: () => true }),
    ...originalFsPromises,
  });

  Object.assign(os, {
    homedir: jest.fn(() => '/home/testuser'),
    ...originalOs,
  });

  Object.assign(path, {
    join: jest.fn((...args) => args.join('/')),
    ...originalPath,
  });

  Object.assign(crypto, {
    randomBytes: jest.fn(() => Buffer.from('a'.repeat(64))),
    ...originalCrypto,
  });

  Object.assign(readline, {
    createInterface: jest.fn(() => ({
      question: jest.fn((question, callback) => callback('test-input')),
      close: jest.fn(),
    })),
    ...originalReadline,
  });

  // Mock console methods
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();

  // Mock process
  process.exit = jest.fn();
  process.env = { ...process.env };

  fn();
}

function afterEach() {
  jest.clearAllMocks();
}

function describe(name, fn) {
  console.log(`\n📋 ${name}`);
  fn();
}

function jest() {
  return {
    fn: () => jest.fn(),
    clearAllMocks: () => {
      // Clear all mock call history
    },
    requireActual: (module) => {
      switch (module) {
        case 'fs': return originalFs;
        case 'fs/promises': return originalFsPromises;
        case 'os': return originalOs;
        case 'path': return originalPath;
        case 'crypto': return originalCrypto;
        case 'readline': return originalReadline;
        default: return {};
      }
    }
  };
}

global.jest = jest();

// Import CLI functions directly
const {
  getConfigDir,
  parseArgs,
  generateMCPToken,
  pathExists,
  ensureConfigDir,
  saveConfig,
  loadConfigFromFile,
  loadConfig,
  promptHidden,
  cmdInit,
  ensureEnvFromConfig,
  cmdShowConfig,
  printHelp,
} = require('./src/cli.js');

// Test suites
describe('CLI Core Functions', () => {
  test('getConfigDir should return correct paths for different platforms', () => {
    const originalPlatform = process.platform;

    // Test Windows
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';
    expect(getConfigDir()).toBe('C:\\Users\\Test\\AppData\\Roaming/cursor-agent-mcp');

    // Test macOS
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    expect(getConfigDir()).toBe('/home/testuser/Library/Application Support/cursor-agent-mcp');

    // Test Linux
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(getConfigDir()).toBe('/home/testuser/.config/cursor-agent-mcp');

    // Restore original platform
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  test('parseArgs should handle various flag formats', () => {
    expect(parseArgs(['--api-key', 'test-key', '--port', '3000'])).toEqual({
      'api-key': 'test-key',
      'port': '3000',
    });

    expect(parseArgs(['--api-key=test-key', '--verbose'])).toEqual({
      'api-key': 'test-key',
      'verbose': true,
    });

    expect(parseArgs(['--flag-without-value'])).toEqual({
      'flag-without-value': true,
    });

    expect(parseArgs([])).toEqual({});
  });

  test('generateMCPToken should create valid tokens', () => {
    const token = generateMCPToken();
    expect(token).toMatch(/^mcp_[a-f0-9]{64}$/);
    expect(token.length).toBe(67);
  });
});

describe('File System Operations', () => {
  beforeEach(() => {
    // Mock successful file operations
    fsPromises.mkdir.mockResolvedValue();
    fsPromises.readFile.mockResolvedValue('{}');
    fsPromises.writeFile.mockResolvedValue();
    fsPromises.stat.mockResolvedValue({ isDirectory: () => true });
  });

  test('ensureConfigDir should create directory when it does not exist', async () => {
    fsPromises.stat.mockRejectedValue(new Error('ENOENT'));

    await ensureConfigDir();

    expect(fsPromises.mkdir).toHaveBeenCalledWith('/home/testuser/.config/cursor-agent-mcp', { recursive: true });
  });

  test('saveConfig should save configuration correctly', async () => {
    const config = {
      apiKey: 'test-api-key',
      apiUrl: 'https://test.cursor.com',
      mcpToken: 'test-token',
    };

    await new Promise((resolve, reject) => {
      saveConfig(config, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    expect(fsPromises.writeFile).toHaveBeenCalled();
  });

  test('loadConfigFromFile should parse valid JSON', async () => {
    const config = {
      CURSOR_API_KEY: 'test-key',
      CURSOR_API_URL: 'https://test.cursor.com',
    };
    fsPromises.readFile.mockResolvedValue(JSON.stringify(config));

    const result = await loadConfigFromFile();
    expect(result).toEqual(config);
  });

  test('loadConfig should prioritize environment variables', async () => {
    process.env.CURSOR_API_KEY = 'env-key';
    process.env.CURSOR_API_URL = 'https://env.cursor.com';

    const result = await loadConfig();
    expect(result.CURSOR_API_KEY).toBe('env-key');
    expect(result.CURSOR_API_URL).toBe('https://env.cursor.com');
  });
});

describe('Command Functions', () => {
  beforeEach(() => {
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    process.exit = jest.fn();
  });

  test('cmdInit should handle API key validation', async () => {
    // Mock readline for user input
    const mockRl = {
      question: jest.fn((question, callback) => callback('short')),
      close: jest.fn(),
    };
    readline.createInterface.mockReturnValue(mockRl);

    await cmdInit({});

    expect(console.error).toHaveBeenCalledWith('Invalid API key.');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('ensureEnvFromConfig should set environment variables', async () => {
    const config = {
      CURSOR_API_KEY: 'test-key',
      CURSOR_API_URL: 'https://test.cursor.com',
      MCP_SERVER_TOKEN: 'test-token',
    };
    fsPromises.readFile.mockResolvedValue(JSON.stringify(config));

    await ensureEnvFromConfig();

    expect(process.env.CURSOR_API_KEY).toBe('test-key');
    expect(process.env.CURSOR_API_URL).toBe('https://test.cursor.com');
    expect(process.env.MCP_SERVER_TOKEN).toBe('test-token');
  });

  test('cmdShowConfig should display configuration', async () => {
    const config = {
      CURSOR_API_KEY: 'very-long-api-key-that-should-be-masked',
      CURSOR_API_URL: 'https://test.cursor.com',
      MCP_SERVER_TOKEN: 'very-long-token-that-should-be-masked',
    };
    fsPromises.readFile.mockResolvedValue(JSON.stringify(config));

    await cmdShowConfig();

    expect(console.log).toHaveBeenCalledWith('📋 Current Configuration:');
    expect(console.log).toHaveBeenCalledWith('🔑 API Key: ***masked');
  });

  test('printHelp should display help information', () => {
    printHelp();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('cursor-agent-mcp <command> [options]'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('init'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('stdio'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('http'));
  });
});

describe('Input Validation', () => {
  test('promptHidden should handle user input', async () => {
    const mockRl = {
      question: jest.fn((question, callback) => callback('user-secret')),
      close: jest.fn(),
    };
    readline.createInterface.mockReturnValue(mockRl);

    const result = await promptHidden('Enter secret: ');

    expect(result).toBe('user-secret');
    expect(mockRl.question).toHaveBeenCalledWith('Enter secret: ', expect.any(Function));
  });

  test('API key validation should accept valid keys', async () => {
    const validKeys = [
      'cursor_sk_test_1234567890abcdefghijklmnopqrstuvwxyz',
      'cursor_sk_live_1234567890abcdefghijklmnopqrstuvwxyz',
      'test-key-123',
      'a'.repeat(100),
    ];

    for (const key of validKeys) {
      const mockRl = {
        question: jest.fn((question, callback) => callback(key)),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      // Mock successful file operations
      fsPromises.writeFile.mockResolvedValue();

      await cmdInit({});

      expect(process.exit).not.toHaveBeenCalled();
    }
  });

  test('API key validation should reject invalid keys', async () => {
    const invalidKeys = ['short', '', '   ', 'a'.repeat(7)];

    for (const key of invalidKeys) {
      const mockRl = {
        question: jest.fn((question, callback) => callback(key)),
        close: jest.fn(),
      };
      readline.createInterface.mockReturnValue(mockRl);

      await cmdInit({});

      expect(console.error).toHaveBeenCalledWith('Invalid API key.');
      expect(process.exit).toHaveBeenCalledWith(1);
    }
  });
});

// Test summary
console.log(`\n📊 Test Results: ${testsPassed}/${testsRun} passed, ${testsFailed} failed`);

if (testsFailed === 0) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('💥 Some tests failed!');
  process.exit(1);
}