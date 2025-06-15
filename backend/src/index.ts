import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabases, pgClient, redisClient } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const pgResult = await pgClient.query('SELECT NOW()');
    const redisResult = await redisClient.ping();
    
    res.json({ 
      status: 'ok', 
      message: 'Texas Poker Backend is running!',
      timestamp: new Date().toISOString(),
      databases: {
        postgres: pgResult.rows[0],
        redis: redisResult
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const startServer = async () => {
  try {
    await connectDatabases();
    
    app.listen(PORT, () => {
      console.log(`🃏 Texas Poker Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();