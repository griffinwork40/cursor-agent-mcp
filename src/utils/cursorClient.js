import axios from 'axios';
import { config } from '../config/index.js';
// Import error classes for future use
// import { 
//   ApiError, 
//   AuthenticationError, 
//   AuthorizationError, 
//   NotFoundError, 
//   RateLimitError,
//   ConflictError, 
// } from './errorHandler.js';

class CursorApiClient {
  constructor(apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'cursor-agent-mcp/1.0.0',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    this.client = axios.create({
      baseURL: config.cursor.apiUrl,
      headers,
      timeout: 30000, // 30 second timeout
    });

    const shouldDebug = Boolean(config.logging?.cursorClientDebug);

    const sensitiveKey = (key) => {
      const lower = key.toLowerCase();
      return (
        lower.includes('secret') ||
        lower.includes('token') ||
        lower.includes('key') ||
        lower.includes('authorization') ||
        lower.includes('password') ||
        lower.includes('prompt')
      );
    };

    const sanitize = (value, depth = 0) => {
      if (value === null || value === undefined) return value;
      if (typeof value === 'bigint') return value.toString();
      if (typeof value !== 'object') return value;
      if (depth >= 4) return '[Truncated]';
      if (Array.isArray(value)) {
        return value.map(item => sanitize(item, depth + 1));
      }
      return Object.entries(value).reduce((acc, [key, val]) => {
        acc[key] = sensitiveKey(key) ? '***REDACTED***' : sanitize(val, depth + 1);
        return acc;
      }, {});
    };

    const safeStringify = (value) => {
      try {
        return JSON.stringify(value);
      } catch {
        return null;
      }
    };

    const logPayload = (label, payload) => {
      if (!shouldDebug || payload === undefined) return;
      const sanitized = sanitize(payload);
      const serialized = safeStringify(sanitized);
      if (serialized) {
        console.error(label, serialized.slice(0, 4000));
      }
    };

    this.client.interceptors.request.use(
      (requestConfig) => {
        if (shouldDebug) {
          console.error(`Making API request: ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
        }
        logPayload('Request payload:', requestConfig.data);
        return requestConfig;
      },
      (error) => {
        if (shouldDebug) {
          console.error('Request interceptor error:', error);
        }
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => {
        if (shouldDebug) {
          console.error(`API response: ${response.status} ${response.config.url}`);
        }
        logPayload('Response payload:', response.data);
        return response;
      },
      (error) => {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const url = error.config?.url;
        const message = error.message;
        console.error('API response error:', { status, statusText, url, message });
        logPayload('Error payload:', error.response?.data);
        return Promise.reject(error);
      },
    );
  }

  // Create a new agent
  async createAgent(data) {
    const response = await this.client.post('/v0/agents', data);
    return response.data;
  }

  // List agents
  async listAgents(params = {}) {
    const response = await this.client.get('/v0/agents', { params });
    return response.data;
  }

  // Get agent details
  async getAgent(id) {
    const response = await this.client.get(`/v0/agents/${id}`);
    return response.data;
  }

  // Delete an agent
  async deleteAgent(id) {
    const response = await this.client.delete(`/v0/agents/${id}`);
    return response.data;
  }

  // Add followup to an agent
  async addFollowup(id, data) {
    const response = await this.client.post(`/v0/agents/${id}/followup`, data);
    return response.data;
  }

  // Get agent conversation
  async getAgentConversation(id) {
    const response = await this.client.get(`/v0/agents/${id}/conversation`);
    return response.data;
  }

  // Get API key information
  async getMe() {
    const response = await this.client.get('/v0/me');
    return response.data;
  }

  // List available models
  async listModels() {
    const response = await this.client.get('/v0/models');
    return response.data;
  }

  // List GitHub repositories
  async listRepositories() {
    const response = await this.client.get('/v0/repositories');
    return response.data;
  }
}

export const createCursorApiClient = (apiKey) => new CursorApiClient(apiKey);

// Backward compatibility for local/stdio mode where a global key is provided
export const cursorApiClient = createCursorApiClient(config.cursor.apiKey);