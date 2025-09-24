#!/usr/bin/env node

/**
 * Manual MCP Client for testing the Cursor MCP Server
 * 
 * This script simulates an MCP client making requests to your server.
 * Run with: node test-mcp-client.js
 */

import axios from 'axios';
import readline from 'readline';

const MCP_SERVER_URL = 'http://localhost:3000/mcp';

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to make MCP requests
async function makeMCPRequest(method, params = {}) {
  try {
    const response = await axios.post(MCP_SERVER_URL, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Request failed:', error.response?.data || error.message);
    return null;
  }
}

// Test functions for each tool
const tests = {
  async listTools() {
    console.log('\n🔧 Testing: List Available Tools');
    const result = await makeMCPRequest('tools/list');
    if (result) {
      console.log('✅ Available tools:');
      result.result.tools.forEach(tool => {
        console.log(`  • ${tool.name}: ${tool.description}`);
      });
    }
    return result;
  },

  async getMe() {
    console.log('\n🔑 Testing: Get API Key Info');
    const result = await makeMCPRequest('tools/call', {
      name: 'getMe',
      arguments: {}
    });
    if (result) {
      console.log('✅ API Key Info:', result.result.content[0].text);
    }
    return result;
  },

  async listModels() {
    console.log('\n🤖 Testing: List Available Models');
    const result = await makeMCPRequest('tools/call', {
      name: 'listModels',
      arguments: {}
    });
    if (result) {
      console.log('✅ Available Models:', result.result.content[0].text);
    }
    return result;
  },

  async listRepositories() {
    console.log('\n📁 Testing: List Repositories');
    const result = await makeMCPRequest('tools/call', {
      name: 'listRepositories',
      arguments: {}
    });
    if (result) {
      console.log('✅ Repositories:', result.result.content[0].text);
    }
    return result;
  },

  async listAgents() {
    console.log('\n📋 Testing: List Agents');
    const result = await makeMCPRequest('tools/call', {
      name: 'listAgents',
      arguments: { limit: 5 }
    });
    if (result) {
      console.log('✅ Agents:', result.result.content[0].text);
    }
    return result;
  },

  async createAgent() {
    console.log('\n🚀 Testing: Create Agent (with validation)');
    const result = await makeMCPRequest('tools/call', {
      name: 'createAgent',
      arguments: {
        prompt: {
          text: 'Add a README.md file with installation instructions'
        },
        source: {
          repository: 'https://github.com/test/repo'
        },
        model: 'auto'
      }
    });
    if (result) {
      console.log('✅ Agent Creation:', result.result.content[0].text);
    }
    return result;
  },

  async testValidation() {
    console.log('\n🧪 Testing: Input Validation (should fail)');
    const result = await makeMCPRequest('tools/call', {
      name: 'createAgent',
      arguments: {
        prompt: {
          text: '' // Empty text should fail validation
        },
        source: {
          repository: 'https://github.com/test/repo'
        }
      }
    });
    if (result) {
      console.log('✅ Validation Error:', result.result.content[0].text);
    }
    return result;
  }
};

// Interactive menu
function showMenu() {
  console.log('\n📋 MCP Client Test Menu:');
  console.log('1. List available tools');
  console.log('2. Get API key info');
  console.log('3. List available models');
  console.log('4. List repositories');
  console.log('5. List agents');
  console.log('6. Create agent (test)');
  console.log('7. Test validation (should fail)');
  console.log('8. Run all tests');
  console.log('9. Exit');
  console.log('\nEnter your choice (1-9):');
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running All MCP Tests...\n');
  
  await tests.listTools();
  await tests.getMe();
  await tests.listModels();
  await tests.listRepositories();
  await tests.listAgents();
  await tests.createAgent();
  await tests.testValidation();
  
  console.log('\n✅ All tests completed!');
}

// Main function
async function main() {
  console.log('🧪 MCP Client Test Suite');
  console.log('========================');
  console.log(`🔗 Server URL: ${MCP_SERVER_URL}`);
  console.log('📝 Make sure your MCP server is running on port 3000\n');

  // Check if server is running
  try {
    const healthCheck = await axios.get('http://localhost:3000/health');
    console.log('✅ Server is running:', healthCheck.data);
  } catch (error) {
    console.log('❌ Server is not running! Please start it with: npm start');
    process.exit(1);
  }

  // Interactive mode
  const askQuestion = () => {
    showMenu();
    rl.question('', async (answer) => {
      switch (answer.trim()) {
        case '1':
          await tests.listTools();
          askQuestion();
          break;
        case '2':
          await tests.getMe();
          askQuestion();
          break;
        case '3':
          await tests.listModels();
          askQuestion();
          break;
        case '4':
          await tests.listRepositories();
          askQuestion();
          break;
        case '5':
          await tests.listAgents();
          askQuestion();
          break;
        case '6':
          await tests.createAgent();
          askQuestion();
          break;
        case '7':
          await tests.testValidation();
          askQuestion();
          break;
        case '8':
          await runAllTests();
          askQuestion();
          break;
        case '9':
          console.log('👋 Goodbye!');
          rl.close();
          break;
        default:
          console.log('❌ Invalid choice. Please enter 1-9.');
          askQuestion();
      }
    });
  };

  askQuestion();
}

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  rl.close();
});

main().catch(console.error);