#!/usr/bin/env node

/**
 * Test script to demonstrate enhanced error handling
 * Run with: node test-error-handling.js
 */

import { 
  ValidationError, 
  AuthenticationError, 
  ApiError,
  handleMCPError,
  validateInput,
  schemas 
} from './src/utils/errorHandler.js';

console.log('🧪 Testing Enhanced Error Handling\n');

// Test 1: Validation Error
console.log('1️⃣ Testing Validation Error:');
try {
  validateInput(schemas.createAgentRequest, {
    prompt: { text: '' }, // Empty text should fail
    source: { repository: 'https://github.com/test/repo' }
  });
} catch (error) {
  const response = handleMCPError(error, 'test validation');
  console.log('Response:', JSON.stringify(response, null, 2));
}

console.log('\n2️⃣ Testing Authentication Error:');
const authError = new AuthenticationError('Invalid API key');
const authResponse = handleMCPError(authError, 'test auth');
console.log('Response:', JSON.stringify(authResponse, null, 2));

console.log('\n3️⃣ Testing API Error:');
const apiError = new ApiError('Rate limit exceeded', 429, 'RATE_LIMIT');
const apiResponse = handleMCPError(apiError, 'test api');
console.log('Response:', JSON.stringify(apiResponse, null, 2));

console.log('\n4️⃣ Testing Network Error (simulated):');
const networkError = {
  request: {},
  message: 'Network Error'
};
const networkResponse = handleMCPError(networkError, 'test network');
console.log('Response:', JSON.stringify(networkResponse, null, 2));

console.log('\n5️⃣ Testing Axios Response Error (simulated):');
const axiosError = {
  response: {
    status: 404,
    data: {
      error: {
        message: 'Agent not found',
        code: 'AGENT_NOT_FOUND'
      }
    }
  }
};
const axiosResponse = handleMCPError(axiosError, 'test axios');
console.log('Response:', JSON.stringify(axiosResponse, null, 2));

console.log('\n✅ Error handling tests completed!');