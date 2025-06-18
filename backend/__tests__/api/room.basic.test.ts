import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import * as Redis from 'redis';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('redis');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

// Create mock implementations
const mockPrisma = {
  room: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  }
} as unknown as PrismaClient;

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

(PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma);
(Redis.createClient as jest.Mock).mockReturnValue(mockRedis);

// Extend Request interface for user property
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    username: string;
  };
}

// Create simplified room routes for testing
const createRoomRoutes = (prisma: any, redisClient: any) => {
  const router = express.Router();

  // Authentication middleware mock
  const authenticateToken = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, 'test-secret', (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      req.user = { id: decoded.userId, username: decoded.username };
      next();
    });
  };

  // POST /create
  router.post('/create', authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { playerLimit, password, bigBlind, smallBlind } = req.body;
      const { id: userId, username } = req.user!;

      // Validation
      if (!playerLimit || playerLimit < 2 || playerLimit > 9) {
        return res.status(400).json({ 
          success: false, 
          message: 'Player limit must be between 2 and 9' 
        });
      }

      if (bigBlind && smallBlind && bigBlind <= smallBlind) {
        return res.status(400).json({ 
          success: false, 
          message: 'Big blind must be greater than small blind' 
        });
      }

      // Hash password if provided
      let hashedPassword: string | null = null;
      if (password && password.trim() !== '') {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Create room
      const room = await prisma.room.create({
        data: {
          ownerId: userId,
          playerLimit: playerLimit || 6,
          password: hashedPassword,
          bigBlind: bigBlind || 20,
          smallBlind: smallBlind || 10,
          status: 'WAITING'
        }
      });

      // Create room state in Redis
      const roomState = {
        id: room.id,
        ownerId: room.ownerId,
        players: [{
          id: userId,
          username: username,
          chips: 5000,
          position: 0,
          isOwner: true,
          status: 'ACTIVE'
        }],
        status: 'WAITING',
        maxPlayers: room.playerLimit,
        currentPlayerCount: 1,
        hasPassword: !!hashedPassword,
        bigBlind: room.bigBlind,
        smallBlind: room.smallBlind,
        gameStarted: false,
        createdAt: new Date().toISOString()
      };

      await redisClient.set(
        `room:${room.id}`,
        JSON.stringify(roomState),
        'EX',
        3600
      );

      res.status(201).json({
        success: true,
        message: 'Room created successfully',
        data: { room }
      });

    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  // GET /list
  router.get('/list', async (req: express.Request, res: express.Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const rooms = await prisma.room.findMany({
        where: { status: { in: ['WAITING', 'PLAYING'] } },
        include: { owner: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      });

      const total = await prisma.room.count({
        where: { status: { in: ['WAITING', 'PLAYING'] } }
      });

      // Get room states from Redis
      const roomsWithState = await Promise.all(
        rooms.map(async (room: any) => {
          const roomStateStr = await redisClient.get(`room:${room.id}`);
          let currentPlayerCount = 0;
          if (roomStateStr) {
            const roomState = JSON.parse(roomStateStr);
            currentPlayerCount = roomState.currentPlayerCount || 0;
          }
          return {
            ...room,
            currentPlayerCount,
            hasPassword: !!room.password
          };
        })
      );

      res.json({
        success: true,
        data: {
          rooms: roomsWithState,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Get room list error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  // POST /join
  router.post('/join', authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { roomId, password } = req.body;
      const { id: userId, username } = req.user!;

      if (!roomId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Room ID is required' 
        });
      }

      // Check if room exists
      const room = await prisma.room.findUnique({
        where: { id: roomId }
      });

      if (!room) {
        return res.status(404).json({ 
          success: false, 
          message: 'Room not found' 
        });
      }

      // Check password
      if (room.password) {
        const passwordMatch = await bcrypt.compare(password || '', room.password);
        if (!passwordMatch) {
          return res.status(403).json({ 
            success: false, 
            message: 'Incorrect room password' 
          });
        }
      }

      // Get room state from Redis
      const roomStateStr = await redisClient.get(`room:${roomId}`);
      if (!roomStateStr) {
        return res.status(404).json({ 
          success: false, 
          message: 'Room state not found' 
        });
      }

      const roomState = JSON.parse(roomStateStr);

      // Check if player already in room
      const existingPlayer = roomState.players.find((p: any) => p.id === userId);
      if (existingPlayer) {
        return res.status(400).json({ 
          success: false, 
          message: 'You are already in this room' 
        });
      }

      // Check room capacity
      if (roomState.currentPlayerCount >= roomState.maxPlayers) {
        return res.status(400).json({ 
          success: false, 
          message: 'Room is full' 
        });
      }

      // Add player to room
      roomState.players.push({
        id: userId,
        username: username,
        chips: 5000,
        position: roomState.players.length,
        isOwner: false,
        status: 'ACTIVE'
      });
      roomState.currentPlayerCount = roomState.players.length;
      roomState.lastActivity = new Date().toISOString();

      // Update Redis
      await redisClient.set(
        `room:${roomId}`,
        JSON.stringify(roomState),
        'EX',
        3600
      );

      res.json({
        success: true,
        message: 'Successfully joined room'
      });

    } catch (error) {
      console.error('Join room error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  // DELETE /:id
  router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const roomId = req.params.id;
      const { id: userId } = req.user!;

      // Check if room exists and user is owner
      const room = await prisma.room.findUnique({
        where: { id: roomId }
      });

      if (!room) {
        return res.status(404).json({ 
          success: false, 
          message: 'Room not found' 
        });
      }

      if (room.ownerId !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Only room owner can delete the room' 
        });
      }

      // Update room status
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'ENDED' }
      });

      // Delete from Redis
      await redisClient.del(`room:${roomId}`);

      res.json({
        success: true,
        message: 'Room deleted successfully'
      });

    } catch (error) {
      console.error('Delete room error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  return router;
};

describe('Room Management API Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Setup Express app with routes
    app = express();
    app.use(express.json());

    // Mock JWT verification
    (jwt.verify as jest.Mock).mockImplementation((token: string, secret: string, callback: Function) => {
      if (token === 'valid-token') {
        callback(null, { userId: 'user-123', username: 'testuser' });
      } else {
        callback(new Error('Invalid token'));
      }
    });

    // Add routes to app
    const roomRoutes = createRoomRoutes(mockPrisma, mockRedis);
    app.use('/api/room', roomRoutes);
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/room/create', () => {
    const validCreatePayload = {
      playerLimit: 6,
      password: 'test123',
      bigBlind: 20,
      smallBlind: 10
    };

    it('should create a room successfully with valid data', async () => {
      // Mock room creation
      const mockRoom = {
        id: 'room-123',
        ownerId: 'user-123',
        playerLimit: 6,
        password: 'hashed-password',
        status: 'WAITING',
        bigBlind: 20,
        smallBlind: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      (mockPrisma.room.create as jest.Mock).mockResolvedValue(mockRoom);

      // Mock password hashing
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      // Mock Redis operations
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send(validCreatePayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.room).toMatchObject({
        id: 'room-123',
        ownerId: 'user-123',
        playerLimit: 6,
        status: 'WAITING'
      });

      // Verify Prisma was called correctly
      expect(mockPrisma.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerId: 'user-123',
          playerLimit: 6,
          bigBlind: 20,
          smallBlind: 10
        })
      });

      // Verify Redis state was set
      expect(mockRedis.set).toHaveBeenCalledWith(
        'room:room-123',
        expect.stringContaining('"id":"room-123"'),
        'EX',
        3600
      );
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .send(validCreatePayload);

      expect(response.status).toBe(401);
    });

    it('should fail with invalid player limit (too low)', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCreatePayload, playerLimit: 1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Player limit must be between 2 and 9');
    });

    it('should fail with invalid blind amounts', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ 
          ...validCreatePayload, 
          bigBlind: 10, 
          smallBlind: 20 
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Big blind must be greater than small blind');
    });
  });

  describe('GET /api/room/list', () => {
    it('should return paginated room list', async () => {
      const mockRooms = [
        {
          id: 'room-1',
          ownerId: 'user-1',
          playerLimit: 6,
          status: 'WAITING',
          password: null,
          createdAt: new Date(),
          owner: { username: 'user1' }
        }
      ];

      (mockPrisma.room.findMany as jest.Mock).mockResolvedValue(mockRooms);
      (mockPrisma.room.count as jest.Mock).mockResolvedValue(1);
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify({
        currentPlayerCount: 2
      }));

      const response = await request(app)
        .get('/api/room/list')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms).toHaveLength(1);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      });
    });
  });

  describe('POST /api/room/join', () => {
    it('should join a room successfully', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-456',  // Different owner
        password: null,
        status: 'WAITING'
      });

      const roomState = {
        id: 'room-123',
        players: [{ id: 'user-456', username: 'owner' }],  // Different owner
        currentPlayerCount: 1,
        maxPlayers: 6
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(roomState));
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ roomId: 'room-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail when room is full', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: null,
        status: 'WAITING'
      });

      const roomState = {
        id: 'room-123',
        players: new Array(6).fill({ id: 'user' }),
        currentPlayerCount: 6,
        maxPlayers: 6
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(roomState));

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ roomId: 'room-123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Room is full');
    });
  });

  describe('DELETE /api/room/:id', () => {
    it('should delete room successfully by owner', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-123',
        status: 'WAITING'
      });

      (mockPrisma.room.update as jest.Mock).mockResolvedValue({
        id: 'room-123',
        status: 'ENDED'
      });

      (mockRedis.del as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/room/room-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Room deleted successfully');
    });

    it('should fail when user is not the owner', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        ownerId: 'different-user',
        status: 'WAITING'
      });

      const response = await request(app)
        .delete('/api/room/room-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only room owner can delete the room');
    });
  });
});