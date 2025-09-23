#!/bin/bash

# Manual MCP Testing with cURL
# This script provides cURL examples for testing your MCP server

echo "🧪 MCP Server Testing with cURL"
echo "================================"
echo "Make sure your MCP server is running on port 3000"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to make MCP requests
make_mcp_request() {
    local method=$1
    local params=$2
    local description=$3
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Request: $method"
    echo ""
    
    curl -X POST http://localhost:3000/mcp \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"id\": $(date +%s),
            \"method\": \"$method\",
            \"params\": $params
        }" \
        -w "\nHTTP Status: %{http_code}\n" \
        -s | jq '.' 2>/dev/null || echo "Response received (jq not available for formatting)"
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Check if server is running
echo "🔍 Checking if server is running..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Server is running!${NC}"
else
    echo -e "${RED}❌ Server is not running! Please start it with: npm start${NC}"
    exit 1
fi

echo ""
echo "🚀 Starting MCP Tests..."
echo ""

# Test 1: List available tools
make_mcp_request "tools/list" "{}" "List Available Tools"

# Test 2: Get API key info
make_mcp_request "tools/call" '{
    "name": "getMe",
    "arguments": {}
}' "Get API Key Information"

# Test 3: List available models
make_mcp_request "tools/call" '{
    "name": "listModels",
    "arguments": {}
}' "List Available Models"

# Test 4: List repositories
make_mcp_request "tools/call" '{
    "name": "listRepositories",
    "arguments": {}
}' "List GitHub Repositories"

# Test 5: List agents
make_mcp_request "tools/call" '{
    "name": "listAgents",
    "arguments": {
        "limit": 5
    }
}' "List Background Agents"

# Test 6: Create agent (test)
make_mcp_request "tools/call" '{
    "name": "createAgent",
    "arguments": {
        "prompt": {
            "text": "Add a README.md file with installation instructions"
        },
        "source": {
            "repository": "https://github.com/test/repo"
        },
        "model": "claude-4-sonnet"
    }
}' "Create Test Agent"

# Test 7: Test validation (should fail)
make_mcp_request "tools/call" '{
    "name": "createAgent",
    "arguments": {
        "prompt": {
            "text": ""
        },
        "source": {
            "repository": "https://github.com/test/repo"
        }
    }
}' "Test Input Validation (Should Fail)"

# Test 8: Test invalid tool name
make_mcp_request "tools/call" '{
    "name": "invalidTool",
    "arguments": {}
}' "Test Invalid Tool Name (Should Fail)"

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "💡 Tips:"
echo "- Check the server logs for detailed request/response information"
echo "- Modify the test parameters to test different scenarios"
echo "- Use the interactive client: node test-mcp-client.js"