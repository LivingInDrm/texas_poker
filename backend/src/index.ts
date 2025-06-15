import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabases, pgClient, redisClient } from './db';
import prisma from './prisma';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const pgResult = await pgClient.query('SELECT NOW()');
    const redisResult = await redisClient.ping();
    
    // 测试 Prisma 连接
    await prisma.$connect();
    const userCount = await prisma.user.count();
    
    res.json({ 
      status: 'ok', 
      message: 'Texas Poker Backend is running!',
      timestamp: new Date().toISOString(),
      databases: {
        postgres: pgResult.rows[0],
        redis: redisResult,
        prisma: {
          connected: true,
          userCount
        }
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

// 添加 Prisma CRUD 测试端点
app.get('/api/test/prisma', async (req, res) => {
  try {
    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        username: `test_user_${Date.now()}`,
        passwordHash: 'hashed_password_test',
        avatar: 'https://example.com/avatar.jpg'
      }
    });

    // 查询用户
    const foundUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    });

    // 创建测试房间
    const testRoom = await prisma.room.create({
      data: {
        ownerId: testUser.id,
        playerLimit: 6,
        password: 'test123'
      }
    });

    // 查询房间及关联用户
    const roomWithOwner = await prisma.room.findUnique({
      where: { id: testRoom.id },
      include: { owner: true }
    });

    // 创建游戏记录
    const gameRecord = await prisma.gameRecord.create({
      data: {
        roomId: testRoom.id,
        userId: testUser.id,
        chipsBefore: 5000,
        chipsAfter: 5500,
        chipsChange: 500,
        handResult: 'Pair of Aces',
        isWinner: true,
        gameData: {
          cards: ['AH', 'AS'],
          board: ['KD', 'QC', '7S', '3H', '2D'],
          actions: ['bet', 'call', 'raise']
        }
      }
    });

    // 清理测试数据
    await prisma.gameRecord.delete({ where: { id: gameRecord.id } });
    await prisma.room.delete({ where: { id: testRoom.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    res.json({
      status: 'success',
      message: 'Prisma CRUD operations completed successfully',
      testResults: {
        userCreated: !!testUser,
        userFound: !!foundUser,
        roomCreated: !!testRoom,
        roomWithOwner: !!roomWithOwner?.owner,
        gameRecordCreated: !!gameRecord,
        cleanupCompleted: true
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Prisma test failed',
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