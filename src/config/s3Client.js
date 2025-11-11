import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * AWS S3 Client Configuration
 * Uses AWS SDK v3 for better performance and modern JavaScript features
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Optional: Configure retry behavior
  maxAttempts: 3,
});

export default s3Client;
