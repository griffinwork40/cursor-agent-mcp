# Cursor MCP Server

MCP (Model Context Protocol) server implementation for the Cursor Background Agents API. This server allows LLMs to interact with Cursor's background agents programmatically.

## Features

- Create and manage background agents
- List repositories
- Get agent status and conversation history
- Add followup instructions to agents
- List available models
- Retrieve API key information

## Installation

### Quick Install via npm (Recommended)

```bash
# Install globally
npm install -g cursor-agent-mcp

# Or use npx (no installation required)
npx cursor-agent-mcp
```

### MCP Client Configuration

Add this to your MCP client configuration (e.g., Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cursor-agents": {
      "command": "npx",
      "args": ["cursor-agent-mcp"],
      "env": {
        "CURSOR_API_KEY": "your_cursor_api_key_here"
      }
    }
  }
}
```

### Development Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Cursor API key:
   ```env
   CURSOR_API_KEY=your_api_key_here
   ```

4. Start the server:
   ```bash
   npm start
   ```

## Usage

The server will start on port 3000 by default. You can configure the port by setting the `PORT` environment variable.

## API Endpoints

- `/mcp` - MCP protocol endpoint for LLM interaction
- `/health` - Health check endpoint

## Tools Available to LLMs

The following tools are available to LLMs through the MCP protocol:

1. `createAgent` - Create a new background agent
2. `listAgents` - List all background agents
3. `getAgent` - Get details of a specific agent
4. `deleteAgent` - Delete a background agent
5. `addFollowup` - Add followup instructions to an agent
6. `getAgentConversation` - Get conversation history of an agent
7. `getMe` - Get API key information
8. `listModels` - List available models
9. `listRepositories` - List accessible GitHub repositories

## Enhanced Error Handling

The server includes comprehensive error handling with:

- **Input Validation**: All inputs are validated using Zod schemas
- **HTTP Status Mapping**: Proper error codes mapped to HTTP status codes
- **Detailed Error Messages**: Informative error messages with context
- **Structured Responses**: Consistent error response format
- **Logging**: Comprehensive logging for debugging

### Error Types

- `ValidationError` (400) - Input validation failures
- `AuthenticationError` (401) - Invalid or missing API key
- `AuthorizationError` (403) - Insufficient permissions
- `NotFoundError` (404) - Resource not found
- `ConflictError` (409) - Resource conflict
- `RateLimitError` (429) - Rate limit exceeded
- `ApiError` (500) - General API errors

### Testing Error Handling

Run the error handling test:

```bash
node test-error-handling.js
```

## Configuration

The server can be configured using environment variables:

- `PORT` - Server port (default: 3000)
- `CURSOR_API_KEY` - Your Cursor API key (required)
- `CURSOR_API_URL` - Cursor API URL (default: https://api.cursor.com)

## Development

### Scripts

- `npm start` - Start the server
- `npm run dev` - Start with nodemon for development
- `npm test` - Run tests (Jest configured)

### Logging

The server includes comprehensive logging:
- Request/response logging
- API call logging
- Error logging with stack traces
- Health check endpoint with uptime info