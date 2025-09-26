# Cursor MCP Server - Project Context

## Project Overview

The Cursor MCP Server is a production-ready Model Context Protocol (MCP) server that enables LLMs to create, manage, and interact with Cursor's Background Agents API. It provides an interface to programmatically control Cursor's autonomous coding agents for development tasks.

### Main Technologies
- Node.js (v18+)
- Express.js (web server framework)
- @modelcontextprotocol/sdk (MCP protocol implementation)
- Axios (HTTP client)
- Zod (input validation)
- Dotenv (environment configuration)

### Architecture
- **MCP Server**: Implements the Model Context Protocol for LLM integration
- **Express Server**: Provides HTTP endpoints for testing and direct access
- **Cursor API Client**: Handles communication with Cursor's Background Agents API
- **Error Handling**: Comprehensive validation and error management system
- **Configuration**: Environment-based configuration with validation

## Key Features

### 10 MCP Tools Available
1. **createAgent**: Create background agents for repository work
2. **listAgents**: List all background agents for authenticated user
3. **getAgent**: Retrieve detailed status and results of specific agent
4. **deleteAgent**: Permanently delete a background agent
5. **addFollowup**: Add instructions to running agents
6. **getAgentConversation**: Access agent conversation history
7. **getMe**: Retrieve API key information
8. **listModels**: Get available AI models for agents
9. **listRepositories**: List accessible GitHub repositories

### Core Capabilities
- Full integration with Cursor's Background Agents API
- Input validation using Zod schemas
- Comprehensive error handling and logging
- Support for both HTTP and MCP transport protocols
- Production-ready with health checks and graceful shutdown

## Building and Running

### Prerequisites
- Node.js 18+ installed
- Valid Cursor API key from Cursor IDE settings
- GitHub repository access for agent operations

### Installation
```bash
# Install globally (recommended)
npm install -g cursor-agent-mcp

# Or use npx without installation
npx cursor-agent-mcp
```

### Development Setup
```bash
# Clone repository
git clone https://github.com/griffinwork40/cursor-agent-mcp.git
cd cursor-agent-mcp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your CURSOR_API_KEY

# Start server
npm start

# Start with auto-reload during development
npm run dev
```

### Environment Variables
- `CURSOR_API_KEY` (required): Your Cursor API key
- `PORT` (optional): Server port (default: 3000)
- `CURSOR_API_URL` (optional): Cursor API base URL (default: https://api.cursor.com)

### Running the Server
```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev

# Run tests
npm test
```

## API Endpoints

### HTTP Endpoints
- `/mcp` - MCP protocol endpoint for LLM interaction
- `/health` - Health check endpoint with uptime info

### MCP Protocol Methods
- `tools/list` - List all available tools
- `tools/call` - Execute a specific tool with parameters

## Development Conventions

### Coding Style
- ES6+ JavaScript with modules
- Async/await for asynchronous operations
- Zod for input validation
- Custom error classes for different error types
- Consistent logging format

### Error Handling
- Validation errors (400) - Input validation failures
- Authentication errors (401) - Invalid or missing API key
- Authorization errors (403) - Insufficient permissions
- Not found errors (404) - Resource not found
- Conflict errors (409) - Resource conflict
- Rate limit errors (429) - Rate limit exceeded
- General API errors (500) - Catch-all for other issues

### Testing
- Test suite available with `npm test`
- Interactive Node.js client: `node test-mcp-client.js`
- cURL examples in `test-curl-examples.sh`
- Postman collection in `test-postman-collection.json`

## Key Files and Structure

```
src/
├── index.js              # Express server implementation
├── mcp-server.js         # MCP protocol server implementation
├── tools/
│   └── index.js          # All MCP tools implementation (including documentation)
├── utils/
│   ├── cursorClient.js   # Cursor API client wrapper
│   └── errorHandler.js   # Error handling and validation
└── config/
    └── index.js          # Environment configuration
```

## Integration

### With Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "cursor-background-agents": {
      "command": "npx",
      "args": ["cursor-agent-mcp@latest"],
      "env": {
        "CURSOR_API_KEY": "your_cursor_api_key_here",
        "CURSOR_API_URL": "https://api.cursor.com"
      }
    }
  }
}
```

### With Development Version
```json
{
  "mcpServers": {
    "cursor-agents": {
      "command": "node",
      "args": ["/path/to/cursor-agent-mcp/src/index.js"],
      "env": {
        "CURSOR_API_KEY": "your_cursor_api_key_here",
        "CURSOR_API_URL": "https://api.cursor.com"
      }
    }
  }
}
```

## Security Considerations

- CURSOR_API_KEY provides full access to your Cursor account
- Always store API keys securely and don't commit to version control
- The server implements proper authentication and authorization checks
- Rate limiting is handled by the Cursor API

## Maintenance and Monitoring

- Health check endpoint at `/health`
- Comprehensive request/response logging
- Error logging with stack traces
- Graceful shutdown handling
- Process management ready for production deployment

This project follows MCP specifications and provides a robust interface for integrating Cursor's powerful background agents with AI development workflows.