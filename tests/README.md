# Testing Documentation

This document provides comprehensive information about the testing setup for the Cursor MCP Server project.

## Overview

The testing infrastructure is built with Jest and includes:

- **Unit Tests**: Test individual functions and modules in isolation
- **Integration Tests**: Test interactions between modules and external services
- **End-to-End Tests**: Test complete workflows (planned for future implementation)
- **Performance Tests**: Load testing and performance benchmarking
- **Automated CI/CD**: GitHub Actions workflow for continuous testing

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── utils/
│   │   └── cursorClient.test.js
│   └── ...
├── integration/             # Integration tests for module interactions
│   ├── mcp-server.test.js
│   └── ...
├── e2e/                     # End-to-end tests (placeholder)
├── performance/             # Performance and load tests
│   └── load-test.yml
├── utils/                   # Shared test utilities
│   └── test-helpers.js
├── setup.js                 # Global test setup
├── global-setup.js          # One-time global setup
├── global-teardown.js       # One-time global cleanup
├── mocks/                   # Mock data and fixtures
└── fixtures/                # Test data fixtures
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### Smoke Tests
```bash
npm run test:smoke
```

## Coverage Thresholds

The project enforces strict coverage thresholds:

- **Statements**: 80%
- **Branches**: 70%
- **Functions**: 80%
- **Lines**: 80%

More lenient thresholds are applied to utility modules (75%/65%/75%/75%).

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions and modules in isolation. Use mocking to isolate dependencies.

```javascript
import { createCursorApiClient } from '../../src/utils/cursorClient.js';
import { mockHttp, mockData } from '../utils/test-helpers.js';

describe('MyModule', () => {
  let mockData;

  beforeEach(() => {
    mockData = mockData.generateMockData();
    mockHttp.cleanAll();
  });

  test('should handle success case', async () => {
    mockHttp.mockApiSuccess('/api/endpoint', 'get', mockData);

    const result = await myFunction();

    expect(result).toEqual(mockData);
  });
});
```

### Integration Tests

Integration tests verify that different modules work together correctly.

```javascript
import supertest from 'supertest';
import { createServer } from 'http';

describe('API Integration', () => {
  let server;
  let request;

  beforeEach(() => {
    server = createServer(app);
    request = supertest(server);
  });

  test('should handle complete workflow', async () => {
    const response = await request
      .post('/api/endpoint')
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result');
  });
});
```

## Test Utilities

### HTTP Mocking

```javascript
import { mockHttp } from '../utils/test-helpers.js';

// Mock successful response
mockHttp.mockApiSuccess('/api/users', 'get', { users: [] });

// Mock error response
mockHttp.mockApiError('/api/users', 'post', 'Bad Request', 400);

// Mock timeout
mockHttp.mockTimeout('/api/users', 'get', 5000);
```

### Mock Data Generation

```javascript
import { mockData } from '../utils/test-helpers.js';

const agent = mockData.generateAgent({
  name: 'Custom Agent',
  status: 'active'
});

const user = mockData.generateUser({
  email: 'test@example.com'
});
```

### Async Helpers

```javascript
import { asyncHelpers } from '../utils/test-helpers.js';

// Wait for condition
await asyncHelpers.waitFor(
  () => someCondition(),
  5000, // timeout
  100   // interval
);

// Simple delay
await asyncHelpers.wait(1000);
```

## CI/CD Pipeline

The GitHub Actions workflow runs on every push and pull request:

### Test Matrix
- **OS**: Ubuntu, Windows, macOS
- **Node.js**: 18.x, 20.x, 22.x

### Pipeline Stages
1. **Test**: Unit tests with coverage on multiple OS/Node versions
2. **Integration Test**: Integration tests with mocked external services
3. **Performance Test**: Load testing (on PR and main branch)
4. **Security Scan**: Vulnerability scanning with Snyk
5. **Build**: Package building and smoke tests
6. **Publish**: NPM publishing (main branch only)
7. **Deploy Docs**: Documentation deployment (main branch only)

### Coverage Reporting
- Coverage reports uploaded to Codecov
- JUnit XML reports generated for CI integration
- HTML coverage reports available in artifacts

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Clean up mocks and state after each test
- Use beforeEach/afterEach for setup/teardown

### 2. Descriptive Test Names
```javascript
// Good
test('should create agent with valid data', async () => {
  // ...
});

// Bad
test('should work', async () => {
  // ...
});
```

### 3. Mock External Dependencies
- Always mock external API calls
- Mock file system operations
- Mock database connections

### 4. Test Error Cases
- Test both success and failure scenarios
- Verify error messages and status codes
- Test edge cases and boundary conditions

### 5. Use Factories for Test Data
- Create factory functions for complex test data
- Use the mockData utilities for common entities
- Keep test data simple but realistic

## Debugging Tests

### Common Issues

1. **Mock Cleanup**: Always call `mockHttp.cleanAll()` in afterEach
2. **Async Operations**: Ensure all async operations are properly awaited
3. **Environment Variables**: Set required env vars in test setup
4. **Module Caching**: Use `jest.resetModules()` for module-level state

### Debug Mode
```bash
# Run tests with debug output
DEBUG=test:* npm test

# Run single test file
npm test cursorClient.test.js

# Run specific test
npm test -- -t "should create agent"
```

## Performance Testing

Performance tests use Artillery.io to simulate load and measure response times.

### Running Performance Tests
```bash
npm install -g artillery@2.0.0-38
artillery run tests/performance/load-test.yml
```

### Performance Benchmarks
- **Response Time**: < 200ms for 95th percentile
- **Throughput**: Handle 50+ concurrent requests
- **Error Rate**: < 1% under normal load

## Contributing

When adding new features:

1. Write unit tests for new functions
2. Add integration tests for new endpoints
3. Update coverage thresholds if needed
4. Ensure all tests pass in CI

When modifying existing code:

1. Run existing tests to ensure no regressions
2. Update tests if behavior changes
3. Maintain or improve coverage percentages

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Nock Documentation](https://github.com/nock/nock)
- [Sinon Documentation](https://sinonjs.org/)
- [Artillery Documentation](https://artillery.io/docs)