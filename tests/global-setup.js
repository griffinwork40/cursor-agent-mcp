/**
 * Global Jest Setup
 *
 * Runs once before all tests start
 */

export default async function globalSetup() {
  // Set up global test environment
  process.env.JEST_GLOBAL_SETUP = 'true';

  // Log test environment info
  console.log('🧪 Setting up global test environment...');

  // You can add global setup logic here:
  // - Start test databases
  // - Set up test servers
  // - Initialize test data
  // - Configure external services

  console.log('✅ Global test environment ready');
}