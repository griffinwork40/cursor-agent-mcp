/**
 * Simple Unit Test Example
 *
 * Demonstrates basic Jest functionality and test structure
 */

import { mockData } from '../utils/test-helpers.js';

describe('Basic Test Examples', () => {
  test('should create mock data correctly', () => {
    const agent = mockData.generateAgent({
      name: 'Test Agent',
      status: 'active'
    });

    expect(agent).toHaveProperty('id');
    expect(agent).toHaveProperty('name', 'Test Agent');
    expect(agent).toHaveProperty('status', 'active');
    expect(agent).toHaveProperty('createdAt');
  });

  test('should generate different IDs for different objects', async () => {
    const agent1 = mockData.generateAgent();
    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));
    const agent2 = mockData.generateAgent();

    expect(agent1.id).not.toBe(agent2.id);
  });

  test('should handle user data generation', () => {
    const user = mockData.generateUser({
      email: 'test@example.com',
      name: 'Test User'
    });

    expect(user).toHaveProperty('email', 'test@example.com');
    expect(user).toHaveProperty('name', 'Test User');
    expect(user).toHaveProperty('apiKey');
  });

  test('should handle repository data generation', () => {
    const repo = mockData.generateRepository({
      name: 'test-repo',
      url: 'https://github.com/test/repo'
    });

    expect(repo).toHaveProperty('name', 'test-repo');
    expect(repo).toHaveProperty('url', 'https://github.com/test/repo');
  });
});