# MCP Protocol Integration Test Suite

This comprehensive test suite provides end-to-end testing for the complete MCP (Model Context Protocol) flow, including HTTP endpoints, SSE connections, tool execution chains, error propagation, and response formatting.

## Test Structure

### Test Files

1. **`integration.test.js`** - Core HTTP endpoint and MCP protocol testing
2. **`sse.integration.test.js`** - Server-Sent Events connection and message handling
3. **`tool-execution.integration.test.js`** - Complete tool execution chains and edge cases
4. **`setup.js`** - Test configuration and setup utilities

### Test Categories

#### HTTP Endpoints Testing
- Health check endpoints (`/health`)
- Discovery endpoints (`/`, OAuth discovery)
- MCP protocol endpoints (`/mcp`)
- OAuth flow endpoints (`/oauth/authorize`, `/oauth/token`)
- Connection setup endpoints (`/connect`)

#### MCP Protocol Testing
- Tool listing (`tools/list`)
- Tool execution (`tools/call`)
- JSON-RPC 2.0 compliance
- Request/response format validation

#### SSE (Server-Sent Events) Testing
- Connection establishment
- Message handling via POST
- Connection persistence
- Concurrent connections
- Error recovery

#### Tool Execution Chain Testing
- Complete agent lifecycle (create → get → followup → delete)
- Complex tool interactions
- Error propagation through chains
- Edge cases and boundary conditions

## Running Tests

### Prerequisites

```bash
# Install test dependencies
npm install --save-dev supertest axios-mock-adapter
```

### Test Commands

```bash
# Run all tests
npm run test:all

# Run specific test categories
npm run test:integration    # HTTP endpoints and MCP protocol
npm run test:sse           # SSE connections
npm run test:tool-execution # Tool execution chains

# Run with coverage
npm run test:coverage

# Run individual test files
npx jest src/__tests__/integration.test.js
npx jest src/__tests__/sse.integration.test.js
npx jest src/__tests__/tool-execution.integration.test.js
```

## Test Features

### Comprehensive Mocking
- **External API Mocking**: All Cursor API calls are mocked using `axios-mock-adapter`
- **Network Error Simulation**: Tests for network timeouts, connection failures
- **API Error Simulation**: Tests for various HTTP error codes (400, 401, 429, 500, etc.)

### Error Testing
- **Validation Errors**: Invalid input data, missing required fields
- **API Errors**: Server errors, rate limiting, authentication failures
- **Network Errors**: Connection timeouts, unreachable endpoints
- **Protocol Errors**: Malformed requests, unknown methods

### Edge Cases
- **Large Payloads**: Very large prompt text, oversized requests
- **Special Characters**: Unicode characters, emojis, special formatting
- **Empty Data**: Empty arrays, objects, strings
- **Malformed Data**: Invalid JSON, corrupted data structures

### Concurrent Testing
- **Multiple Connections**: Concurrent SSE connections
- **Parallel Requests**: Multiple simultaneous MCP requests
- **Resource Competition**: Testing under load conditions

## Test Scenarios Covered

### Successful Operations
- ✅ Tool listing and discovery
- ✅ Agent creation with various parameters
- ✅ Agent status retrieval and updates
- ✅ Followup instruction addition
- ✅ Agent conversation history retrieval
- ✅ Agent deletion and cleanup
- ✅ Model and repository listing
- ✅ OAuth flow completion
- ✅ Token-based authentication

### Error Conditions
- ❌ Invalid API keys and authentication
- ❌ Malformed request payloads
- ❌ Missing required parameters
- ❌ Rate limiting and quota exceeded
- ❌ Network connectivity issues
- ❌ Server internal errors
- ❌ Resource not found errors
- ❌ Permission and authorization failures

### Edge Cases
- 🔄 Very large request payloads
- 🔄 Special characters in text
- 🔄 Empty collections and data structures
- 🔄 Concurrent user operations
- 🔄 Session timeout handling
- 🔄 Connection interruption recovery

## Mock Data Structure

The tests use realistic mock data that mirrors the actual API responses:

```javascript
// Example mock agent data
const mockAgents = [
  {
    id: 'agent_123',
    name: 'Test Agent 1',
    status: 'FINISHED',
    createdAt: '2024-01-01T00:00:00Z',
    source: { repository: 'https://github.com/test/repo1' },
    target: { url: 'https://github.com/test/repo1/pull/1', branchName: 'feature/test' },
    summary: 'Completed successfully'
  }
];

// Example tool schema
const toolSchema = {
  name: 'createAgent',
  description: 'Create a new background agent to work on a repository',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { /* prompt schema */ },
      model: { /* model schema */ },
      source: { /* source schema */ },
      target: { /* target schema */ },
      webhook: { /* webhook schema */ }
    },
    required: ['prompt', 'source', 'model']
  }
};
```

## Response Format Validation

All tests validate proper MCP JSON-RPC 2.0 response format:

### Success Response
```json
{
  "jsonrpc": "2.0",
  "id": "test-123",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Successfully created agent!\n📋 ID: agent_123\n📊 Status: CREATING"
      }
    ]
  }
}
```

### Error Response
```json
{
  "jsonrpc": "2.0",
  "id": "test-456",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "API Error (400): Invalid repository URL [INVALID_REPOSITORY]"
      }
    ],
    "isError": true
  }
}
```

## Configuration

### Environment Variables
Tests use the following environment variables (set in `setup.js`):

```javascript
process.env.NODE_ENV = 'test';
process.env.CURSOR_API_KEY = 'mock_test_api_key';
process.env.CURSOR_API_URL = 'https://api.cursor.com';
process.env.TOKEN_SECRET = 'test_token_secret_for_jwt_signing';
process.env.TOKEN_TTL_DAYS = '30';
```

### Jest Configuration
Tests run with the following Jest settings:

```javascript
{
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: 1,        // Serial execution to avoid port conflicts
  forceExit: true,
  detectOpenHandles: true,
  verbose: true
}
```

## Adding New Tests

### Test Structure Guidelines

1. **Test File Organization**: Group tests by functionality
2. **Setup and Teardown**: Use `beforeEach`/`afterEach` for mock setup
3. **Descriptive Names**: Use clear, descriptive test names
4. **Error Validation**: Always test both success and error paths

### Example Test Structure

```javascript
describe('Feature Name', () => {
  let app;
  let mock;

  beforeEach(() => {
    app = createTestApp();
    mock = new MockAdapter(axios);

    // Setup common mocks
    mock.onGet('/v0/agents').reply(200, { agents: [] });
  });

  afterEach(() => {
    mock.restore();
    jest.clearAllMocks();
  });

  describe('Success Scenarios', () => {
    test('should handle valid input', async () => {
      // Test implementation
    });
  });

  describe('Error Scenarios', () => {
    test('should handle invalid input', async () => {
      // Test implementation
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Tests run serially to avoid port binding issues
2. **Mock Setup**: Ensure mocks are restored in `afterEach`
3. **Async Operations**: Use proper async/await patterns
4. **Timeout Issues**: Increase timeout for slow network simulations

### Debug Mode

Run tests with verbose output to see detailed error information:

```bash
DEBUG=* npm run test:all
```

## Coverage

The test suite provides comprehensive coverage of:

- ✅ **HTTP Endpoints**: All REST endpoints and middleware
- ✅ **MCP Protocol**: Complete JSON-RPC 2.0 implementation
- ✅ **SSE Transport**: Real-time event streaming
- ✅ **Tool Execution**: All available MCP tools
- ✅ **Error Handling**: Complete error propagation
- ✅ **Edge Cases**: Boundary conditions and unusual inputs
- ✅ **Concurrent Operations**: Multi-user scenarios
- ✅ **Network Resilience**: Connection and API failure handling

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Include both success and error scenarios
3. Add appropriate mock data and edge cases
4. Update this documentation if adding new test categories
5. Ensure tests pass before submitting PRs

## Related Documentation

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Cursor API Documentation](https://docs.cursor.com/api/)
- [Express Testing Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)