#!/usr/bin/env node

// Simple CLI to manage credentials and launch the MCP server
// - init: prompt for and save CURSOR_API_KEY (and optional CURSOR_API_URL)
// - stdio: start MCP server over stdio (for ChatGPT/Claude local runners)
// - http: start Express HTTP server (for remote hosting)
// - whoami: verify the stored key by calling /v0/me

import os from 'os';
import path from 'path';
import { mkdir, readFile, writeFile, stat } from 'fs/promises';
import fs from 'fs';
import readline from 'readline';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

function getConfigDir() {
  const platform = process.platform;
  if (platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'cursor-agent-mcp');
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'cursor-agent-mcp');
  }
  return path.join(os.homedir(), '.config', 'cursor-agent-mcp');
}

const CONFIG_DIR = getConfigDir();
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureConfigDir() {
  if (!(await pathExists(CONFIG_DIR))) {
    await mkdir(CONFIG_DIR, { recursive: true });
    try {
      if (process.platform !== 'win32') {
        fs.chmodSync(CONFIG_DIR, 0o700);
      }
    } catch (error) {
      // Ignore chmod errors on unsupported platforms
      console.warn('Could not set directory permissions:', error.message);
    }
  }
}

function generateMCPToken() {
  return 'mcp_' + crypto.randomBytes(32).toString('hex');
}

async function saveConfig({ apiKey, apiUrl, mcpToken }) {
  await ensureConfigDir();
  const existing = await loadConfigFromFile();
  const data = {
    CURSOR_API_KEY: apiKey,
    CURSOR_API_URL: apiUrl || 'https://api.cursor.com',
    MCP_SERVER_TOKEN: mcpToken || existing?.MCP_SERVER_TOKEN || generateMCPToken(),
  };
  await writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), { encoding: 'utf8' });
  try {
    if (process.platform !== 'win32') {
      fs.chmodSync(CONFIG_PATH, 0o600);
    }
  } catch (error) {
    // Ignore chmod errors on unsupported platforms
    console.warn('Could not set file permissions:', error.message);
  }
}

async function loadConfigFromFile() {
  if (await pathExists(CONFIG_PATH)) {
    try {
      const raw = await readFile(CONFIG_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      // Ignore file read/parse errors
      console.warn('Could not read config file:', error.message);
    }
  }
  return null;
}

async function loadConfig() {
  // Prefer env vars when set
  const envKey = process.env.CURSOR_API_KEY;
  const envUrl = process.env.CURSOR_API_URL;
  const envToken = process.env.MCP_SERVER_TOKEN;
  
  if (envKey) {
    return { 
      CURSOR_API_KEY: envKey, 
      CURSOR_API_URL: envUrl || 'https://api.cursor.com',
      MCP_SERVER_TOKEN: envToken,
    };
  }
  
  const fileConfig = await loadConfigFromFile();
  if (fileConfig && typeof fileConfig.CURSOR_API_KEY === 'string' && fileConfig.CURSOR_API_KEY.length > 0) {
    return { 
      CURSOR_API_KEY: fileConfig.CURSOR_API_KEY, 
      CURSOR_API_URL: fileConfig.CURSOR_API_URL || 'https://api.cursor.com',
      MCP_SERVER_TOKEN: fileConfig.MCP_SERVER_TOKEN,
    };
  }
  
  return null;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [k, v] = token.split('=');
      if (v !== undefined) {
        args[k.slice(2)] = v;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[k.slice(2)] = argv[++i];
      } else {
        args[k.slice(2)] = true;
      }
    }
  }
  return args;
}

async function promptHidden(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => {
    const onData = (char) => {
      char = char + '';
      switch (char) {
      case '\u0004':
      case '\r':
      case '\n':
        process.stdin.removeListener('data', onData);
        break;
      default:
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(question + ' ******');
        break;
      }
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function cmdInit(flags) {
  const key = flags.apiKey || flags['api-key'] || (await promptHidden('Enter CURSOR_API_KEY: '));
  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    console.error('Invalid API key.');
    process.exit(1);
  }
  const url = flags.apiUrl || flags['api-url'] || 'https://api.cursor.com';
  const mcpToken = flags.generateToken !== false ? generateMCPToken() : undefined;
  
  await saveConfig({ apiKey: key.trim(), apiUrl: url.trim(), mcpToken });
  
  console.log('✅ Saved credentials to local config with restricted permissions.');
  if (mcpToken) {
    console.log('🔐 Generated MCP server token for remote access.');
  }
}

async function ensureEnvFromConfig() {
  const cfg = await loadConfig();
  if (!cfg) {
    console.error('Missing CURSOR_API_KEY. Run: cursor-agent-mcp init');
    process.exit(1);
  }
  process.env.CURSOR_API_KEY = cfg.CURSOR_API_KEY;
  process.env.CURSOR_API_URL = cfg.CURSOR_API_URL || 'https://api.cursor.com';
  if (cfg.MCP_SERVER_TOKEN) {
    process.env.MCP_SERVER_TOKEN = cfg.MCP_SERVER_TOKEN;
  }
}

async function cmdStdio() {
  await ensureEnvFromConfig();
  await import('./mcp-server.js');
}

async function cmdHttp(flags) {
  await ensureEnvFromConfig();
  if (flags.port) {
    process.env.PORT = String(flags.port);
  }
  await import('./index.js');
}

async function cmdWhoAmI() {
  await ensureEnvFromConfig();
  const { cursorApiClient } = await import('./utils/cursorClient.js');
  try {
    const me = await cursorApiClient.getMe();
    console.log(JSON.stringify(me, null, 2));
  } catch (err) {
    console.error('Failed to call /v0/me. Check your key and network.');
    console.error(err?.message || String(err));
    process.exit(1);
  }
}

async function cmdShowConfig() {
  const cfg = await loadConfig();
  if (!cfg) {
    console.log('No configuration found. Run: cursor-agent-mcp init');
    return;
  }
  
  console.log('📋 Current Configuration:');
  console.log(`🔑 API Key: ${cfg.CURSOR_API_KEY ? '***' + cfg.CURSOR_API_KEY.slice(-8) : 'Not set'}`);
  console.log(`🌐 API URL: ${cfg.CURSOR_API_URL}`);
  console.log(`🔐 MCP Token: ${cfg.MCP_SERVER_TOKEN ? '***' + cfg.MCP_SERVER_TOKEN.slice(-8) : 'Not set'}`);
  
  if (cfg.MCP_SERVER_TOKEN) {
    console.log('\n📡 For ChatGPT remote access:');
    console.log('   1. Start HTTP server: cursor-agent-mcp http');
    console.log('   2. Expose via ngrok: ngrok http 3000');
    console.log('   3. Use URL: https://your-id.ngrok.io/sse');
    console.log(`   4. Add header: X-MCP-Auth: ${cfg.MCP_SERVER_TOKEN}`);
  }
}

function printHelp() {
  console.log(`
cursor-agent-mcp <command> [options]

Commands:
  init                        Prompt for and save CURSOR_API_KEY
  stdio                       Start MCP server over stdio
  http [--port 3000]          Start HTTP server (Express) with SSE endpoint
  whoami                      Verify stored credentials via /v0/me
  config                      Show current configuration

Options:
  --api-key <key>             Provide API key non-interactively (for init)
  --api-url <url>             Provide API URL (default: https://api.cursor.com)
  --port <number>             Port for http command
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'help';
  const flags = parseArgs(argv.slice(1));

  switch (cmd) {
  case 'init':
    await cmdInit(flags);
    break;
  case 'stdio':
    await cmdStdio();
    break;
  case 'http':
    await cmdHttp(flags);
    break;
  case 'whoami':
    await cmdWhoAmI();
    break;
  case 'config':
    await cmdShowConfig();
    break;
  case 'help':
  default:
    printHelp();
  }
}

const currentModulePath = fileURLToPath(import.meta.url);
const invokedFromCli = process.argv[1] && path.resolve(process.argv[1]) === currentModulePath;

if (invokedFromCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  getConfigDir,
  pathExists,
  ensureConfigDir,
  generateMCPToken,
  saveConfig,
  loadConfigFromFile,
  loadConfig,
  parseArgs,
  promptHidden,
  cmdInit,
  ensureEnvFromConfig,
  cmdStdio,
  cmdHttp,
  cmdWhoAmI,
  cmdShowConfig,
  printHelp,
  main,
  CONFIG_DIR,
  CONFIG_PATH,
};


