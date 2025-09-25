module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/cli.js',
    'src/**/*.js',
    '!src/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: []
};