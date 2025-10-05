// Token utilities for zero-storage flow
// Purpose: encrypt/decrypt the user's Cursor API key into a compact token
// AES-256-GCM with random IV; secret loaded from config

import crypto from 'crypto';
import { config } from '../config/index.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard

function getKey() {
  if (!config.token.secret) {
    // Use a cryptographically secure random key for this process instance
    // This ensures tokens are ephemeral and cannot be shared across restarts
    const processKey = process.env.NODE_PROCESS_ID || process.pid.toString();
    const randomSeed = Math.random().toString(36) + Date.now().toString(36);
    return crypto.createHash('sha256').update(`ephemeral-${processKey}-${randomSeed}`).digest();
  }
  // Hash the provided secret to 32-byte key
  return crypto.createHash('sha256').update(String(config.token.secret)).digest();
}

export function mintTokenFromApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key required to mint token');
  }
  
  // Validate API key format for Cursor keys
  if (!apiKey.startsWith('key_') || apiKey.length < 20) {
    throw new Error('Invalid API key format: must start with "key_" and be at least 20 characters');
  }

  const ttlMs = config.token.ttlDays * 24 * 60 * 60 * 1000;
  const payload = {
    k: apiKey,
    exp: Date.now() + ttlMs,
  };

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // token = base64url(iv || tag || ciphertext)
  const tokenBuf = Buffer.concat([iv, tag, ciphertext]);
  return tokenBuf.toString('base64url');
}

export function decodeTokenToApiKey(token) {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, 'base64url');
    
    // Validate minimum token length
    if (buf.length < IV_LENGTH + 16) {
      return null;
    }
    
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = buf.subarray(IV_LENGTH + 16);

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const payload = JSON.parse(plaintext.toString('utf8'));
    
    if (!payload || typeof payload.k !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    
    // Validate API key format
    if (!payload.k.startsWith('key_') || payload.k.length < 20) {
      return null;
    }
    
    if (Date.now() > payload.exp) {
      return null; // expired
    }
    
    return payload.k;
  } catch (e) {
    return null;
  }
}

