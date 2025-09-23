# 🚀 Cursor MCP Server

A ** MCP (Model Context Protocol) server** that seamlessly integrates with **Cursor's Background Agents API**. This server enables LLMs to programmatically create, manage, and interact with Cursor's powerful background agents for autonomous code development.

## ✨ Features

🤖 **Agent Management**
- Create and manage background agents
- Monitor agent status and progress
- Add followup instructions to running agents
- Delete agents when no longer needed

📊 **Repository & Model Access**
- List accessible GitHub repositories
- Get available AI models for agents
- Retrieve API key information

💬 **Communication & History**
- Access agent conversation history
- Real-time status updates
- Comprehensive error handling

### Quick Install via npm

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

### Development Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## 🔧 Configuring MCP Server in Cursor

To integrate this MCP server with Cursor's Background Agents, follow these steps:

### 1. 🔑 Get Your Cursor API Key
1. Open Cursor IDE
2. Go to **Settings** → **Features** → **Background Agents**
3. Generate or copy your API key from the Background Agents section
4. Keep this key secure - it provides full access to your Cursor account

### 2. 🛠️ MCP Client Configuration (npm install)
Add this server to your MCP client configuration:

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

### 3. 🎯 Claude Desktop Integration
For Claude Desktop, add to your `claude_desktop_config.json`:

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

### 🛠️ Development/Local Installation Configuration
If you're running from source code, use this configuration instead:

```json
{
  "mcpServers": {
    "cursor-agents": {
      "command": "node",
      "args": ["/path/to/cursor-mcp/src/index.js"],
      "env": {
        "CURSOR_API_KEY": "your_cursor_api_key_here",
        "CURSOR_API_URL":
        "https://api.cursor.com"
      }
    }
  }
}
```

## 📦 Installation & Setup

### Prerequisites
- **Node.js** 18+ 
- **Cursor IDE** with Background Agents enabled
- **Valid Cursor API key**

### 🚀 Quick Install via npm (Recommended)

```bash
# Install globally
npm install -g cursor-mcp-server

# Or use npx (no installation required)
npx cursor-mcp-server
```

### 📝 MCP Client Configuration

Add this to your MCP client configuration (e.g., Claude Desktop's `claude_desktop_config.json`):

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

### 🛠️ Development Installation

```bash
# 1. Clone the repository
git clone https://github.com/griffinwork40/cursor-mcp.git
cd cursor-mcp

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and add your CURSOR_API_KEY

# 4. Start the server
npm start
```

### Environment Variables
Create a `.env` file in the project root:
```env
# Required
CURSOR_API_KEY=your_cursor_api_key_here

# Optional
PORT=3000
CURSOR_API_URL=https://api.cursor.com
```

### Development Mode
```bash
# Start with auto-reload
npm run dev

# Run tests
npm test
```

## 🌐 Server Endpoints

- **`/mcp`** - MCP protocol endpoint for LLM interaction
- **`/health`** - Health check endpoint with uptime info

## 🛠️ Available MCP Tools (9 Tools)

This server provides **9 powerful tools** that enable LLMs to fully manage Cursor's Background Agents:

### 🤖 Agent Management Tools

#### 1. `createAgent` - Create Background Agent
**Purpose**: Create a new background agent to work on a repository
**Key Features**:
- 📝 Support for text and image prompts
- 🎯 Custom model selection
- 🌿 Branch and PR configuration
- 🔔 Webhook notifications
- ⚙️ Auto-PR creation

**Example Input**:
```json
{
  "prompt": {
    "text": "Fix all TypeScript errors in the project and add proper type definitions"
  },
  "model": "auto",
  "source": {
    "repository": "https://github.com/user/repo",
    "ref": "main"
  },
  "target": {
    "autoCreatePr": true,
    "branchName": "fix/typescript-errors"
  }
}
```

#### 2. `listAgents` - List All Agents
**Purpose**: Retrieve all background agents for the authenticated user
**Features**:
- 📄 Pagination support (1-100 agents per request)
- 📊 Agent status overview
- 📅 Creation date sorting
- 🔍 Cursor-based navigation

#### 3. `getAgent` - Get Agent Details
**Purpose**: Retrieve detailed status and results of a specific agent
**Returns**:
- 📊 Current status with emoji indicators
- 📝 Agent summary and progress
- 🌐 Direct links to view results
- 🌿 Branch and repository information
- 📅 Creation and update timestamps

#### 4. `deleteAgent` - Remove Agent
**Purpose**: Permanently delete a background agent
**Features**:
- ⚠️ Permanent deletion (cannot be undone)
- 🛡️ Confirmation response
- 🗑️ Cleanup of associated resources

#### 5. `addFollowup` - Add Instructions
**Purpose**: Send additional instructions to a running agent
**Capabilities**:
- 💬 Text instructions
- 🖼️ Image attachments
- 🔄 Real-time agent updates
- 📝 Conversation threading

### 📊 Information & Discovery Tools

#### 6. `getAgentConversation` - View Chat History
**Purpose**: Access the complete conversation history of an agent
**Features**:
- 💬 Full message history
- 👤 User and assistant message types
- 📊 Message count statistics
- 🔍 Recent message preview

#### 7. `getMe` - API Key Info
**Purpose**: Retrieve information about the current API key
**Returns**:
- 🔑 API key name and creation date
- 👤 Associated user email
- 📊 Account status information

#### 8. `listModels` - Available AI Models
**Purpose**: Get list of recommended models for background agents
**Features**:
- 🤖 All supported AI models
- 📋 Model recommendations
- 🎯 Optimized for different tasks

#### 9. `listRepositories` - Accessible Repos
**Purpose**: List GitHub repositories accessible to the user
**Returns**:
- 📁 Repository names and owners
- 🔗 Full repository URLs
- 📊 Access permissions
- 🌐 Direct GitHub links

## 🚀 Example Usage - Background Agents API

Here are practical examples of how to use the Background Agents API through this MCP server:

### 🎯 Complete Workflow Example

```javascript
// 1. First, check what repositories you have access to
const repos = await mcp.call('listRepositories');
console.log('Available repos:', repos.repositories);

// 2. Check available AI models
const models = await mcp.call('listModels');
console.log('Available models:', models.models);

// 3. Create a new background agent
const newAgent = await mcp.call('createAgent', {
  prompt: {
    text: `Please review this codebase and:
    1. Fix any TypeScript errors
    2. Add missing unit tests for core functions
    3. Update documentation for new features
    4. Optimize performance bottlenecks`
  },
  model: 'auto',
  source: {
    repository: 'https://github.com/myuser/my-project',
    ref: 'main'
  },
  target: {
    autoCreatePr: true,
    branchName: 'agent/code-improvements'
  }
});

console.log('Created agent:', newAgent.agentId);

// 4. Monitor agent progress
const agentStatus = await mcp.call('getAgent', { 
  id: newAgent.agentId 
});
console.log('Agent status:', agentStatus.status);

// 5. Add followup instructions if needed
if (agentStatus.status === 'RUNNING') {
  await mcp.call('addFollowup', {
    id: newAgent.agentId,
    prompt: {
      text: "Also please add ESLint configuration with strict rules"
    }
  });
}

// 6. View conversation history
const conversation = await mcp.call('getAgentConversation', {
  id: newAgent.agentId
});
console.log('Messages:', conversation.messages.length);
```

### 🔥 Common Use Cases

#### 🐛 Bug Fix Agent
```json
{
  "prompt": {
    "text": "There's a critical bug in the user authentication flow. Please investigate and fix the login issues reported in GitHub issues #123 and #124."
  },
  "model": "auto",
  "source": {
    "repository": "https://github.com/company/webapp",
    "ref": "main"
  },
  "target": {
    "autoCreatePr": true,
    "branchName": "hotfix/auth-login-bug"
  }
}
```

#### 🚀 Feature Development Agent
```json
{
  "prompt": {
    "text": "Implement a new dark mode toggle feature with the following requirements:\n- System preference detection\n- Persistent user choice\n- Smooth transitions\n- Accessibility compliance"
  },
  "model": "auto",
  "source": {
    "repository": "https://github.com/company/frontend",
    "ref": "develop"
  },
  "target": {
    "autoCreatePr": true,
    "branchName": "feature/dark-mode-toggle"
  }
}
```

#### 📚 Documentation Agent
```json
{
  "prompt": {
    "text": "Update all documentation files:\n- Add comprehensive API documentation\n- Create setup guides for new developers\n- Add code examples for all public methods\n- Update README with latest features"
  },
  "model": "auto",
  "source": {
    "repository": "https://github.com/company/api-server"
  },
  "target": {
    "autoCreatePr": true,
    "branchName": "docs/comprehensive-update"
  }
}
```

#### 🧪 Testing Agent
```json
{
  "prompt": {
    "text": "Improve test coverage by:\n- Adding unit tests for untested components\n- Creating integration tests for API endpoints\n- Adding E2E tests for critical user flows\n- Setting up test data factories"
  },
  "model": "auto",
  "source": {
    "repository": "https://github.com/company/app"
  },
  "target": {
    "autoCreatePr": true,
    "branchName": "test/improve-coverage"
  }
}
```

### 📱 Agent Management Examples

#### List and Monitor All Agents
```javascript
// Get all your agents
const allAgents = await mcp.call('listAgents', { limit: 50 });

// Check each agent's status
for (const agent of allAgents.agents) {
  const details = await mcp.call('getAgent', { id: agent.id });
  console.log(`${agent.name}: ${details.status}`);
  
  // Get conversation for running agents
  if (details.status === 'RUNNING') {
    const conversation = await mcp.call('getAgentConversation', { 
      id: agent.id 
    });
    console.log(`  Messages: ${conversation.messageCount}`);
  }
}
```

#### Cleanup Finished Agents
```javascript
const agents = await mcp.call('listAgents');

for (const agent of agents.agents) {
  if (agent.status === 'FINISHED' || agent.status === 'ERROR') {
    await mcp.call('deleteAgent', { id: agent.id });
    console.log(`Deleted agent: ${agent.name}`);
  }
}
```

## 🛡️ Enhanced Error Handling

The server includes **enterprise-grade error handling** with:

### 🔍 Error Features
- **🔐 Input Validation**: All inputs validated using Zod schemas
- **📊 HTTP Status Mapping**: Proper error codes mapped to HTTP status codes  
- **📝 Detailed Messages**: Informative error messages with context
- **🏗️ Structured Responses**: Consistent error response format
- **📋 Comprehensive Logging**: Full request/response logging for debugging

### 🚨 Error Types & Status Codes

| Error Type | Status | Description |
|------------|--------|-------------|
| `ValidationError` | 400 | ❌ Input validation failures |
| `AuthenticationError` | 401 | 🔑 Invalid or missing API key |
| `AuthorizationError` | 403 | 🚫 Insufficient permissions |
| `NotFoundError` | 404 | 🔍 Resource not found |
| `ConflictError` | 409 | ⚔️ Resource conflict |
| `RateLimitError` | 429 | 🚦 Rate limit exceeded |
| `ApiError` | 500 | ⚡ General API errors |

### 🧪 Testing Error Handling

```bash
# Run comprehensive error handling tests
node test-error-handling.js

# Test with curl examples
bash test-curl-examples.sh
```

## ⚙️ Configuration

Configure the server using environment variables:

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | ❌ | Server port number |
| `CURSOR_API_KEY` | - | ✅ | Your Cursor API key |
| `CURSOR_API_URL` | `https://api.cursor.com` | ❌ | Cursor API base URL |

## 👨‍💻 Development

### 🚀 Available Scripts

```bash
# Production
npm start              # 🏃 Start the server

# Development  
npm run dev           # 🔄 Start with auto-reload (nodemon)
npm test             # 🧪 Run tests (Jest configured)

# Testing
node test-mcp-client.js        # 🔧 Test MCP client
node test-error-handling.js    # 🛡️ Test error handling
bash test-curl-examples.sh     # 🌐 Test with curl
```

### 📊 Logging & Monitoring

The server includes **comprehensive observability**:

- 📥 **Request/Response Logging**: Full HTTP request/response details
- 🔧 **API Call Logging**: Cursor API interaction logging  
- 🚨 **Error Logging**: Detailed error logs with stack traces
- 💓 **Health Monitoring**: Health check endpoint with uptime info
- 📈 **Performance Metrics**: Request timing and success rates

### 🏥 Health Check

Monitor server health:
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-23T10:30:00.000Z", 
  "version": "1.0.0",
  "uptime": 3600.5
}
```

## 🎯 Production Deployment

### 🐳 Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["npm", "start"]
```

### 🌐 Environment Setup
```bash
# Production environment
export NODE_ENV=production
export PORT=3000
export CURSOR_API_KEY=your_production_key

# Start server
npm start
```

### 📊 Monitoring
- Health checks at `/health`
- Structured logging for observability
- Graceful shutdown handling
- Process management ready

---

## 🎉 Why Choose This MCP Server?

✅ **Production Ready** - Comprehensive error handling and validation  
✅ **Full Feature Coverage** - All 9 Cursor Background Agent API endpoints  
✅ **Developer Friendly** - Extensive documentation and examples  
✅ **Type Safe** - Zod schema validation for all inputs  
✅ **Observable** - Detailed logging and monitoring  
✅ **Tested** - Comprehensive test suite included  
✅ **Maintained** - Active development and support  

**🚀 Ready to supercharge your development workflow with AI-powered background agents!**