import { z } from 'zod';

// Custom error classes
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

export class ApiError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict with current state') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// Error handler for MCP responses
export function handleMCPError(error, context = '') {
  console.error(`MCP Error in ${context}:`, {
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    stack: error.stack,
  });

  // Handle different error types
  if (error instanceof ValidationError) {
    return {
      content: [{
        type: 'text',
        text: `Validation Error: ${error.message}${error.field ? ` (field: ${error.field})` : ''}`,
      }],
      isError: true,
    };
  }

  if (error instanceof ApiError) {
    return {
      content: [{
        type: 'text',
        text: `API Error (${error.statusCode}): ${error.message}${error.code ? ` [${error.code}]` : ''}`,
      }],
      isError: true,
    };
  }

  // Handle Axios errors
  if (error.response) {
    const statusCode = error.response.status;
    const errorData = error.response.data?.error || {};
    const message = errorData.message || error.message;
    const code = errorData.code;

    let errorType;
    switch (statusCode) {
    case 400:
      errorType = new ValidationError(message);
      break;
    case 401:
      errorType = new AuthenticationError(message);
      break;
    case 403:
      errorType = new AuthorizationError(message);
      break;
    case 404:
      errorType = new NotFoundError(message);
      break;
    case 409:
      errorType = new ConflictError(message);
      break;
    case 429:
      errorType = new RateLimitError(message);
      break;
    default:
      errorType = new ApiError(message, statusCode, code);
      break;
    }

    // Use errorType for consistent error handling
    const errorMessage = errorType.message || message;
    const errorCode = errorType.code || code;

    return {
      content: [{
        type: 'text',
        text: `API Error (${statusCode}): ${errorMessage}${errorCode ? ` [${errorCode}]` : ''}`,
      }],
      isError: true,
    };
  }

  // Handle network errors
  if (error.request) {
    return {
      content: [{
        type: 'text',
        text: 'Network Error: Unable to connect to Cursor API. Please check your internet connection and API key.',
      }],
      isError: true,
    };
  }

  // Handle other errors
  return {
    content: [{
      type: 'text',
      text: `Unexpected Error: ${error.message}`,
    }],
    isError: true,
  };
}

// Validation schemas using Zod
const imageDimension = z.object({
  width: z.number().int().min(1, 'Width must be a positive integer'),
  height: z.number().int().min(1, 'Height must be a positive integer'),
});

const image = z.object({
  data: z.string().min(1, 'Image data cannot be empty'),
  dimension: imageDimension.optional(),
});

const prompt = z.object({
  text: z.string().min(1, 'Prompt text cannot be empty'),
  images: z.array(image).max(5, 'Maximum 5 images allowed').optional(),
});

const source = z.object({
  repository: z.string().min(1, 'Repository URL cannot be empty'),
  ref: z.string().min(1, 'Git ref cannot be empty').optional(),
});

const target = z.object({
  autoCreatePr: z.boolean().optional(),
  branchName: z.string().min(1, 'Branch name cannot be empty').optional(),
});

const webhook = z.object({
  url: z.string().url('Invalid webhook URL').max(2048, 'Webhook URL too long'),
  secret: z.string().min(32, 'Webhook secret must be at least 32 characters').max(256, 'Webhook secret too long').optional(),
});

export const schemas = {
  imageDimension,
  image,
  prompt,
  source,
  target,
  webhook,

  createAgentRequest: z.object({
    prompt: prompt,
    model: z.string().min(1, 'Model cannot be empty').default('default'),
    source: source,
    target: target.optional(),
    webhook: webhook.optional(),
  }),

  addFollowupRequest: z.object({
    prompt: prompt,
  }),

  listAgentsParams: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
  }),

  agentId: z.string().min(1, 'Agent ID cannot be empty'),
};

// Validation helper
export function validateInput(schema, data, context = '') {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`,
      ).join(', ');
      throw new ValidationError(`Validation failed${context ? ` in ${context}` : ''}: ${fieldErrors}`);
    }
    throw error;
  }
}

// Success response helper
export function createSuccessResponse(message, data = null) {
  const response = {
    content: [{
      type: 'text',
      text: message,
    }],
  };

  if (data) {
    response.content.push({
      type: 'text',
      text: `\nData: ${JSON.stringify(data, null, 2)}`,
    });
  }

  return response;
}