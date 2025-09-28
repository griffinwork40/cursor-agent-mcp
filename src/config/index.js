// Environment variables validation and configuration
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  cursor: {
    apiKey: process.env.CURSOR_API_KEY,
    apiUrl: process.env.CURSOR_API_URL || 'https://api.cursor.com',
  },
  logging: {
    cursorClientDebug: process.env.CURSOR_CLIENT_DEBUG === 'true',
  },
  token: {
    secret: process.env.TOKEN_SECRET,
    ttlDays: Number(process.env.TOKEN_TTL_DAYS || 30),
  },
};

// Note: Global CURSOR_API_KEY is optional now.
// For hosted deployments (e.g., Railway) we support per-request API keys.
// If running in STDIO/local mode, a global key will still be required by the caller.

if (!config.token.secret) {
  console.warn('TOKEN_SECRET not set - token-based connections will be ephemeral per process and cannot be revoked across restarts.');
  console.warn('For Railway deployment, set TOKEN_SECRET environment variable to a secure random string (32+ characters).');
}