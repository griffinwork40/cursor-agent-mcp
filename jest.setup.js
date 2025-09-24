// Jest setup file to reduce console noise during tests
global.console = {
  ...console,
  // Suppress console.error during tests to reduce noise
  error: () => {},
};
