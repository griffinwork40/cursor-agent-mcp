#!/usr/bin/env node

/**
 * Quick test script to verify listModels includes "auto"
 */

import { config } from './src/config/index.js';
import { createCursorApiClient } from './src/utils/cursorClient.js';
import { createTools } from './src/tools/index.js';

async function testListModels() {
  console.log('🧪 Testing listModels with "auto" option...\n');

  // Check if API key is set
  const apiKey = process.env.CURSOR_API_KEY || config.cursor.apiKey;
  if (!apiKey) {
    console.error('❌ Error: CURSOR_API_KEY not set');
    console.error('   Set it with: export CURSOR_API_KEY=your_key_here');
    process.exit(1);
  }

  try {
    // Create client and tools
    const client = createCursorApiClient(apiKey);
    const tools = createTools(client);

    // Find the listModels tool
    const listModelsTool = tools.find(t => t.name === 'listModels');
    if (!listModelsTool) {
      console.error('❌ Error: listModels tool not found');
      process.exit(1);
    }

    console.log('📞 Calling listModels tool...\n');
    
    // Call the tool
    const result = await listModelsTool.handler({});
    
    // Parse the result
    const content = result.content?.[0]?.text || result;
    const data = result.data || result;
    
    console.log('📋 Response:');
    console.log('─'.repeat(60));
    console.log(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    console.log('─'.repeat(60));
    
    // Check if "auto" is in the models list
    const models = data?.models || [];
    const hasAuto = models.includes('auto');
    
    console.log('\n🔍 Analysis:');
    console.log(`   Models returned: ${models.length}`);
    console.log(`   Includes "auto": ${hasAuto ? '✅ YES' : '❌ NO'}`);
    
    if (hasAuto) {
      console.log(`   "auto" position: #${models.indexOf('auto') + 1}`);
    }
    
    if (models.length > 0) {
      console.log(`\n📝 All models: ${models.join(', ')}`);
    }
    
    // Check the text output
    const textOutput = typeof content === 'string' ? content : JSON.stringify(content);
    const textHasAuto = textOutput.includes('auto');
    console.log(`\n   Text output mentions "auto": ${textHasAuto ? '✅ YES' : '❌ NO'}`);
    
    if (hasAuto && textHasAuto) {
      console.log('\n✅ SUCCESS: "auto" is now included in listModels!');
      process.exit(0);
    } else {
      console.log('\n❌ FAILURE: "auto" is missing from the response');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing listModels:');
    console.error(error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testListModels();
