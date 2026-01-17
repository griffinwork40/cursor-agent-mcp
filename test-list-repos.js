#!/usr/bin/env node

/**
 * Quick script to list available repositories
 */

import { config } from './src/config/index.js';
import { createCursorApiClient } from './src/utils/cursorClient.js';
import { createTools } from './src/tools/index.js';

async function listRepos() {
  const apiKey = process.env.CURSOR_API_KEY || config.cursor.apiKey;
  if (!apiKey) {
    console.error('❌ CURSOR_API_KEY not set');
    process.exit(1);
  }

  try {
    const client = createCursorApiClient(apiKey);
    const tools = createTools(client);
    const listReposTool = tools.find(t => t.name === 'listRepositories');
    
    const result = await listReposTool.handler({});
    const content = result.content?.[0]?.text || result;
    console.log(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listRepos();
