/**
 * Global Jest Teardown
 *
 * Runs once after all tests complete
 */

export default async function globalTeardown() {
  // Clean up global test environment
  console.log('🧹 Cleaning up global test environment...');

  // You can add global cleanup logic here:
  // - Stop test databases
  // - Shut down test servers
  // - Clean up test files
  // - Reset external services

  console.log('✅ Global test environment cleaned up');
}