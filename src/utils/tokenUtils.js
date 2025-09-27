// Token utilities for zero-storage flow
// Purpose: encrypt/decrypt the user's Cursor API key into a compact token
// AES-256-GCM with random IV; secret loaded from config

import crypto from 'crypto';
import { config } from '../config/index.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard

function getKey() {
  if (!config.token.secret) {
    // Derive a process-local key to avoid crashes, but warn in config
    console.warn('TOKEN_SECRET not set - token-based connections will be ephemeral per process and cannot be revoked across restarts.');
    return crypto.createHash('sha256').update('insecure-default-secret').digest();
  }
  // Hash the provided secret to 32-byte key
  return crypto.createHash('sha256').update(String(config.token.secret)).digest();
}

export function mintTokenFromApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error('API key required to mint token');
  }

  const ttlMs = config.token.ttlDays * 24 * 60 * 60 * 1000;
  const payload = {
    k: apiKey,
    exp: ttlMs <= 0 ? Date.now() - 1 : Date.now() + ttlMs, // Immediately expired for zero/negative TTL
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
    if (Date.now() > payload.exp) {
      return null; // expired
    }
    return payload.k;
  } catch (e) {
    return null;
  }
}

