import { Client } from 'pg';
import { createClient } from 'redis';

const pgClient = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'texas_poker',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

export const connectDatabases = async () => {
  try {
    await pgClient.connect();
    console.log('✅ PostgreSQL connected');
    
    await redisClient.connect();
    console.log('✅ Redis connected');
    
    return { pgClient, redisClient };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export { pgClient, redisClient };