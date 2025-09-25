# Cursor Agent MCP Server

A **Model Context Protocol (MCP) server** that enables LLMs to programmatically create, manage, and interact with Cursor's powerful background agents for autonomous code development.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [API Reference](./docs/api-reference.md)
- [Security](./docs/SECURITY.md)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

🤖 **Agent Management** - Create, monitor, and control background agents
📊 **Repository Access** - List accessible GitHub repositories and AI models
💬 **Communication** - Access agent conversations and add follow-up instructions
🛡️ **Production Ready** - Comprehensive error handling, validation, and security

## 🚀 Quick Start

### 1. Get Your API Key
1. Open Cursor IDE → **Settings** → **Features** → **Background Agents**
2. Generate or copy your API key

### 2. Install & Configure
```bash
# Install globally
npm install -g cursor-agent-mcp

# Configure for Claude Desktop
mkdir -p ~/.config/claude
cat > ~/.config/claude/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "cursor-agents": {
      "command": "npx",
      "args": ["cursor-agent-mcp@latest"],
      "env": {
        "CURSOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
EOF
```

### 3. Test It
Restart Claude Desktop and ask: *"Create a background agent to fix TypeScript errors in my project"*

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- Cursor IDE with Background Agents enabled
- Valid Cursor API key

### Install Options

**Global Installation (Recommended):**
```bash
npm install -g cursor-agent-mcp
```

**No Installation (Development):**
```bash
npx cursor-agent-mcp
```

**From Source:**
```bash
git clone https://github.com/griffinwork40/cursor-agent-mcp.git
cd cursor-agent-mcp
npm install
npm start
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `CURSOR_API_KEY` | - | ✅ | Your Cursor API key |
| `CURSOR_API_URL` | `https://api.cursor.com` | ❌ | Cursor API base URL |
| `PORT` | `3000` | ❌ | Server port |
| `TOKEN_SECRET` | - | ❌ | Optional token signing secret |

### MCP Client Configuration

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "cursor-agents": {
      "command": "npx",
      "args": ["cursor-agent-mcp@latest"],
      "env": {
        "CURSOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Codex CLI** (`~/.codex/config.toml`):
```toml
[mcp_servers.cursor-agents]
command = "npx"
args = ["cursor-agent-mcp@latest"]
env = { "CURSOR_API_KEY" = "your_api_key_here" }
```

## 💡 Usage

### Basic Examples

**Create an Agent:**
```bash
# Ask your AI assistant to create an agent
"Create a background agent to fix TypeScript errors in my project"
```

**Add Follow-up Instructions:**
```bash
# Add instructions to a running agent
"Add ESLint configuration with strict rules to the agent working on my project"
```

**Monitor Progress:**
```bash
# Check agent status
"Show me the status of my background agents"
```

### MCP Tools Available

The server provides 9 powerful MCP tools:

1. **`createAgent`** - Create background agents
2. **`listAgents`** - List all agents
3. **`getAgent`** - Get agent details
4. **`deleteAgent`** - Remove agents
5. **`addFollowup`** - Add instructions
6. **`getAgentConversation`** - View chat history
7. **`getMe`** - Get API key info
8. **`listModels`** - Available AI models
9. **`listRepositories`** - Accessible repositories

**📖 [Full API Reference](./docs/api-reference.md)**

## 🚀 Contributing

### Development Setup

```bash
# Clone repository
git clone https://github.com/griffinwork40/cursor-agent-mcp.git
cd cursor-agent-mcp

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Development Workflow

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Make changes** and commit
3. **Push branch** and create Pull Request
4. **Automated checks** will run (tests, linting, security)

**📖 [Development Guidelines](./docs/api-reference.md#development)**

---

## 🔒 Security

This server handles sensitive operations and API keys. Follow these security practices:

- **API Key Security**: Store keys in environment variables, never commit to version control
- **Input Validation**: All inputs are validated using Zod schemas
- **Error Handling**: Secure error responses without information leakage
- **Production Deployment**: Use HTTPS and secure configurations

**🛡️ [Security Documentation](./docs/SECURITY.md)**

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for full text.

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

