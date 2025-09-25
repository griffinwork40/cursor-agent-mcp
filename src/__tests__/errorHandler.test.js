import {
  ValidationError,
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ConflictError,
  handleMCPError,
  validateInput,
  createSuccessResponse,
  schemas
} from '../utils/errorHandler.js';

// Mock console.error to avoid console output during tests
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Error Handler Utilities', () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Custom Error Classes', () => {
    test('ValidationError should create error with correct properties', () => {
      const message = 'Field is required';
      const field = 'username';
      const error = new ValidationError(message, field);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe(message);
      expect(error.field).toBe(field);
      expect(error.statusCode).toBe(400);
    });

    test('ValidationError should handle null field', () => {
      const message = 'Invalid input';
      const error = new ValidationError(message);

      expect(error.field).toBeNull();
      expect(error.statusCode).toBe(400);
    });

    test('ApiError should create error with correct properties', () => {
      const message = 'Internal server error';
      const statusCode = 500;
      const code = 'INTERNAL_ERROR';
      const error = new ApiError(message, statusCode, code);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.code).toBe(code);
    });

    test('ApiError should use default status code and null code', () => {
      const message = 'Default error';
      const error = new ApiError(message);

      expect(error.statusCode).toBe(500);
      expect(error.code).toBeNull();
    });

    test('AuthenticationError should create error with correct properties', () => {
      const message = 'Invalid credentials';
      const error = new AuthenticationError(message);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe(message);
    });

    test('AuthenticationError should use default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Invalid or missing API key');
    });

    test('AuthorizationError should create error with correct properties', () => {
      const message = 'Access denied';
      const error = new AuthorizationError(message);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('AuthorizationError');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe(message);
    });

    test('AuthorizationError should use default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Insufficient permissions');
    });

    test('NotFoundError should create error with correct properties', () => {
      const message = 'Resource not found';
      const error = new NotFoundError(message);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('NotFoundError');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe(message);
    });

    test('NotFoundError should use default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
    });

    test('RateLimitError should create error with correct properties', () => {
      const message = 'Too many requests';
      const error = new RateLimitError(message);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('RateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.message).toBe(message);
    });

    test('RateLimitError should use default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
    });

    test('ConflictError should create error with correct properties', () => {
      const message = 'Resource already exists';
      const error = new ConflictError(message);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('ConflictError');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe(message);
    });

    test('ConflictError should use default message', () => {
      const error = new ConflictError();

      expect(error.message).toBe('Conflict with current state');
    });
  });

  describe('handleMCPError Function', () => {
    test('should handle ValidationError correctly', () => {
      const error = new ValidationError('Field is required', 'username');
      const context = 'test validation';
      const result = handleMCPError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `MCP Error in ${context}:`,
        expect.objectContaining({
          name: 'ValidationError',
          message: 'Field is required',
          statusCode: 400,
          stack: expect.any(String)
        })
      );

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Validation Error: Field is required (field: username)',
        }],
        isError: true,
      });
    });

    test('should handle ValidationError without field', () => {
      const error = new ValidationError('Invalid input');
      const result = handleMCPError(error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Validation Error: Invalid input',
        }],
        isError: true,
      });
    });

    test('should handle ApiError correctly', () => {
      const error = new ApiError('Internal error', 500, 'INTERNAL');
      const context = 'test api';
      const result = handleMCPError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `MCP Error in ${context}:`,
        expect.objectContaining({
          name: 'ApiError',
          message: 'Internal error',
          statusCode: 500,
          code: 'INTERNAL'
        })
      );

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (500): Internal error [INTERNAL]',
        }],
        isError: true,
      });
    });

    test('should handle ApiError without code', () => {
      const error = new ApiError('Simple error', 500);
      const result = handleMCPError(error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (500): Simple error',
        }],
        isError: true,
      });
    });

    test('should handle AuthenticationError correctly', () => {
      const error = new AuthenticationError('Invalid API key');
      const result = handleMCPError(error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (401): Invalid API key [UNAUTHORIZED]',
        }],
        isError: true,
      });
    });

    test('should handle AuthorizationError correctly', () => {
      const error = new AuthorizationError('Access denied');
      const result = handleMCPError(error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (403): Access denied [FORBIDDEN]',
        }],
        isError: true,
      });
    });

    test('should handle NotFoundError correctly', () => {
      const error = new NotFoundError('Resource not found');
      const result = handleMCPError(error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (404): Resource not found [NOT_FOUND]',
        }],
        isError: true,
      });
    });

    test('should handle RateLimitError correctly', () => {
      const error = new RateLimitError('Too many requests');
      const result = handleMCPError(error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (429): Too many requests [RATE_LIMIT_EXCEEDED]',
        }],
        isError: true,
      });
    });

    test('should handle ConflictError correctly', () => {
      const error = new ConflictError('Resource already exists');
      const result = handleMCPError(error);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (409): Resource already exists [CONFLICT]',
        }],
        isError: true,
      });
    });

    test('should handle Axios response errors and map to appropriate error types', () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            error: {
              message: 'Bad request',
              code: 'INVALID_REQUEST'
            }
          }
        }
      };

      const result = handleMCPError(axiosError, 'test axios');

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (400): Bad request [INVALID_REQUEST]',
        }],
        isError: true,
      });
    });

    test('should handle Axios 401 response error', () => {
      const axiosError = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Unauthorized',
              code: 'UNAUTHORIZED'
            }
          }
        }
      };

      const result = handleMCPError(axiosError);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (401): Unauthorized [UNAUTHORIZED]',
        }],
        isError: true,
      });
    });

    test('should handle Axios 403 response error', () => {
      const axiosError = {
        response: {
          status: 403,
          data: {
            error: {
              message: 'Forbidden',
              code: 'FORBIDDEN'
            }
          }
        }
      };

      const result = handleMCPError(axiosError);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (403): Forbidden [FORBIDDEN]',
        }],
        isError: true,
      });
    });

    test('should handle Axios 404 response error', () => {
      const axiosError = {
        response: {
          status: 404,
          data: {
            error: {
              message: 'Not found',
              code: 'NOT_FOUND'
            }
          }
        }
      };

      const result = handleMCPError(axiosError);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (404): Not found [NOT_FOUND]',
        }],
        isError: true,
      });
    });

    test('should handle Axios 409 response error', () => {
      const axiosError = {
        response: {
          status: 409,
          data: {
            error: {
              message: 'Conflict',
              code: 'CONFLICT'
            }
          }
        }
      };

      const result = handleMCPError(axiosError);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (409): Conflict [CONFLICT]',
        }],
        isError: true,
      });
    });

    test('should handle Axios 429 response error', () => {
      const axiosError = {
        response: {
          status: 429,
          data: {
            error: {
              message: 'Rate limited',
              code: 'RATE_LIMIT'
            }
          }
        }
      };

      const result = handleMCPError(axiosError);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (429): Rate limited [RATE_LIMIT_EXCEEDED]',
        }],
        isError: true,
      });
    });

    test('should handle Axios response error with default status code', () => {
      const axiosError = {
        response: {
          status: 502,
          data: {
            error: {
              message: 'Bad gateway',
              code: 'BAD_GATEWAY'
            }
          }
        }
      };

      const result = handleMCPError(axiosError);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (502): Bad gateway [BAD_GATEWAY]',
        }],
        isError: true,
      });
    });

    test('should handle Axios response error without error data', () => {
      const axiosError = {
        response: {
          status: 500,
          data: {}
        },
        message: 'Server error'
      };

      const result = handleMCPError(axiosError);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'API Error (500): Server error',
        }],
        isError: true,
      });
    });

    test('should handle network errors (no response, has request)', () => {
      const networkError = {
        request: {},
        message: 'Network Error'
      };

      const result = handleMCPError(networkError, 'test network');

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Network Error: Unable to connect to Cursor API. Please check your internet connection and API key.',
        }],
        isError: true,
      });
    });

    test('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');

      const result = handleMCPError(genericError, 'test generic');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `MCP Error in test generic:`,
        expect.objectContaining({
          name: 'Error',
          message: 'Something went wrong',
          stack: expect.any(String)
        })
      );

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Unexpected Error: Something went wrong',
        }],
        isError: true,
      });
    });

    test('should handle errors without context parameter', () => {
      const error = new ValidationError('Test error');

      const result = handleMCPError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'MCP Error in :',
        expect.objectContaining({
          name: 'ValidationError',
          message: 'Test error',
          statusCode: 400
        })
      );

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Validation Error: Test error',
        }],
        isError: true,
      });
    });
  });

  describe('Validation Schemas and validateInput Function', () => {
    test('should validate imageDimension schema correctly', () => {
      const validData = { width: 100, height: 200 };
      const result = validateInput(schemas.imageDimension, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for invalid imageDimension', () => {
      const invalidData = { width: -1, height: 0 };

      expect(() => {
        validateInput(schemas.imageDimension, invalidData);
      }).toThrow(ValidationError);

      try {
        validateInput(schemas.imageDimension, invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Validation failed');
        expect(error.message).toContain('Width must be a positive integer');
        expect(error.message).toContain('Height must be a positive integer');
      }
    });

    test('should validate image schema correctly', () => {
      const validData = {
        data: 'base64image',
        dimension: { width: 100, height: 200 }
      };
      const result = validateInput(schemas.image, validData);
      expect(result).toEqual(validData);
    });

    test('should validate image schema without dimension', () => {
      const validData = { data: 'base64image' };
      const result = validateInput(schemas.image, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for empty image data', () => {
      const invalidData = { data: '' };

      expect(() => {
        validateInput(schemas.image, invalidData);
      }).toThrow(ValidationError);
    });

    test('should validate prompt schema correctly', () => {
      const validData = {
        text: 'Create a component',
        images: [
          { data: 'image1' },
          { data: 'image2', dimension: { width: 100, height: 200 } }
        ]
      };
      const result = validateInput(schemas.prompt, validData);
      expect(result).toEqual(validData);
    });

    test('should validate prompt schema without images', () => {
      const validData = { text: 'Simple prompt' };
      const result = validateInput(schemas.prompt, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for empty prompt text', () => {
      const invalidData = { text: '' };

      expect(() => {
        validateInput(schemas.prompt, invalidData);
      }).toThrow(ValidationError);
    });

    test('should throw ValidationError for too many images in prompt', () => {
      const invalidData = {
        text: 'Prompt',
        images: Array(6).fill({ data: 'image' })
      };

      expect(() => {
        validateInput(schemas.prompt, invalidData);
      }).toThrow(ValidationError);
    });

    test('should validate source schema correctly', () => {
      const validData = {
        repository: 'https://github.com/user/repo',
        ref: 'main'
      };
      const result = validateInput(schemas.source, validData);
      expect(result).toEqual(validData);
    });

    test('should validate source schema without ref', () => {
      const validData = { repository: 'https://github.com/user/repo' };
      const result = validateInput(schemas.source, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for empty repository', () => {
      const invalidData = { repository: '' };

      expect(() => {
        validateInput(schemas.source, invalidData);
      }).toThrow(ValidationError);
    });

    test('should validate target schema correctly', () => {
      const validData = {
        autoCreatePr: true,
        branchName: 'feature-branch'
      };
      const result = validateInput(schemas.target, validData);
      expect(result).toEqual(validData);
    });

    test('should validate target schema with minimal data', () => {
      const validData = {};
      const result = validateInput(schemas.target, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for empty branch name', () => {
      const invalidData = { branchName: '' };

      expect(() => {
        validateInput(schemas.target, invalidData);
      }).toThrow(ValidationError);
    });

    test('should validate webhook schema correctly', () => {
      const validData = {
        url: 'https://example.com/webhook',
        secret: 'a'.repeat(32)
      };
      const result = validateInput(schemas.webhook, validData);
      expect(result).toEqual(validData);
    });

    test('should validate webhook schema without secret', () => {
      const validData = { url: 'https://example.com/webhook' };
      const result = validateInput(schemas.webhook, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for invalid webhook URL', () => {
      const invalidData = { url: 'not-a-url' };

      expect(() => {
        validateInput(schemas.webhook, invalidData);
      }).toThrow(ValidationError);
    });

    test('should throw ValidationError for webhook secret too short', () => {
      const invalidData = {
        url: 'https://example.com/webhook',
        secret: 'short'
      };

      expect(() => {
        validateInput(schemas.webhook, invalidData);
      }).toThrow(ValidationError);
    });

    test('should throw ValidationError for webhook URL too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2049);
      const invalidData = { url: longUrl };

      expect(() => {
        validateInput(schemas.webhook, invalidData);
      }).toThrow(ValidationError);

      try {
        validateInput(schemas.webhook, invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Validation failed');
        expect(error.message).toContain('Webhook URL too long');
      }
    });

    test('should validate createAgentRequest schema correctly', () => {
      const validData = {
        prompt: { text: 'Create component' },
        model: 'claude-3-5-sonnet-20241022',
        source: { repository: 'https://github.com/user/repo' },
        target: { autoCreatePr: true, branchName: 'feature' },
        webhook: { url: 'https://example.com/webhook' }
      };
      const result = validateInput(schemas.createAgentRequest, validData);
      expect(result).toEqual({
        ...validData,
        model: validData.model // Should preserve custom model
      });
    });

    test('should validate createAgentRequest with default model', () => {
      const validData = {
        prompt: { text: 'Create component' },
        source: { repository: 'https://github.com/user/repo' }
      };
      const result = validateInput(schemas.createAgentRequest, validData);
      expect(result.model).toBe('auto'); // Default model
    });

    test('should validate createAgentRequest without optional fields', () => {
      const validData = {
        prompt: { text: 'Create component' },
        source: { repository: 'https://github.com/user/repo' }
      };
      const result = validateInput(schemas.createAgentRequest, validData);
      expect(result).toEqual({
        ...validData,
        model: 'auto'
      });
    });

    test('should validate addFollowupRequest schema correctly', () => {
      const validData = {
        prompt: { text: 'Add more features' }
      };
      const result = validateInput(schemas.addFollowupRequest, validData);
      expect(result).toEqual(validData);
    });

    test('should validate listAgentsParams schema correctly', () => {
      const validData = {
        limit: 50,
        cursor: 'cursor123'
      };
      const result = validateInput(schemas.listAgentsParams, validData);
      expect(result).toEqual(validData);
    });

    test('should validate listAgentsParams without optional fields', () => {
      const validData = {};
      const result = validateInput(schemas.listAgentsParams, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for invalid limit in listAgentsParams', () => {
      const invalidData = { limit: 0 };

      expect(() => {
        validateInput(schemas.listAgentsParams, invalidData);
      }).toThrow(ValidationError);
    });

    test('should validate agentId schema correctly', () => {
      const validData = 'agent-123';
      const result = validateInput(schemas.agentId, validData);
      expect(result).toEqual(validData);
    });

    test('should throw ValidationError for empty agentId', () => {
      const invalidData = '';

      expect(() => {
        validateInput(schemas.agentId, invalidData);
      }).toThrow(ValidationError);
    });

    test('should pass through non-ZodError exceptions', () => {
      const originalError = new Error('Some other error');

      // Create a mock schema that throws a non-ZodError
      const mockSchema = {
        parse: () => { throw originalError; }
      };

      expect(() => {
        validateInput(mockSchema, {});
      }).toThrow(originalError);
    });

    test('should include context in validation error message', () => {
      const context = 'agent creation';

      expect(() => {
        validateInput(schemas.createAgentRequest, {
          prompt: { text: '' },
          source: { repository: 'https://github.com/user/repo' }
        }, context);
      }).toThrow(ValidationError);

      try {
        validateInput(schemas.createAgentRequest, {
          prompt: { text: '' },
          source: { repository: 'https://github.com/user/repo' }
        }, context);
      } catch (error) {
        expect(error.message).toContain(`in ${context}`);
      }
    });
  });

  describe('createSuccessResponse Function', () => {
    test('should create success response with message only', () => {
      const message = 'Operation completed successfully';
      const result = createSuccessResponse(message);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: message,
        }],
      });
    });

    test('should create success response with message and data', () => {
      const message = 'Data retrieved';
      const data = { id: 123, name: 'test' };
      const result = createSuccessResponse(message, data);

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: message,
          },
          {
            type: 'text',
            text: `\nData: ${JSON.stringify(data, null, 2)}`,
          },
        ],
      });
    });

    test('should create success response with null data', () => {
      const message = 'No data available';
      const result = createSuccessResponse(message, null);

      expect(result).toEqual({
        content: [{
          type: 'text',
          text: message,
        }],
      });
    });

    test('should format data correctly as JSON', () => {
      const message = 'Complex data';
      const data = {
        users: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' }
        ],
        total: 2
      };
      const result = createSuccessResponse(message, data);

      expect(result.content[1].text).toContain('"users": [');
      expect(result.content[1].text).toContain('"id": 1');
      expect(result.content[1].text).toContain('"name": "John"');
    });
  });
});