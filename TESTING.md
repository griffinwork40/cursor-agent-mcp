# Testing Your MCP Server

This guide shows you how to test your Cursor MCP Server manually using various MCP clients.

## Prerequisites

1. **Start your MCP server:**
   ```bash
   npm start
   ```
   The server should be running on `http://localhost:3000`

2. **Set up your environment:**
   Make sure you have a valid `CURSOR_API_KEY` in your `.env` file

## Testing Methods

### 1. 🖥️ Interactive Node.js Client (Recommended)

The easiest way to test your MCP server is with the interactive client:

```bash
node test-mcp-client.js
```

This provides a menu-driven interface to test all tools:
- List available tools
- Get API key info
- List models and repositories
- Create and manage agents
- Test validation errors

### 2. 🌐 cURL Script

Run the automated cURL test suite:

```bash
./test-curl-examples.sh
```

This script tests all endpoints and shows you the raw HTTP requests/responses.

### 3. 📮 Postman Collection

Import the `test-postman-collection.json` file into Postman to test individual endpoints:

1. Open Postman
2. Click "Import" 
3. Select `test-postman-collection.json`
4. Run individual requests or the entire collection

### 4. 🔧 Manual cURL Commands

Here are individual cURL commands you can run:

#### Health Check
```bash
curl http://localhost:3000/health
```

#### List Available Tools
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

#### Get API Key Info
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "getMe",
      "arguments": {}
    }
  }'
```

#### List Available Models
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "listModels",
      "arguments": {}
    }
  }'
```

#### List Repositories
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "listRepositories",
      "arguments": {}
    }
  }'
```

#### Create Agent (Test)
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "createAgent",
      "arguments": {
        "prompt": {
          "text": "Add a README.md file with installation instructions"
        },
        "source": {
          "repository": "https://github.com/test/repo"
        },
        "model": "default"
      }
    }
  }'
```

#### Test Validation Error
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "createAgent",
      "arguments": {
        "prompt": {
          "text": ""
        },
        "source": {
          "repository": "https://github.com/test/repo"
        }
      }
    }
  }'
```

## Expected Responses

### Successful Tool Call
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Successfully created agent!\n📋 ID: bc_abc123\n📊 Status: CREATING\n🌐 View: https://cursor.com/agents?id=bc_abc123\n📅 Created: 1/15/2024, 10:30:00 AM"
      }
    ]
  }
}
```

### Validation Error
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Validation Error: Validation failed in createAgent: prompt.text: Prompt text cannot be empty"
      }
    ],
    "isError": true
  }
}
```

### API Error
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "API Error (401): Invalid or missing API key [UNAUTHORIZED]"
      }
    ],
    "isError": true
  }
}
```

## Testing Scenarios

### 1. ✅ Happy Path Tests
- List all available tools
- Get API key information
- List available models
- List accessible repositories
- List existing agents
- Create a new agent with valid data

### 2. ❌ Error Handling Tests
- Create agent with empty prompt text
- Create agent with missing repository
- Create agent with invalid repository URL
- Call non-existent tool
- Test with invalid JSON

### 3. 🔍 Edge Cases
- Create agent with very long prompt text
- Create agent with special characters
- Test pagination with listAgents
- Test with different model names

## Debugging Tips

1. **Check server logs:** The server logs all requests and responses
2. **Use browser dev tools:** If testing via web interface
3. **Verify API key:** Make sure your CURSOR_API_KEY is valid
4. **Check network:** Ensure you can reach api.cursor.com
5. **Test health endpoint:** Always start with `/health` to verify server is running

## Common Issues

### Server Not Running
```
❌ Server is not running! Please start it with: npm start
```
**Solution:** Start the server with `npm start`

### Invalid API Key
```
API Error (401): Invalid or missing API key [UNAUTHORIZED]
```
**Solution:** Check your `.env` file and ensure `CURSOR_API_KEY` is set correctly

### Validation Errors
```
Validation Error: Validation failed in createAgent: prompt.text: Prompt text cannot be empty
```
**Solution:** Provide valid input data according to the schema requirements

### Network Errors
```
Network Error: Unable to connect to Cursor API
```
**Solution:** Check your internet connection and verify api.cursor.com is accessible

## Next Steps

Once you've tested the basic functionality:

1. **Test with real repositories:** Use actual GitHub repositories you have access to
2. **Test agent workflows:** Create agents and monitor their progress
3. **Test error scenarios:** Try various invalid inputs to test error handling
4. **Performance testing:** Test with multiple concurrent requests
5. **Integration testing:** Test with actual MCP clients like Claude Desktop

## MCP Client Integration

To use this server with actual MCP clients (like Claude Desktop), you'll need to configure the client to connect to your server. The exact configuration depends on the client, but typically involves:

1. Adding your server to the client's configuration
2. Specifying the server URL (`http://localhost:3000/mcp`)
3. Ensuring the client can reach your server

Check your MCP client's documentation for specific integration instructions.