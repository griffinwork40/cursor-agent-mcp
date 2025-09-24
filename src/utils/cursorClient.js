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
      'User-Agent': 'cursor-mcp/1.0.0',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    this.client = axios.create({
      baseURL: config.cursor.apiUrl,
      headers,
      timeout: 30000, // 30 second timeout
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.error(`Making API request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.error(`API response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API response error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message,
        });
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