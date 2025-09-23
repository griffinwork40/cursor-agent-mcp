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
};

// Note: Global CURSOR_API_KEY is optional now.
// For hosted deployments (e.g., Railway) we support per-request API keys.
// If running in STDIO/local mode, a global key will still be required by the caller.