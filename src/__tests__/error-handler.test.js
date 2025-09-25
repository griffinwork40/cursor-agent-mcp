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
} from '../utils/errorHandler.js';
import { z } from 'zod';
import { jest } from '@jest/globals';

describe('Error Handler Utilities', () => {
  beforeEach(() => {
    // Reset console spy
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Custom Error Classes', () => {
    test('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid input', 'email');

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('email');
      expect(error.statusCode).toBe(400);
    });

    test('should create ApiError with correct properties', () => {
      const error = new ApiError('Internal server error', 500, 'INTERNAL_ERROR');

      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    test('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    test('should create AuthorizationError with default message', () => {
      const error = new AuthorizationError();

      expect(error.name).toBe('AuthorizationError');
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    test('should create NotFoundError with default message', () => {
      const error = new NotFoundError();

      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    test('should create RateLimitError with default message', () => {
      const error = new RateLimitError();

      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should create ConflictError with default message', () => {
      const error = new ConflictError();

      expect(error.name).toBe('ConflictError');
      expect(error.message).toBe('Conflict with current state');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('handleMCPError', () => {
    test('should handle ValidationError', () => {
      const error = new ValidationError('Email is required', 'email');
      const result = handleMCPError(error, 'test-context');

      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Validation Error');
      expect(result.content[0].text).toContain('Email is required');
      expect(result.content[0].text).toContain('field: email');
    });

    test('should handle ApiError', () => {
      const error = new ApiError('Database connection failed', 500, 'DB_ERROR');
      const result = handleMCPError(error, 'database');

      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('API Error (500)');
      expect(result.content[0].text).toContain('Database connection failed');
      expect(result.content[0].text).toContain('[DB_ERROR]');
    });

    test('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Token expired');
      const result = handleMCPError(error, 'auth');

      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('API Error (401)');
      expect(result.content[0].text).toContain('Token expired');
      expect(result.content[0].text).toContain('[UNAUTHORIZED]');
    });

    test('should handle Axios errors with response', () => {
      const axiosError = {
        name: 'AxiosError',
        message: 'Request failed with status 429',
        response: {
          status: 429,
          data: {
            error: {
              message: 'Too many requests',
              code: 'RATE_LIMITED',
            },
          },
        },
      };

      const result = handleMCPError(axiosError, 'api-call');

      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('API Error (429)');
      expect(result.content[0].text).toContain('Too many requests');
      expect(result.content[0].text).toContain('[RATE_LIMIT_EXCEEDED]');
    });

    test('should handle Axios errors with network issues', () => {
      const axiosError = {
        name: 'AxiosError',
        message: 'Network Error',
        request: {},
      };

      const result = handleMCPError(axiosError, 'network-call');

      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Network Error');
      expect(result.content[0].text).toContain('Unable to connect to Cursor API');
    });

    test('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      const result = handleMCPError(genericError, 'unknown');

      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Unexpected Error');
      expect(result.content[0].text).toContain('Something went wrong');
    });
  });

  describe('validateInput', () => {
    test('should validate valid input successfully', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0),
      });

      const validInput = {
        name: 'John Doe',
        age: 25,
      };

      const result = validateInput(schema, validInput, 'user');
      expect(result).toEqual(validInput);
    });

    test('should throw ValidationError for invalid input', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0).max(120),
      });

      const invalidInput = {
        email: 'invalid-email',
        age: 150,
      };

      expect(() => {
        validateInput(schema, invalidInput, 'user');
      }).toThrow(ValidationError);

      try {
        validateInput(schema, invalidInput, 'user');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Validation failed in user');
        expect(error.message).toContain('email: Invalid email');
        expect(error.message).toContain('age: Number must be less than or equal to 120');
      }
    });

    test('should throw ValidationError for missing required fields', () => {
      const schema = z.object({
        requiredField: z.string(),
        optionalField: z.string().optional(),
      });

      const invalidInput = {};

      expect(() => {
        validateInput(schema, invalidInput);
      }).toThrow(ValidationError);

      try {
        validateInput(schema, invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('requiredField: Required');
      }
    });

    test('should throw ValidationError for wrong type', () => {
      const schema = z.object({
        count: z.number(),
      });

      const invalidInput = {
        count: 'not a number',
      };

      expect(() => {
        validateInput(schema, invalidInput);
      }).toThrow(ValidationError);

      try {
        validateInput(schema, invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('count: Expected number, received string');
      }
    });
  });

  describe('createSuccessResponse', () => {
    test('should create success response with message only', () => {
      const message = 'Operation completed successfully';
      const result = createSuccessResponse(message);

      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toBe(message);
    });

    test('should create success response with message and data', () => {
      const message = 'User created successfully';
      const data = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      };
      const result = createSuccessResponse(message, data);

      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toBe(message);
      expect(result.content[1]).toHaveProperty('type', 'text');
      expect(result.content[1].text).toContain('Data:');
      expect(result.content[1].text).toContain('"id": "123"');
      expect(result.content[1].text).toContain('"name": "John Doe"');
    });

    test('should format data as pretty JSON', () => {
      const message = 'Results retrieved';
      const data = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
        total: 2,
      };
      const result = createSuccessResponse(message, data);

      expect(result.content[1].text).toContain('[\n    {\n      "id": 1,\n      "name": "Item 1"\n    },');
    });
  });

  describe('Zod Schemas', () => {
    let schemas;

    beforeAll(async () => {
      const { schemas: importedSchemas } = await import('../utils/errorHandler.js');
      schemas = importedSchemas;
    });

    test('should validate image dimension schema', () => {
      const { imageDimension } = schemas;

      const valid = { width: 1920, height: 1080 };
      expect(() => validateInput(imageDimension, valid)).not.toThrow();

      const invalidWidth = { width: 0, height: 1080 };
      expect(() => validateInput(imageDimension, invalidWidth)).toThrow(ValidationError);

      const invalidHeight = { width: 1920, height: -1 };
      expect(() => validateInput(imageDimension, invalidHeight)).toThrow(ValidationError);
    });

    test('should validate image schema', () => {
      const { image } = schemas;

      const valid = { data: 'base64data' };
      expect(() => validateInput(image, valid)).not.toThrow();

      const validWithDimension = {
        data: 'base64data',
        dimension: { width: 1920, height: 1080 }
      };
      expect(() => validateInput(image, validWithDimension)).not.toThrow();

      const invalid = { data: '' };
      expect(() => validateInput(image, invalid)).toThrow(ValidationError);
    });

    test('should validate prompt schema', () => {
      const { prompt } = schemas;

      const valid = { text: 'Create a background agent' };
      expect(() => validateInput(prompt, valid)).not.toThrow();

      const validWithImages = {
        text: 'Create agent with images',
        images: [
          { data: 'base64image1' },
          { data: 'base64image2', dimension: { width: 100, height: 100 } },
        ],
      };
      expect(() => validateInput(prompt, validWithImages)).not.toThrow();

      const tooManyImages = {
        text: 'Too many images',
        images: Array(6).fill({ data: 'base64data' }),
      };
      expect(() => validateInput(prompt, tooManyImages)).toThrow(ValidationError);
    });
  });
});