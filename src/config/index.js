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

// Validate required configuration
if (!config.cursor.apiKey) {
  throw new Error('CURSOR_API_KEY environment variable is required');
}