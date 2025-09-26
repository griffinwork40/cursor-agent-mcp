# Cursor Agent MCP API Reference

## Overview

The Cursor Agent MCP Server provides a Model Context Protocol interface to interact with Cursor's Background Agents API. This server exposes 10 MCP tools that enable LLMs to programmatically create, manage, and monitor background agents for autonomous code development.

### Base Information

- **Package**: `cursor-agent-mcp`
- **Version**: 1.0.5
- **Protocol**: Model Context Protocol (MCP)
- **Transport**: HTTP/SSE
- **Authentication**: Bearer token (Cursor API key)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/mcp` | Main MCP protocol endpoint |
| `GET` | `/health` | Health check |
| `GET` | `/sse` | Server-Sent Events |
| `GET` | `/` | Discovery endpoint for ChatGPT |

## Authentication

All MCP tools require authentication using a Cursor API key. The API key must be provided in the environment when starting the MCP server:

```bash
# Environment variable
CURSOR_API_KEY="your_cursor_api_key_here"

# Or via MCP client configuration
{
  "mcpServers": {
    "cursor-agent-mcp": {
      "command": "npx",
      "args": ["cursor-agent-mcp@latest"],
      "env": {
        "CURSOR_API_KEY": "your_cursor_api_key_here"
      }
    }
  }
}
```

**API Key Requirements:**
- Must be a valid Cursor API key (starts with `key_`)
- Must have sufficient permissions for background agents
- Key scope determines accessible repositories and agent limits

## MCP Tools Reference

### 1. `createAgent`

Creates a new background agent to work on a repository.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "prompt": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "The task or instructions for the agent to execute"
        },
        "images": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "data": {
                "type": "string",
                "description": "Base64 encoded image data"
              },
              "dimension": {
                "type": "object",
                "properties": {
                  "width": { "type": "number" },
                  "height": { "type": "number" }
                }
              }
            }
          }
        }
      },
      "required": ["text"]
    },
    "model": {
      "type": "string",
      "description": "The LLM to use (defaults to 'default' if not specified)",
      "default": "default"
    },
    "source": {
      "type": "object",
      "properties": {
        "repository": {
          "type": "string",
          "description": "The GitHub repository URL"
        },
        "ref": {
          "type": "string",
          "description": "Git ref (branch/tag) to use as the base branch"
        }
      },
      "required": ["repository"]
    },
    "target": {
      "type": "object",
      "properties": {
        "autoCreatePr": {
          "type": "boolean",
          "description": "Whether to automatically create a pull request when the agent completes. Defaults to true."
        },
        "branchName": {
          "type": "string",
          "description": "Custom branch name for the agent to create"
        }
      }
    },
    "webhook": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "URL to receive webhook notifications about agent status changes"
        },
        "secret": {
          "type": "string",
          "description": "Secret key for webhook payload verification"
        }
      },
      "required": ["url"]
    }
  },
  "required": ["prompt", "source", "model"]
}
```

#### Example Request

```json
{
  "prompt": {
    "text": "Fix all TypeScript errors in the project and add proper type definitions"
  },
  "model": "default",
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

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Successfully created agent!\n📋 ID: bc_abc123\n📊 Status: CREATING\n🌐 View: https://cursor.com/agents?id=bc_abc123\n📅 Created: 1/15/2024, 10:30:00 AM\n🔄 Auto-create PR: Enabled"
    }
  ]
}
```

#### Error Responses

**Validation Error (400):**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Validation Error: Validation failed in createAgent: prompt.text: Prompt text cannot be empty"
    }
  ],
  "isError": true
}
```

**API Error (401):**
```json
{
  "content": [
    {
      "type": "text",
      "text": "API Error (401): Invalid or missing API key [UNAUTHORIZED]"
    }
  ],
  "isError": true
}
```

---

### 2. `listAgents`

Retrieves all background agents for the authenticated user.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "limit": {
      "type": "number",
      "description": "Number of background agents to return (1-100)",
      "default": 100
    },
    "cursor": {
      "type": "string",
      "description": "Pagination cursor from the previous response"
    }
  }
}
```

#### Example Request

```json
{
  "limit": 50,
  "cursor": "next_page_cursor"
}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "📋 Found 2 agent(s):\n\n• Agent 1 (bc_abc123) - RUNNING - 1/15/2024\n• Agent 2 (bc_def456) - FINISHED - 1/14/2024\n\n📄 Next cursor: cursor_123"
    }
  ]
}
```

---

### 3. `summarizeAgents`

Produces an aggregated dashboard of recent agents with optional filters. Filters are applied before computing totals to ensure counts and recent activity align with the requested subset.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "description": "Optional status filter (CREATING, RUNNING, FINISHED, ERROR, EXPIRED)"
    },
    "repository": {
      "type": "string",
      "description": "Optional repository filter matched against the agent source"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of agents to inspect (1-100)"
    },
    "cursor": {
      "type": "string",
      "description": "Pagination cursor for fetching the next page"
    }
  }
}
```

#### Example Request

```json
{
  "status": "RUNNING",
  "repository": "company/app"
}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "📊 Agent Summary Dashboard\nFilters: status=RUNNING, repository~company/app\nTotal agents: 2\nStatus mix: 🔄 CREATING: 0 | ⚡ RUNNING: 2 | ✅ FINISHED: 0 | ❌ ERROR: 0 | ⏰ EXPIRED: 0\n\n🆕 Recent activity:\n• Hotfix Runner — ⚡ RUNNING (1/15/2024, 10:32:00 AM)\n• Docs Update — ⚡ RUNNING (1/15/2024, 9:58:00 AM)\n\n⏱️ In progress:\n• Hotfix Runner — 34m elapsed\n• Docs Update — 2h 5m elapsed"
    },
    {
      "type": "json",
      "json": {
        "filters": {
          "status": "RUNNING",
          "repository": "company/app",
          "limit": null,
          "cursor": null
        },
        "totals": {
          "totalAgents": 2
        },
        "statusCounts": {
          "CREATING": 0,
          "RUNNING": 2,
          "FINISHED": 0,
          "ERROR": 0,
          "EXPIRED": 0
        },
        "recentAgents": [
          {
            "id": "bc_hotfix",
            "name": "Hotfix Runner",
            "status": "RUNNING",
            "repository": "github.com/company/app",
            "timestamp": 1705314720000
          },
          {
            "id": "bc_docs",
            "name": "Docs Update",
            "status": "RUNNING",
            "repository": "github.com/company/app",
            "timestamp": 1705311480000
          }
        ],
        "inProgressAgents": [
          {
            "id": "bc_hotfix",
            "name": "Hotfix Runner",
            "status": "RUNNING",
            "repository": "github.com/company/app",
            "startedAt": "2024-01-15T09:58:00.000Z",
            "ageSeconds": 2040
          },
          {
            "id": "bc_docs",
            "name": "Docs Update",
            "status": "RUNNING",
            "repository": "github.com/company/app",
            "startedAt": "2024-01-15T08:27:00.000Z",
            "ageSeconds": 7440
          }
        ],
        "pagination": {
          "nextCursor": null
        }
      }
    }
  ]
}
```

---

### 4. `getAgent`

Retrieves detailed status and results of a specific background agent.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the background agent"
    }
  },
  "required": ["id"]
}
```

#### Example Request

```json
{
  "id": "bc_abc123"
}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "🤖 Agent Details:\n\n📋 Name: TypeScript Fixer\n🆔 ID: bc_abc123\n📊 Status: ✅ FINISHED\n📅 Created: 1/15/2024, 10:30:00 AM\n📝 Summary: Fixed 12 TypeScript errors\n🌐 View: https://cursor.com/agents?id=bc_abc123\n🔗 Repository: https://github.com/user/repo\n🌿 Branch: fix/typescript-errors"
    }
  ]
}
```

---

### 5. `deleteAgent`

Permanently deletes a background agent.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the background agent"
    }
  },
  "required": ["id"]
}
```

#### Example Request

```json
{
  "id": "bc_abc123"
}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "🗑️ Successfully deleted agent!\n🆔 Agent ID: bc_abc123\n⚠️ This action is permanent and cannot be undone."
    }
  ]
}
```

---

### 6. `addFollowup`

Adds followup instructions to a running background agent.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the background agent"
    },
    "prompt": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "The followup instruction for the agent"
        },
        "images": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "data": {
                "type": "string",
                "description": "Base64 encoded image data"
              },
              "dimension": {
                "type": "object",
                "properties": {
                  "width": { "type": "number" },
                  "height": { "type": "number" }
                }
              }
            }
          }
        }
      },
      "required": ["text"]
    }
  },
  "required": ["id", "prompt"]
}
```

#### Example Request

```json
{
  "id": "bc_abc123",
  "prompt": {
    "text": "Also add unit tests for the new functionality"
  }
}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "💬 Successfully added followup!\n🆔 Agent ID: bc_abc123\n📝 Followup: Also add unit tests for the new functionality"
    }
  ]
}
```

---

### 7. `getAgentConversation`

Retrieves the conversation history of a background agent.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the background agent"
    }
  },
  "required": ["id"]
}
```

#### Example Request

```json
{
  "id": "bc_abc123"
}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "💬 Agent Conversation (15 messages):\n\n🤖 Assistant: I found 12 TypeScript errors in your codebase...\n👤 User: Please fix them all.\n🤖 Assistant: Fixed 12 TypeScript errors. All type definitions are now correct.\n\n📊 Total messages: 15"
    }
  ]
}
```

---

### 8. `getMe`

Retrieves information about the API key being used for authentication.

#### Request Schema

```json
{
  "type": "object",
  "properties": {}
}
```

#### Example Request

```json
{}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "🔑 API Key Information:\n\n📋 Name: Production Key\n📅 Created: 1/1/2024, 12:00:00 AM\n👤 User Email: user@example.com"
    }
  ]
}
```

---

### 9. `listModels`

Retrieves a list of recommended models for background agents.

#### Request Schema

```json
{
  "type": "object",
  "properties": {}
}
```

#### Example Request

```json
{}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "🤖 Available Models:\n\n1. gpt-4o\n2. gpt-4-turbo\n3. gpt-4\n4. claude-3-opus\n5. claude-3-sonnet\n\n📊 Total: 5 models available"
    }
  ]
}
```

---

### 10. `listRepositories`

Retrieves a list of GitHub repositories accessible to the authenticated user.

#### Request Schema

```json
{
  "type": "object",
  "properties": {}
}
```

#### Example Request

```json
{}
```

#### Example Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "📁 Accessible Repositories:\n\n1. my-project (user1)\n   🔗 https://github.com/user1/my-project\n\n2. shared-repo (company)\n   🔗 https://github.com/company/shared-repo\n\n📊 Total: 2 repositories"
    }
  ]
}
```

---

### 11. `documentation`

Returns self-describing documentation for this MCP server, including endpoints, authentication, protocol, tool list, and example payloads.

#### Request Schema

```json
{
  "type": "object",
  "properties": {
    "format": {
      "type": "string",
      "enum": ["markdown", "json"],
      "default": "markdown",
      "description": "Preferred response format"
    }
  }
}
```

#### Example Request

```json
{ "format": "json" }
```

#### Example Response

```json
{
  "content": [
    { "type": "text", "text": "📘 Cursor MCP Documentation\n..." },
    { "type": "text", "text": "{\n  \"name\": \"cursor-background-agents\",\n  \"version\": \"1.0.0\",\n  ...\n}" }
  ]
}
```

## Error Codes

### HTTP Status Codes

| Status | Description | MCP Error Type |
|--------|-------------|----------------|
| `200` | Success | N/A |
| `400` | Bad Request | `ValidationError` |
| `401` | Unauthorized | `AuthenticationError` |
| `403` | Forbidden | `AuthorizationError` |
| `404` | Not Found | `NotFoundError` |
| `409` | Conflict | `ConflictError` |
| `429` | Too Many Requests | `RateLimitError` |
| `500` | Internal Server Error | `ApiError` |

### MCP Error Response Format

All errors follow this format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error description with context"
    }
  ],
  "isError": true
}
```

## Rate Limits

Rate limits are enforced by the Cursor API, not the MCP server:

- **Request limits**: Vary based on your Cursor subscription tier
- **Concurrent agents**: Limited based on your plan
- **Monthly usage**: Depends on your subscription level

Check your Cursor dashboard for current limits and usage.

## Response Formats

### Success Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "Human-readable message"
    }
  ]
}
```

### Error Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error message with details"
    }
  ],
  "isError": true
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CURSOR_API_KEY` | ✅ | - | Your Cursor API key |
| `CURSOR_API_URL` | ❌ | `https://api.cursor.com` | Cursor API base URL |
| `PORT` | ❌ | `3000` | Server port |
| `TOKEN_SECRET` | ❌ | - | Optional token signing secret |

## Best Practices

### Authentication
- Store API keys securely using environment variables
- Rotate API keys regularly
- Use separate keys for different environments

### Error Handling
- Always check the `isError` flag in responses
- Handle specific error types appropriately
- Log errors for debugging but don't expose sensitive information

### Rate Limiting
- Implement exponential backoff for retries
- Monitor your usage in the Cursor dashboard
- Consider queuing requests during high usage periods

### Agent Management
- Monitor agent status regularly
- Clean up completed agents to avoid hitting limits
- Use descriptive prompts for better agent performance
- Consider webhook notifications for long-running agents

### Auto-Create PR Behavior

The `autoCreatePr` parameter has simple default behavior:

- **When not specified**: `autoCreatePr` defaults to `true`
- **When explicitly set**: The specified value is used
- **Override**: Set `autoCreatePr: false` to disable automatic PR creation

This ensures that pull requests are automatically created when agents complete their work, providing a consistent workflow for code changes.