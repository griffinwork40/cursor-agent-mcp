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
  schemas,
} from '../utils/errorHandler.js';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    test('should create validation error with message', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBeNull();
    });

    test('should create validation error with field', () => {
      const error = new ValidationError('Invalid email', 'email');
      expect(error.message).toBe('Invalid email');
      expect(error.field).toBe('email');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ApiError', () => {
    test('should create API error with default values', () => {
      const error = new ApiError('Server error');
      expect(error.message).toBe('Server error');
      expect(error.name).toBe('ApiError');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBeNull();
    });

    test('should create API error with custom values', () => {
      const error = new ApiError('Not found', 404, 'NOT_FOUND');
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('AuthenticationError', () => {
    test('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Invalid or missing API key');
      expect(error.name).toBe('AuthenticationError');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    test('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Token expired');
      expect(error.message).toBe('Token expired');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('AuthorizationError', () => {
    test('should create authorization error with default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Insufficient permissions');
      expect(error.name).toBe('AuthorizationError');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('NotFoundError', () => {
    test('should create not found error with default message', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('NotFoundError');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('RateLimitError', () => {
    test('should create rate limit error with default message', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.name).toBe('RateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('ConflictError', () => {
    test('should create conflict error with default message', () => {
      const error = new ConflictError();
      expect(error.message).toBe('Conflict with current state');
      expect(error.name).toBe('ConflictError');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });
});

describe('handleMCPError', () => {
  test('should handle ValidationError', () => {
    const error = new ValidationError('Invalid input', 'email');
    const result = handleMCPError(error, 'test');
    
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Validation Error: Invalid input');
    expect(result.content[0].text).toContain('(field: email)');
  });

  test('should handle ApiError', () => {
    const error = new ApiError('Server error', 500, 'INTERNAL_ERROR');
    const result = handleMCPError(error, 'test');
    
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('API Error (500): Server error');
    expect(result.content[0].text).toContain('[INTERNAL_ERROR]');
  });

  test('should handle Axios response error', () => {
    const axiosError = {
      response: {
        status: 401,
        data: {
          error: {
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          },
        },
      },
    };
    
    const result = handleMCPError(axiosError, 'test');
    
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('API Error (401): Unauthorized');
    expect(result.content[0].text).toContain('[UNAUTHORIZED]');
  });

  test('should handle Axios network error', () => {
    const networkError = {
      request: {},
      message: 'Network Error',
    };
    
    const result = handleMCPError(networkError, 'test');
    
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Network Error: Unable to connect to Cursor API');
  });

  test('should handle generic error', () => {
    const genericError = new Error('Something went wrong');
    const result = handleMCPError(genericError, 'test');
    
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Unexpected Error: Something went wrong');
  });
});

describe('validateInput', () => {
  test('should validate correct input', () => {
    const schema = schemas.agentId;
    const result = validateInput(schema, 'test-agent-id', 'test');
    expect(result).toBe('test-agent-id');
  });

  test('should throw ValidationError for invalid input', () => {
    const schema = schemas.agentId;
    expect(() => {
      validateInput(schema, '', 'test');
    }).toThrow(ValidationError);
  });

  test('should include context in error message', () => {
    const schema = schemas.agentId;
    expect(() => {
      validateInput(schema, '', 'createAgent');
    }).toThrow('Validation failed in createAgent');
  });
});

describe('createSuccessResponse', () => {
  test('should create success response with message only', () => {
    const result = createSuccessResponse('Operation successful');
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Operation successful');
  });

  test('should create success response with message and data', () => {
    const data = { id: 'test-id', status: 'active' };
    const result = createSuccessResponse('Operation successful', data);
    
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Operation successful');
    expect(result.content[1].type).toBe('text');
    expect(result.content[1].text).toContain('Data:');
    expect(result.content[1].text).toContain('"id": "test-id"');
    expect(result.content[1].text).toContain('"status": "active"');
  });
});

describe('Validation Schemas', () => {
  describe('imageDimension', () => {
    test('should validate correct image dimensions', () => {
      const validData = { width: 100, height: 200 };
      const result = schemas.imageDimension.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should reject invalid dimensions', () => {
      expect(() => {
        schemas.imageDimension.parse({ width: 0, height: 200 });
      }).toThrow();
    });
  });

  describe('image', () => {
    test('should validate correct image data', () => {
      const validData = { data: 'base64data', dimension: { width: 100, height: 200 } };
      const result = schemas.image.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should reject empty image data', () => {
      expect(() => {
        schemas.image.parse({ data: '' });
      }).toThrow();
    });
  });

  describe('prompt', () => {
    test('should validate correct prompt', () => {
      const validData = { text: 'Test prompt' };
      const result = schemas.prompt.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should validate prompt with images', () => {
      const validData = {
        text: 'Test prompt',
        images: [{ data: 'base64data' }],
      };
      const result = schemas.prompt.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should reject empty prompt text', () => {
      expect(() => {
        schemas.prompt.parse({ text: '' });
      }).toThrow();
    });

    test('should reject too many images', () => {
      const images = Array(6).fill({ data: 'base64data' });
      expect(() => {
        schemas.prompt.parse({ text: 'Test', images });
      }).toThrow();
    });
  });

  describe('source', () => {
    test('should validate correct source', () => {
      const validData = { repository: 'https://github.com/user/repo' };
      const result = schemas.source.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should validate source with ref', () => {
      const validData = {
        repository: 'https://github.com/user/repo',
        ref: 'main',
      };
      const result = schemas.source.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should reject empty repository', () => {
      expect(() => {
        schemas.source.parse({ repository: '' });
      }).toThrow();
    });
  });

  describe('webhook', () => {
    test('should validate correct webhook', () => {
      const validData = { url: 'https://example.com/webhook' };
      const result = schemas.webhook.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should validate webhook with secret', () => {
      const validData = {
        url: 'https://example.com/webhook',
        secret: 'a'.repeat(32),
      };
      const result = schemas.webhook.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should reject invalid URL', () => {
      expect(() => {
        schemas.webhook.parse({ url: 'not-a-url' });
      }).toThrow();
    });

    test('should reject short secret', () => {
      expect(() => {
        schemas.webhook.parse({
          url: 'https://example.com/webhook',
          secret: 'short',
        });
      }).toThrow();
    });
  });

  describe('createAgentRequest', () => {
    test('should validate correct create agent request', () => {
      const validData = {
        prompt: { text: 'Test task' },
        model: 'default',
        source: { repository: 'https://github.com/user/repo' },
      };
      const result = schemas.createAgentRequest.parse(validData);
      expect(result.model).toBe('default');
      expect(result.prompt.text).toBe('Test task');
    });

    test('should use default model when not provided', () => {
      const validData = {
        prompt: { text: 'Test task' },
        source: { repository: 'https://github.com/user/repo' },
      };
      const result = schemas.createAgentRequest.parse(validData);
      expect(result.model).toBe('auto');
    });
  });

  describe('listAgentsParams', () => {
    test('should validate correct list agents params', () => {
      const validData = { limit: 10, cursor: 'next-cursor' };
      const result = schemas.listAgentsParams.parse(validData);
      expect(result).toEqual(validData);
    });

    test('should validate empty params', () => {
      const result = schemas.listAgentsParams.parse({});
      expect(result).toEqual({});
    });

    test('should reject limit over 100', () => {
      expect(() => {
        schemas.listAgentsParams.parse({ limit: 101 });
      }).toThrow();
    });

    test('should reject limit under 1', () => {
      expect(() => {
        schemas.listAgentsParams.parse({ limit: 0 });
      }).toThrow();
    });
  });
});