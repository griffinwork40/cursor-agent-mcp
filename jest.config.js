/**
 * Jest Configuration
 *
 * Comprehensive Jest setup with coverage thresholds and testing best practices
 */

export default {
  // Use ES modules since the project uses "type": "module" in package.json
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },

  // Test environment
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/?(*.)(test|spec).{js,jsx,ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/.git/'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.js', // Entry points often just re-export
    '!src/cli.js', // CLI files are harder to test
    '!**/node_modules/**'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Coverage thresholds - strict but achievable
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    // More lenient thresholds for utilities that might have edge cases
    './src/utils/': {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75
    }
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1'
  },

  // Transform configuration for ES modules
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['@babel/preset-env'] }]
  },

  // Timeout for tests (useful for async operations)
  testTimeout: 10000,

  // Reporter configuration for better output
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      suiteName: 'Cursor MCP Server Tests'
    }]
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Reset modules between tests
  resetModules: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Error handling
  bail: false, // Don't stop on first failure in CI
  verbose: true, // More detailed output

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js'
};