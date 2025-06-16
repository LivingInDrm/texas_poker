import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { userStateService } from '../services/userStateService';
import { redisClient } from '../db';
import prisma from '../prisma';

const router = express.Router();

// 管理员权限检查中间件
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // Note: This assumes you have a role field in your user model
    // If not, you can check by userId or another method
    // For now, we'll use a simple user ID check for admin users
    const adminUserIds = ['admin-user-id']; // Replace with actual admin user IDs
    
    if (!adminUserIds.includes(userId)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 获取用户状态概览
router.get('/user-states', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const keys = await redisClient.keys('user_room:*');
    const userStates = [];

    for (const key of keys) {
      const userId = key.replace('user_room:', '');
      const roomId = await redisClient.get(key);
      
      if (roomId) {
        // 验证房间是否存在
        const roomExists = await redisClient.exists(`room:${roomId}`);
        
        userStates.push({
          userId,
          roomId,
          roomExists: !!roomExists,
          key
        });
      }
    }

    res.json({
      totalUsers: userStates.length,
      userStates,
      summary: {
        validStates: userStates.filter(s => s.roomExists).length,
        orphanedStates: userStates.filter(s => !s.roomExists).length
      }
    });
  } catch (error) {
    console.error('Error getting user states:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取特定用户的状态
router.get('/user-states/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const currentRoom = await userStateService.getUserCurrentRoom(userId);
    const consistency = await userStateService.validateRoomStateConsistency(userId);
    
    let roomDetails = null;
    if (currentRoom) {
      const roomData = await redisClient.get(`room:${currentRoom}`);
      if (roomData) {
        const roomState = JSON.parse(roomData);
        const player = roomState.players.find((p: any) => p.id === userId);
        roomDetails = {
          roomState,
          playerInRoom: !!player,
          playerDetails: player
        };
      }
    }

    res.json({
      userId,
      currentRoom,
      consistency,
      roomDetails
    });
  } catch (error) {
    console.error('Error getting user state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 清理孤立的用户状态
router.post('/cleanup-orphaned-states', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await userStateService.cleanupOrphanedUserStates();
    
    res.json({
      message: 'Cleanup completed',
      ...result
    });
  } catch (error) {
    console.error('Error cleaning up orphaned states:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 强制清除用户状态
router.delete('/user-states/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const cleared = await userStateService.clearUserCurrentRoom(userId);
    
    res.json({
      message: cleared ? 'User state cleared successfully' : 'Failed to clear user state',
      userId,
      success: cleared
    });
  } catch (error) {
    console.error('Error clearing user state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取房间状态和用户一致性报告
router.get('/room-consistency/:roomId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    
    // 获取房间状态
    const roomData = await redisClient.get(`room:${roomId}`);
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomState = JSON.parse(roomData);
    const issues = [];
    const players = roomState.players || [];

    // 检查每个玩家的全局状态
    for (const player of players) {
      const userCurrentRoom = await userStateService.getUserCurrentRoom(player.id);
      
      if (userCurrentRoom !== roomId) {
        issues.push({
          playerId: player.id,
          playerName: player.username,
          issue: 'User global state does not match room',
          userCurrentRoom,
          expectedRoom: roomId
        });
      }
    }

    // 检查是否有用户引用了这个房间但不在玩家列表中
    const userRoomKeys = await redisClient.keys('user_room:*');
    for (const key of userRoomKeys) {
      const userId = key.replace('user_room:', '');
      const userRoomId = await redisClient.get(key);
      
      if (userRoomId === roomId) {
        const playerInRoom = players.find((p: any) => p.id === userId);
        if (!playerInRoom) {
          issues.push({
            playerId: userId,
            issue: 'User references room but not in player list',
            userCurrentRoom: userRoomId,
            expectedRoom: roomId
          });
        }
      }
    }

    res.json({
      roomId,
      roomState,
      consistencyCheck: {
        consistent: issues.length === 0,
        issues,
        playersCount: players.length,
        checkedUsers: players.length + userRoomKeys.length
      }
    });
  } catch (error) {
    console.error('Error checking room consistency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取系统统计信息
router.get('/stats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // 获取用户状态统计
    const userRoomKeys = await redisClient.keys('user_room:*');
    const roomKeys = await redisClient.keys('room:*');
    
    // 获取数据库统计
    const dbStats = await prisma.$transaction([
      prisma.room.count(),
      prisma.room.count({ where: { status: 'WAITING' } }),
      prisma.room.count({ where: { status: 'PLAYING' } }),
      prisma.user.count(),
    ]);

    res.json({
      redis: {
        userStates: userRoomKeys.length,
        rooms: roomKeys.length
      },
      database: {
        totalRooms: dbStats[0],
        waitingRooms: dbStats[1],
        playingRooms: dbStats[2],
        totalUsers: dbStats[3]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;