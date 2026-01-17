#!/usr/bin/env node

/**
 * Test script to create a background agent via the API
 * 
 * Usage:
 *   CURSOR_API_KEY=your_key REPO_URL=https://github.com/user/repo node test-create-agent.js
 * 
 * Or set environment variables:
 *   export CURSOR_API_KEY=your_key
 *   export REPO_URL=https://github.com/user/repo
 *   node test-create-agent.js
 */

import { config } from './src/config/index.js';
import { createCursorApiClient } from './src/utils/cursorClient.js';
import { createTools } from './src/tools/index.js';

// Get parameters from command line or environment
const args = process.argv.slice(2);
const repoUrl = process.env.REPO_URL || args[0];
const prompt = process.env.PROMPT || args[1] || 'Add a simple README.md file with project description';
const model = process.env.MODEL || args[2] || 'auto';
const branch = process.env.BRANCH || args[3] || 'main';

async function testCreateAgent() {
  console.log('🚀 Testing createAgent via API...\n');

  // Check if API key is set
  const apiKey = process.env.CURSOR_API_KEY || config.cursor.apiKey;
  if (!apiKey) {
    console.error('❌ Error: CURSOR_API_KEY not set');
    console.error('   Set it with: export CURSOR_API_KEY=your_key_here');
    console.error('   Or pass as: CURSOR_API_KEY=key node test-create-agent.js');
    process.exit(1);
  }

  // Check if repo URL is provided
  if (!repoUrl) {
    console.error('❌ Error: Repository URL not provided');
    console.error('\nUsage:');
    console.error('  CURSOR_API_KEY=key REPO_URL=https://github.com/user/repo node test-create-agent.js');
    console.error('  Or: node test-create-agent.js <repo-url> [prompt] [model] [branch]');
    console.error('\nExample:');
    console.error('  CURSOR_API_KEY=key_xxx REPO_URL=https://github.com/user/my-repo node test-create-agent.js');
    process.exit(1);
  }

  try {
    console.log('📋 Configuration:');
    console.log(`   Repository: ${repoUrl}`);
    console.log(`   Branch: ${branch}`);
    console.log(`   Model: ${model}`);
    console.log(`   Prompt: ${prompt}\n`);

    // Create client and tools
    const client = createCursorApiClient(apiKey);
    const tools = createTools(client);

    // Find the createAgent tool
    const createAgentTool = tools.find(t => t.name === 'createAgent');
    if (!createAgentTool) {
      console.error('❌ Error: createAgent tool not found');
      process.exit(1);
    }

    console.log('📞 Calling createAgent...\n');
    
    // Prepare the agent creation payload
    const payload = {
      prompt: {
        text: prompt
      },
      model: model,
      source: {
        repository: repoUrl,
        ref: branch
      },
      target: {
        autoCreatePr: true,
        branchName: `agent/test-${Date.now()}`
      }
    };

    console.log('📦 Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\n');

    // Call the tool
    const result = await createAgentTool.handler(payload);
    
    // Parse the result
    const content = result.content?.[0]?.text || result;
    const data = result.data || result;
    
    console.log('✅ Response:');
    console.log('─'.repeat(60));
    console.log(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    console.log('─'.repeat(60));
    
    if (data?.agentId) {
      console.log('\n🎉 Agent created successfully!');
      console.log(`   Agent ID: ${data.agentId}`);
      console.log(`   Status: ${data.status}`);
      if (data.url) {
        console.log(`   View: ${data.url}`);
      }
      console.log('\n💡 Next steps:');
      console.log('   - Use getAgent to check status:');
      console.log(`     node test-mcp-client.js (then select getAgent and enter ID: ${data.agentId})`);
      console.log('   - Or use the Cursor UI to monitor progress');
    }
    
  } catch (error) {
    console.error('\n❌ Error creating agent:');
    console.error(error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.cause) {
      console.error('   Cause:', error.cause.message);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testCreateAgent();
