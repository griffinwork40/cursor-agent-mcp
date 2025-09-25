import { jest, describe, test, expect } from '@jest/globals';

// Simple test for CLI module without complex mocking
describe('CLI Module Basic Test', () => {
  test('should be able to import CLI module', async () => {
    const cliModule = await import('../cli.js');
    expect(cliModule).toBeDefined();
    expect(typeof cliModule.getConfigDir).toBe('function');
    expect(typeof cliModule.generateMCPToken).toBe('function');
    expect(typeof cliModule.parseArgs).toBe('function');
    expect(typeof cliModule.saveConfig).toBe('function');
    expect(typeof cliModule.loadConfig).toBe('function');
  });

  test('should generate MCP token with correct prefix', async () => {
    const cliModule = await import('../cli.js');
    const token = cliModule.generateMCPToken();
    expect(token).toMatch(/^mcp_[a-f0-9]{64}$/);
  });

  test('should parse command line arguments correctly', async () => {
    const cliModule = await import('../cli.js');
    
    // Test parsing flags with values
    const args1 = cliModule.parseArgs(['--api-key', 'test-key', '--api-url', 'https://test.com']);
    expect(args1).toEqual({
      'api-key': 'test-key',
      'api-url': 'https://test.com'
    });

    // Test parsing boolean flags
    const args2 = cliModule.parseArgs(['--help', '--verbose']);
    expect(args2).toEqual({
      help: true,
      verbose: true
    });

    // Test parsing flags with equals
    const args3 = cliModule.parseArgs(['--api-key=test-key']);
    expect(args3).toEqual({
      'api-key': 'test-key'
    });
  });

  test('should return correct config directory for current platform', async () => {
    const cliModule = await import('../cli.js');
    const configDir = cliModule.getConfigDir();
    
    // Should return a valid path
    expect(configDir).toBeDefined();
    expect(typeof configDir).toBe('string');
    expect(configDir.length).toBeGreaterThan(0);
    
    // Should contain the expected directory name
    expect(configDir).toContain('cursor-agent-mcp');
  });
});
