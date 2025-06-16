import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../prisma';
import { redisClient } from '../db';
import { userStateService } from '../services/userStateService';

const router = express.Router();

// 创建房间
router.post('/create', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { playerLimit, password, bigBlind, smallBlind } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const username = authReq.user?.username;
    
    if (!userId || !username) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // 验证参数
    if (!playerLimit || playerLimit < 2 || playerLimit > 9) {
      return res.status(400).json({ error: 'Player limit must be between 2 and 9' });
    }

    if (bigBlind && smallBlind && bigBlind <= smallBlind) {
      return res.status(400).json({ error: 'Big blind must be greater than small blind' });
    }

    // 创建房间
    const room = await prisma.room.create({
      data: {
        ownerId: userId,
        playerLimit: playerLimit || 6,
        password: password || null,
        bigBlind: bigBlind || 20,
        smallBlind: smallBlind || 10,
        status: 'WAITING'
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    // 初始化房间状态到 Redis
    const roomState = {
      id: room.id,
      ownerId: room.ownerId,
      playerLimit: room.playerLimit,
      currentPlayers: 1, // 房主自动加入
      players: [{
        id: userId,
        username: username,
        chips: 5000, // 默认筹码
        position: 0,
        isOwner: true
      }],
      status: 'WAITING',
      bigBlind: room.bigBlind,
      smallBlind: room.smallBlind,
      hasPassword: !!room.password,
      createdAt: new Date().toISOString()
    };

    await redisClient.setEx(`room:${room.id}`, 3600, JSON.stringify(roomState)); // 1小时过期
    
    // 设置用户全局状态
    await userStateService.setUserCurrentRoom(userId, room.id);

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: room.id,
        ownerId: room.ownerId,
        owner: room.owner,
        playerLimit: room.playerLimit,
        currentPlayers: 1,
        hasPassword: !!room.password,
        status: room.status,
        bigBlind: room.bigBlind,
        smallBlind: room.smallBlind,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取房间列表
router.get('/list', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // 从数据库获取房间基本信息
    const rooms = await prisma.room.findMany({
      where: {
        status: { in: ['WAITING', 'PLAYING'] }
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // 获取总数
    const total = await prisma.room.count({
      where: {
        status: { in: ['WAITING', 'PLAYING'] }
      }
    });

    // 从 Redis 获取房间实时状态
    const roomsWithState = await Promise.all(
      rooms.map(async (room) => {
        const roomStateStr = await redisClient.get(`room:${room.id}`);
        let currentPlayers = 0;
        
        if (roomStateStr) {
          const roomState = JSON.parse(roomStateStr);
          currentPlayers = roomState.currentPlayers || 0;
        }

        return {
          id: room.id,
          ownerId: room.ownerId,
          owner: room.owner,
          playerLimit: room.playerLimit,
          currentPlayers,
          hasPassword: !!room.password,
          status: room.status,
          bigBlind: room.bigBlind,
          smallBlind: room.smallBlind,
          createdAt: room.createdAt
        };
      })
    );

    res.json({
      rooms: roomsWithState,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get room list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 加入房间
router.post('/join', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { roomId, password } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const username = authReq.user?.username;

    if (!userId || !username) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    // 检查用户是否已在其他房间
    const currentRoomId = await userStateService.getUserCurrentRoom(userId);
    if (currentRoomId && currentRoomId !== roomId) {
      return res.status(400).json({ 
        error: 'You are already in another room. Please leave it first.',
        currentRoom: currentRoomId
      });
    }

    // 检查房间是否存在
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.status === 'ENDED') {
      return res.status(400).json({ error: 'Room has ended' });
    }

    // 检查密码
    if (room.password && room.password !== password) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // 从 Redis 获取房间状态
    let roomStateStr = await redisClient.get(`room:${roomId}`);
    let roomState;

    if (roomStateStr) {
      roomState = JSON.parse(roomStateStr);
    } else {
      // 如果 Redis 中没有，从数据库重建
      roomState = {
        id: room.id,
        ownerId: room.ownerId,
        playerLimit: room.playerLimit,
        currentPlayers: 1,
        players: [{
          id: room.ownerId,
          username: room.owner.username,
          chips: 5000,
          position: 0,
          isOwner: true
        }],
        status: room.status,
        bigBlind: room.bigBlind,
        smallBlind: room.smallBlind,
        hasPassword: !!room.password,
        createdAt: room.createdAt.toISOString()
      };
    }

    // 检查房间是否已满
    if (roomState.currentPlayers >= roomState.playerLimit) {
      return res.status(400).json({ error: 'Room is full' });
    }

    // 检查玩家是否已经在房间中
    const isPlayerInRoom = roomState.players.some((player: any) => player.id === userId);
    if (isPlayerInRoom) {
      return res.status(400).json({ error: 'You are already in this room' });
    }

    // 加入房间
    roomState.players.push({
      id: userId,
      username: username,
      chips: 5000, // 默认筹码
      position: roomState.currentPlayers,
      isOwner: false
    });
    roomState.currentPlayers += 1;

    // 更新 Redis
    await redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
    
    // 设置用户全局状态
    await userStateService.setUserCurrentRoom(userId, roomId);

    res.json({
      message: 'Joined room successfully',
      room: {
        id: room.id,
        ownerId: room.ownerId,
        owner: room.owner,
        playerLimit: room.playerLimit,
        currentPlayers: roomState.currentPlayers,
        hasPassword: !!room.password,
        status: room.status,
        bigBlind: room.bigBlind,
        smallBlind: room.smallBlind,
        players: roomState.players
      }
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 解散房间
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // 检查房间是否存在且用户是房主
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.ownerId !== userId) {
      return res.status(403).json({ error: 'Only room owner can delete the room' });
    }

    // 更新房间状态为已结束
    await prisma.room.update({
      where: { id: roomId },
      data: { status: 'ENDED' }
    });

    // 从 Redis 删除房间状态
    await redisClient.del(`room:${roomId}`);
    
    // 清除房主的全局状态
    await userStateService.clearUserCurrentRoom(userId);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;