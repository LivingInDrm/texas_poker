import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabases, pgClient, redisClient } from './db';
import prisma from './prisma';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import roomRoutes from './routes/room';
import adminRoutes from './routes/admin';
import { createSocketServer } from './socket/socketServer';
import { roomCleanupService } from './services/roomCleanupService';
import { roomScannerService } from './services/roomScannerService';
import { roomCleanupHelper } from './utils/roomCleanupHelper';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/admin', adminRoutes);

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

// 房间清理状态监控端点
app.get('/api/admin/room-cleanup-status', async (req, res) => {
  try {
    const cleanupStatus = roomCleanupService.getStatus();
    const roomStats = await roomScannerService.getRoomStatistics();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      cleanup: cleanupStatus,
      roomStats,
      helper: {
        ready: roomCleanupHelper.isReady()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get room cleanup status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 手动触发房间扫描端点
app.post('/api/admin/scan-rooms', async (req, res) => {
  try {
    const scanResult = await roomScannerService.scanAndCleanupEmptyRooms();
    
    res.json({
      status: 'ok',
      message: 'Room scan completed',
      timestamp: new Date().toISOString(),
      result: scanResult
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to scan rooms',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const startServer = async () => {
  try {
    await connectDatabases();
    
    // 初始化Socket.IO服务器
    const io = createSocketServer(httpServer);
    console.log('🔌 Socket.IO server initialized');
    
    // 设置房间清理助手的Socket.IO实例
    roomCleanupHelper.setSocketIOInstance(io);
    console.log('🧹 Room cleanup helper initialized');
    
    // 执行初始房间扫描和清理
    console.log('🔍 Starting initial room scan...');
    const scanResult = await roomScannerService.scanAndCleanupEmptyRooms();
    console.log('📊 Initial room scan completed:', {
      scanned: scanResult.scanned,
      emptyRooms: scanResult.emptyRooms,
      cleaned: scanResult.cleaned,
      errors: scanResult.errors.length
    });
    
    if (scanResult.errors.length > 0) {
      console.warn('⚠️ Room scan errors:', scanResult.errors);
    }
    
    // 获取房间清理服务状态
    const cleanupStatus = roomCleanupService.getStatus();
    console.log('🏠 Room cleanup service status:', cleanupStatus);
    
    httpServer.listen(PORT, () => {
      console.log(`🃏 Texas Poker Server running on port ${PORT}`);
      console.log(`🌐 HTTP server: http://localhost:${PORT}`);
      console.log(`⚡ WebSocket server: ws://localhost:${PORT}`);
      console.log(`🧹 Room cleanup enabled: ${cleanupStatus.enabled}`);
      console.log(`⏱️ Room cleanup delay: ${cleanupStatus.cleanupDelayMs}ms`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();