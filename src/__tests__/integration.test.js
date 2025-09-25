// Simple integration test for auto-create PR functionality
import { describe, test, expect } from '@jest/globals';

describe('Auto-create PR functionality', () => {
  test('should have gitUtils module available', async () => {
    const { hasCodeChanges } = await import('../utils/gitUtils.js');
    expect(typeof hasCodeChanges).toBe('function');
  });

  test('should have createTools function available', async () => {
    const { createTools } = await import('../tools/index.js');
    expect(typeof createTools).toBe('function');
  });

  test('should handle GitHub URLs in hasCodeChanges', async () => {
    const { hasCodeChanges } = await import('../utils/gitUtils.js');
    const result = await hasCodeChanges('https://github.com/user/repo');
    expect(typeof result).toBe('boolean');
  });
});