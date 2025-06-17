import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import * as Redis from 'redis';

// Import the modules to test
import roomRoutes from '../../src/routes/room';
import { authenticateToken } from '../../src/middleware/auth';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('redis');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

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
  del: jest.fn(),
  exists: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

(PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma);
(Redis.createClient as jest.Mock).mockReturnValue(mockRedis);

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
      // Mock user exists
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        username: 'testuser'
      });

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
        expect.stringContaining('"id":"room-123"')
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

    it('should fail with invalid player limit (too high)', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCreatePayload, playerLimit: 10 });

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
          smallBlind: 20 // Big blind smaller than small blind
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Big blind must be greater than small blind');
    });

    it('should create room without password', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        username: 'testuser'
      });

      const mockRoom = {
        id: 'room-123',
        ownerId: 'user-123',
        playerLimit: 6,
        password: null,
        status: 'WAITING',
        bigBlind: 20,
        smallBlind: 10
      };
      (mockPrisma.room.create as jest.Mock).mockResolvedValue(mockRoom);
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validCreatePayload, password: '' });

      expect(response.status).toBe(201);
      expect(bcrypt.hash).not.toHaveBeenCalled();
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
          bigBlind: 20,
          smallBlind: 10,
          password: null,
          createdAt: new Date(),
          owner: { username: 'user1' }
        },
        {
          id: 'room-2',
          ownerId: 'user-2',
          playerLimit: 4,
          status: 'PLAYING',
          bigBlind: 40,
          smallBlind: 20,
          password: 'hashed',
          createdAt: new Date(),
          owner: { username: 'user2' }
        }
      ];

      (mockPrisma.room.findMany as jest.Mock).mockResolvedValue(mockRooms);
      (mockPrisma.room.count as jest.Mock).mockResolvedValue(2);

      // Mock Redis to return room states
      (mockRedis.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'room:room-1') {
          return JSON.stringify({
            id: 'room-1',
            currentPlayerCount: 1,
            players: [{ id: 'user-1', username: 'user1' }]
          });
        }
        if (key === 'room:room-2') {
          return JSON.stringify({
            id: 'room-2',
            currentPlayerCount: 3,
            players: [
              { id: 'user-2', username: 'user2' },
              { id: 'user-3', username: 'user3' },
              { id: 'user-4', username: 'user4' }
            ]
          });
        }
        return null;
      });

      const response = await request(app)
        .get('/api/room/list')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms).toHaveLength(2);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      });

      // Check that Redis was called for each room
      expect(mockRedis.get).toHaveBeenCalledWith('room:room-1');
      expect(mockRedis.get).toHaveBeenCalledWith('room:room-2');
    });

    it('should handle pagination correctly', async () => {
      (mockPrisma.room.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.room.count as jest.Mock).mockResolvedValue(25);

      const response = await request(app)
        .get('/api/room/list')
        .query({ page: 3, limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 25,
        totalPages: 5
      });

      // Verify correct offset was used
      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['WAITING', 'PLAYING'] } },
        include: { owner: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: 10, // (page - 1) * limit = (3 - 1) * 5
        take: 5
      });
    });

    it('should use default pagination values', async () => {
      (mockPrisma.room.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.room.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/room/list');

      expect(response.status).toBe(200);
      expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['WAITING', 'PLAYING'] } },
        include: { owner: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: 0, // Default page 1
        take: 20 // Default limit
      });
    });
  });

  describe('POST /api/room/join', () => {
    const validJoinPayload = {
      roomId: 'room-123'
    };

    beforeEach(() => {
      // Mock user exists
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-456',
        username: 'joiner'
      });
    });

    it('should join a room successfully without password', async () => {
      // Mock room exists in database
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-123',
        playerLimit: 6,
        password: null,
        status: 'WAITING'
      });

      // Mock room state in Redis
      const roomState = {
        id: 'room-123',
        ownerId: 'user-123',
        players: [{ id: 'user-123', username: 'owner' }],
        currentPlayerCount: 1,
        maxPlayers: 6,
        hasPassword: false,
        status: 'WAITING'
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(roomState));
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send(validJoinPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully joined room');

      // Verify Redis state was updated
      expect(mockRedis.set).toHaveBeenCalledWith(
        'room:room-123',
        expect.stringContaining('"currentPlayerCount":2')
      );
    });

    it('should join a room successfully with correct password', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-123',
        playerLimit: 6,
        password: 'hashed-password',
        status: 'WAITING'
      });

      const roomState = {
        id: 'room-123',
        players: [{ id: 'user-123', username: 'owner' }],
        currentPlayerCount: 1,
        maxPlayers: 6,
        hasPassword: true,
        status: 'WAITING'
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(roomState));
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      // Mock password comparison
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validJoinPayload, password: 'correct-password' });

      expect(response.status).toBe(200);
      expect(bcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
    });

    it('should fail with wrong password', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: 'hashed-password',
        status: 'WAITING'
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validJoinPayload, password: 'wrong-password' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Incorrect room password');
    });

    it('should fail when room is full', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        playerLimit: 4,
        password: null,
        status: 'WAITING'
      });

      const roomState = {
        id: 'room-123',
        players: [
          { id: 'user-1' }, { id: 'user-2' }, 
          { id: 'user-3' }, { id: 'user-4' }
        ],
        currentPlayerCount: 4,
        maxPlayers: 4,
        status: 'WAITING'
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(roomState));

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send(validJoinPayload);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Room is full');
    });

    it('should fail when room does not exist', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send(validJoinPayload);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Room not found');
    });

    it('should fail when already in the room', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: null,
        status: 'WAITING'
      });

      const roomState = {
        id: 'room-123',
        players: [
          { id: 'user-123', username: 'owner' },
          { id: 'user-456', username: 'joiner' } // User already in room
        ],
        currentPlayerCount: 2,
        maxPlayers: 6,
        status: 'WAITING'
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(roomState));

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send(validJoinPayload);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('You are already in this room');
    });
  });

  describe('DELETE /api/room/:id', () => {
    it('should delete room successfully by owner', async () => {
      // Mock room exists and user is owner
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

      // Verify database update
      expect(mockPrisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room-123' },
        data: { status: 'ENDED' }
      });

      // Verify Redis cleanup
      expect(mockRedis.del).toHaveBeenCalledWith('room:room-123');
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

    it('should fail when room does not exist', async () => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/room/room-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Room not found');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .delete('/api/room/room-123');

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      (mockPrisma.room.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({
          playerLimit: 6,
          bigBlind: 20,
          smallBlind: 10
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Internal server error');
    });

    it('should handle Redis connection errors', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-123' });
      (mockPrisma.room.create as jest.Mock).mockResolvedValue({ id: 'room-123' });
      (mockRedis.set as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({
          playerLimit: 6,
          bigBlind: 20,
          smallBlind: 10
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Input Validation', () => {
    it('should validate UUID format for room ID', async () => {
      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ roomId: 'invalid-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid room ID format');
    });

    it('should validate required fields for room creation', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({}); // Empty payload

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    it('should validate numeric fields are numbers', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({
          playerLimit: 'not-a-number',
          bigBlind: 20,
          smallBlind: 10
        });

      expect(response.status).toBe(400);
    });
  });
});