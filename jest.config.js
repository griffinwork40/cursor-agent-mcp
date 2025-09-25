export default {
  testEnvironment: 'node',
  testMatch: [
    '**/src/__tests__/**/*.test.js',
    '**/src/__tests__/**/*.integration.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/__tests__/**',
    '!src/cli.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially to avoid port conflicts
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(supertest|axios-mock-adapter)/)'
  ]
};