// Jest setup file for MCP server tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.CURSOR_API_KEY = 'test_cursor_api_key';
process.env.TOKEN_SECRET = 'test_token_secret';
process.env.TOKEN_TTL_DAYS = '7';