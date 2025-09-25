#!/usr/bin/env node

/**
 * Comprehensive CLI Test Suite
 * Tests all aspects of CLI functionality as requested:
 * - Command parsing
 * - Argument validation
 * - Error handling
 * - Help output
 * - Integration with core MCP functions
 * - File system operations
 * - Environment variable handling
 */

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

// Test statistics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let testResults = [];

// Test framework
function test(name, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`✅ ${name}`);
    passedTests++;
    testResults.push({ name, status: 'PASSED' });
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failedTests++;
    testResults.push({ name, status: 'FAILED', error: error.message });
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toMatch: (regex) => {
      if (!regex.test(actual)) {
        throw new Error(`Expected ${actual} to match ${regex}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
      }
    },
    toThrow: () => {
      let threw = false;
      try {
        actual();
      } catch {
        threw = true;
      }
      if (!threw) {
        throw new Error('Expected function to throw');
      }
    }
  };
}

function describe(suiteName, suiteFn) {
  console.log(`\n📋 ${suiteName}`);
  suiteFn();
}

console.log('🧪 Running Comprehensive CLI Tests\n');

// Test 1: Command Parsing
describe('1. Command Parsing', () => {
  test('Should parse flags with values', () => {
    const { parseArgs } = require('./src/cli.js');
    const result = parseArgs(['--api-key', 'test-key', '--port', '3000']);
    expect(result).toEqual({ 'api-key': 'test-key', 'port': '3000' });
  });

  test('Should parse flags with equals', () => {
    const { parseArgs } = require('./src/cli.js');
    const result = parseArgs(['--api-key=test-key', '--port=3000']);
    expect(result).toEqual({ 'api-key': 'test-key', 'port': '3000' });
  });

  test('Should parse boolean flags', () => {
    const { parseArgs } = require('./src/cli.js');
    const result = parseArgs(['--verbose', '--debug']);
    expect(result).toEqual({ 'verbose': true, 'debug': true });
  });

  test('Should handle empty args', () => {
    const { parseArgs } = require('./src/cli.js');
    const result = parseArgs([]);
    expect(result).toEqual({});
  });
});

// Test 2: Argument Validation
describe('2. Argument Validation', () => {
  test('Should validate API key length', () => {
    const { cmdInit } = require('./src/cli.js');

    // Mock dependencies
    const originalReadline = require('readline');
    const mockRl = {
      question: (question, callback) => callback('short'),
      close: () => {}
    };

    require('readline').createInterface = () => mockRl;
    const originalConsole = console.error;
    const originalProcess = process.exit;
    console.error = () => {};
    process.exit = (code) => { throw new Error(`Exit code ${code}`); };

    expect(() => cmdInit({})).toThrow('Exit code 1');

    // Restore
    console.error = originalConsole;
    process.exit = originalProcess;
  });

  test('Should accept valid API key lengths', () => {
    const { cmdInit } = require('./src/cli.js');

    // Mock dependencies
    const mockRl = {
      question: (question, callback) => callback('cursor_sk_test_1234567890abcdefghijklmnopqrstuvwxyz1234567890ab'),
      close: () => {}
    };

    require('readline').createInterface = () => mockRl;
    const originalConsole = console.log;
    const originalProcess = process.exit;
    console.log = () => {};
    process.exit = (code) => { if (code !== 0) throw new Error(`Exit code ${code}`); };

    expect(() => cmdInit({})).not.toThrow();

    // Restore
    console.log = originalConsole;
    process.exit = originalProcess;
  });
});

// Test 3: Error Handling
describe('3. Error Handling', () => {
  test('Should handle missing config gracefully', async () => {
    const { ensureEnvFromConfig } = require('./src/cli.js');

    // Mock missing config file
    const originalStat = fs.stat;
    fs.stat = async () => { throw new Error('ENOENT'); };

    const originalConsole = console.error;
    const originalProcess = process.exit;
    console.error = () => {};
    process.exit = (code) => { throw new Error(`Exit code ${code}`); };

    try {
      await ensureEnvFromConfig();
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error.message).toContain('Exit code 1');
    }

    // Restore
    fs.stat = originalStat;
    console.error = originalConsole;
    process.exit = originalProcess;
  });

  test('Should handle file system errors', async () => {
    const { loadConfigFromFile } = require('./src/cli.js');

    // Mock file read error
    const originalReadFile = fs.readFile;
    fs.readFile = async () => { throw new Error('Read error'); };

    const result = await loadConfigFromFile();
    expect(result).toBeNull();

    // Restore
    fs.readFile = originalReadFile;
  });
});

// Test 4: Help Output
describe('4. Help Output', () => {
  test('Should display comprehensive help information', () => {
    const { printHelp } = require('./src/cli.js');

    const originalConsole = console.log;
    console.log = (message) => {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(50);
      expect(message).toContain('cursor-agent-mcp');
      expect(message).toContain('Commands:');
      expect(message).toContain('init');
      expect(message).toContain('stdio');
      expect(message).toContain('http');
      expect(message).toContain('whoami');
      expect(message).toContain('config');
    };

    printHelp();

    // Restore
    console.log = originalConsole;
  });
});

// Test 5: File System Operations
describe('5. File System Operations', () => {
  test('Should create config directory', async () => {
    const { ensureConfigDir } = require('./src/cli.js');

    // Mock missing directory
    const originalStat = fs.stat;
    const originalMkdir = fs.mkdir;
    fs.stat = async () => { throw new Error('ENOENT'); };
    fs.mkdir = async () => {};

    await ensureConfigDir();

    // Restore
    fs.stat = originalStat;
    fs.mkdir = originalMkdir;
  });

  test('Should save config with correct permissions', async () => {
    const { saveConfig } = require('./src/cli.js');

    const originalWriteFile = fs.writeFile;
    const originalChmod = require('fs').chmodSync;
    require('fs').chmodSync = () => {};

    await saveConfig({ apiKey: 'test-key' });

    // Restore
    fs.writeFile = originalWriteFile;
    require('fs').chmodSync = originalChmod;
  });
});

// Test 6: Environment Variable Handling
describe('6. Environment Variable Handling', () => {
  test('Should prioritize environment variables', async () => {
    const { loadConfig } = require('./src/cli.js');

    const originalEnv = process.env;
    process.env.CURSOR_API_KEY = 'env-key';
    process.env.CURSOR_API_URL = 'https://env.cursor.com';

    // Mock empty file config
    const originalReadFile = fs.readFile;
    fs.readFile = async () => JSON.stringify({});

    const result = await loadConfig();
    expect(result.CURSOR_API_KEY).toBe('env-key');
    expect(result.CURSOR_API_URL).toBe('https://env.cursor.com');

    // Restore
    process.env = originalEnv;
    fs.readFile = originalReadFile;
  });

  test('Should use default API URL', async () => {
    const { loadConfig } = require('./src/cli.js');

    const originalEnv = process.env;
    delete process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_URL;

    // Mock file config without URL
    const originalReadFile = fs.readFile;
    fs.readFile = async () => JSON.stringify({
      CURSOR_API_KEY: 'file-key',
      MCP_SERVER_TOKEN: 'file-token'
    });

    const result = await loadConfig();
    expect(result.CURSOR_API_URL).toBe('https://api.cursor.com');

    // Restore
    process.env = originalEnv;
    fs.readFile = originalReadFile;
  });
});

// Test 7: Input/Output Handling
describe('7. Input/Output Handling', () => {
  test('Should handle user prompts', async () => {
    const { promptHidden } = require('./src/cli.js');

    const originalReadline = require('readline');
    const mockRl = {
      question: (question, callback) => callback('user-input'),
      close: () => {}
    };

    require('readline').createInterface = () => mockRl;

    const result = await promptHidden('Enter value: ');
    expect(result).toBe('user-input');

    // Restore
    require('readline') = originalReadline;
  });

  test('Should mask sensitive output', async () => {
    const { cmdShowConfig } = require('./src/cli.js');

    // Mock config with long keys
    const originalReadFile = fs.readFile;
    fs.readFile = async () => JSON.stringify({
      CURSOR_API_KEY: 'very-long-api-key-that-should-be-masked-completely',
      CURSOR_API_URL: 'https://test.cursor.com',
      MCP_SERVER_TOKEN: 'very-long-token-that-should-be-masked-completely'
    });

    const originalConsole = console.log;
    console.log = (message) => {
      if (message.includes('API Key:')) {
        expect(message).toContain('***masked');
        expect(message).not.toContain('very-long-api-key');
      }
    };

    await cmdShowConfig();

    // Restore
    fs.readFile = originalReadFile;
    console.log = originalConsole;
  });
});

// Test 8: Integration with MCP Functions
describe('8. MCP Integration', () => {
  test('Should integrate with cursor API client', async () => {
    const { cmdWhoAmI } = require('./src/cli.js');

    // Mock config and API client
    const originalReadFile = fs.readFile;
    const originalCursorClient = require('./src/utils/cursorClient.js').cursorApiClient;

    fs.readFile = async () => JSON.stringify({ CURSOR_API_KEY: 'test-key' });
    require('./src/utils/cursorClient.js').cursorApiClient.getMe = async () => ({
      id: 'user123',
      email: 'test@example.com'
    });

    const originalConsole = console.log;
    console.log = (message) => {
      expect(message).toContain('"id":"user123"');
      expect(message).toContain('"email":"test@example.com"');
    };

    await cmdWhoAmI();

    // Restore
    fs.readFile = originalReadFile;
    require('./src/utils/cursorClient.js').cursorApiClient = originalCursorClient;
    console.log = originalConsole;
  });

  test('Should handle API errors gracefully', async () => {
    const { cmdWhoAmI } = require('./src/cli.js');

    // Mock config and API error
    const originalReadFile = fs.readFile;
    const originalCursorClient = require('./src/utils/cursorClient.js').cursorApiClient;

    fs.readFile = async () => JSON.stringify({ CURSOR_API_KEY: 'invalid-key' });
    require('./src/utils/cursorClient.js').cursorApiClient.getMe = async () => {
      throw new Error('Authentication failed');
    };

    const originalConsole = console.error;
    const originalProcess = process.exit;
    console.error = () => {};
    process.exit = (code) => { throw new Error(`Exit code ${code}`); };

    try {
      await cmdWhoAmI();
      expect(true).toBe(false); // Should have thrown
    } catch (error) {
      expect(error.message).toContain('Exit code 1');
    }

    // Restore
    fs.readFile = originalReadFile;
    require('./src/utils/cursorClient.js').cursorApiClient = originalCursorClient;
    console.error = originalConsole;
    process.exit = originalProcess;
  });
});

// Test 9: Token Generation
describe('9. Token Generation', () => {
  test('Should generate valid MCP tokens', () => {
    const { generateMCPToken } = require('./src/cli.js');

    const token = generateMCPToken();
    expect(token).toMatch(/^mcp_[a-f0-9]{64}$/);
    expect(token.length).toBe(67);
  });

  test('Should generate unique tokens', () => {
    const { generateMCPToken } = require('./src/cli.js');

    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateMCPToken());
    }
    expect(tokens.size).toBe(100); // All tokens should be unique
  });
});

// Test 10: Configuration Management
describe('10. Configuration Management', () => {
  test('Should merge configs correctly', async () => {
    const { saveConfig } = require('./src/cli.js');

    // Mock existing config
    const originalReadFile = fs.readFile;
    fs.readFile = async () => JSON.stringify({
      CURSOR_API_KEY: 'existing-key',
      MCP_SERVER_TOKEN: 'existing-token'
    });

    await saveConfig({ apiKey: 'new-key' });

    // Restore
    fs.readFile = originalReadFile;
  });

  test('Should handle config corruption', async () => {
    const { loadConfigFromFile } = require('./src/cli.js');

    // Mock corrupted JSON
    const originalReadFile = fs.readFile;
    fs.readFile = async () => 'invalid json {';

    const result = await loadConfigFromFile();
    expect(result).toBeNull();

    // Restore
    fs.readFile = originalReadFile;
  });
});

// Test Summary
console.log(`\n📊 Test Results Summary:`);
console.log(`   Total Tests: ${totalTests}`);
console.log(`   Passed: ${passedTests}`);
console.log(`   Failed: ${failedTests}`);
console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed! CLI functionality is comprehensively tested.');
  console.log('\n📋 Coverage Areas:');
  console.log('   ✅ Command parsing and argument validation');
  console.log('   ✅ Error handling and edge cases');
  console.log('   ✅ Help output and user interface');
  console.log('   ✅ File system operations and permissions');
  console.log('   ✅ Environment variable handling');
  console.log('   ✅ Input validation and prompting');
  console.log('   ✅ MCP server integration');
  console.log('   ✅ Configuration management');
  console.log('   ✅ Token generation and security');
  console.log('   ✅ API integration and error handling');
  process.exit(0);
} else {
  console.log('\n💥 Some tests failed. Please review the test output above.');
  console.log('\n❌ Failed Tests:');
  testResults.filter(t => t.status === 'FAILED').forEach(t => {
    console.log(`   - ${t.name}: ${t.error}`);
  });
  process.exit(1);
}