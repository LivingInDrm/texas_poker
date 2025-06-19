import request from 'supertest';
import express from 'express';
import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, MockDataConfigurator, ApiTestHelper, TypeScriptCompatibility } from '../shared/testDataGenerator';

// Create mocks first
const mockPrisma = MockFactory.createPrismaMock();
const mockRedis = MockFactory.createRedisMock();
const mockUserStateService = MockFactory.createUserStateServiceMock();

// Mock dependencies before importing modules
jest.mock('@prisma/client');
jest.mock('../../src/prisma', () => mockPrisma);
jest.mock('../../src/db', () => ({
  redisClient: mockRedis
}));
jest.mock('../../src/services/userStateService', () => ({
  userStateService: mockUserStateService
}));
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', username: 'testuser' };
    next();
  })
}));

describe('Room Routes', () => {
  let app: express.Application;
  let mocks: any;
  let testData: any;

  beforeAll(() => {
    // Create comprehensive mock setup
    mocks = {
      prisma: mockPrisma,
      redis: mockRedis,
      userStateService: mockUserStateService
    };
    
    testData = {
      currentUser: TestDataGenerator.createUserData({
        id: 'test-user-id',
        username: 'testuser'
      }),
      room: TestDataGenerator.createRoomData('test-user-id', {
        id: 'room-123',
        playerLimit: 6,
        bigBlind: 20,
        smallBlind: 10,
        status: 'WAITING'
      }),
      roomOwner: TestDataGenerator.createUserData({
        id: 'test-user-id',
        username: 'testuser'
      }),
      roomState: TestDataGenerator.createRedisRoomStateData({
        id: 'room-123',
        ownerId: 'test-user-id',
        currentPlayers: 1, // Use currentPlayers instead of currentPlayerCount
        players: [{
          id: 'test-user-id',
          username: 'testuser',
          chips: 5000,
          position: 0,
          isOwner: true
        }]
      })
    };

    // Configure mocks
    MockDataConfigurator.configureAllMocks(mocks, testData);

    // Mock authentication middleware
    const mockAuth = require('../../src/middleware/auth');
    mockAuth.authenticateToken = jest.fn((req: any, res: any, next: any) => {
      req.user = testData.currentUser;
      next();
    });

    // Create test app
    app = express();
    app.use(express.json());
    
    // Import and use routes after mocking
    const roomRoutes = require('../../src/routes/room').default;
    app.use('/api/room', roomRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset default mock behaviors
    mocks.prisma.room.create.mockResolvedValue({
      ...testData.room,
      owner: testData.roomOwner
    });
    mocks.prisma.room.findUnique.mockResolvedValue({
      ...testData.room,
      owner: testData.roomOwner
    });
    mocks.prisma.room.findMany.mockResolvedValue([{
      ...testData.room,
      owner: testData.roomOwner
    }]);
    mocks.prisma.room.count.mockResolvedValue(1);
    mocks.redis.setEx.mockResolvedValue('OK');
    mocks.redis.get.mockResolvedValue(JSON.stringify(testData.roomState));
    mocks.redis.del.mockResolvedValue(1);
    mocks.userStateService.setUserCurrentRoom.mockResolvedValue(undefined);
    mocks.userStateService.getUserCurrentRoom.mockResolvedValue(null);
    mocks.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
  });

  describe('POST /create', () => {
    it('should create a room successfully', async () => {
      // Mock the created room to have a password
      mocks.prisma.room.create.mockResolvedValue({
        ...testData.room,
        password: 'test123',
        owner: testData.roomOwner
      });

      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({
          playerLimit: 6,
          bigBlind: 20,
          smallBlind: 10,
          password: 'test123'
        });

      expect(response.status).toBe(201);
      expect(response.body.room).toMatchObject({
        id: testData.room.id,
        ownerId: testData.room.ownerId,
        playerLimit: 6,
        currentPlayers: 1,
        bigBlind: 20,
        smallBlind: 10,
        hasPassword: true,
        status: 'WAITING'
      });

      expect(mocks.prisma.room.create).toHaveBeenCalledWith({
        data: {
          ownerId: testData.currentUser.id,
          playerLimit: 6,
          password: 'test123',
          bigBlind: 20,
          smallBlind: 10,
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

      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        `room:${testData.room.id}`,
        3600,
        expect.stringContaining(testData.currentUser.username)
      );

      expect(mocks.userStateService.setUserCurrentRoom).toHaveBeenCalledWith(
        testData.currentUser.id,
        testData.room.id
      );
    });

    it('should validate player limit bounds', async () => {
      const invalidLimits = [1, 10, 0, -1];
      
      for (const limit of invalidLimits) {
        const response = await request(app)
          .post('/api/room/create')
          .set('Authorization', 'Bearer valid-token')
          .send({
            playerLimit: limit,
            bigBlind: 20,
            smallBlind: 10
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Player limit must be between 2 and 9');
      }
    });

    it('should validate blind sizes', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({
          playerLimit: 6,
          bigBlind: 10,
          smallBlind: 20 // Big blind smaller than small blind
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Big blind must be greater than small blind');
    });

    it('should handle authentication failure', async () => {
      const mockAuth = require('../../src/middleware/auth');
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/room/create')
        .send({
          playerLimit: 6,
          bigBlind: 20,
          smallBlind: 10
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');

      // Restore mock
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = testData.currentUser;
        next();
      });
    });

    it('should handle database errors', async () => {
      mocks.prisma.room.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send({
          playerLimit: 6,
          bigBlind: 20,
          smallBlind: 10
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('GET /list', () => {
    it('should return room list with pagination', async () => {
      const response = await request(app)
        .get('/api/room/list?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.rooms).toHaveLength(1);
      expect(response.body.rooms[0]).toMatchObject({
        id: testData.room.id,
        ownerId: testData.room.ownerId,
        playerLimit: testData.room.playerLimit,
        currentPlayers: 1, // Redis returns current players from room state
        hasPassword: false,
        status: 'WAITING'
      });

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      });

      expect(mocks.prisma.room.findMany).toHaveBeenCalledWith({
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
        skip: 0,
        take: 10
      });
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/room/list?page=2&limit=5');

      expect(response.status).toBe(200);
      expect(mocks.prisma.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5
        })
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mocks.redis.get.mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .get('/api/room/list');

      // The current implementation doesn't handle Redis errors in the map function
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle invalid Redis data', async () => {
      mocks.redis.get.mockResolvedValue('invalid-json');

      const response = await request(app)
        .get('/api/room/list');

      // The current implementation doesn't handle JSON parse errors
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle database errors', async () => {
      mocks.prisma.room.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/room/list');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('POST /join', () => {
    it('should join a room successfully', async () => {
      // Mock room state with only the owner, not the current user
      const roomStateWithOwnerOnly = {
        ...testData.roomState,
        currentPlayers: 1,
        players: [{
          id: 'owner-user-id', // Different from current user
          username: 'owner',
          chips: 5000,
          position: 0,
          isOwner: true
        }]
      };
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomStateWithOwnerOnly));

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'room-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.room).toMatchObject({
        id: testData.room.id,
        currentPlayers: 2 // Should be incremented
      });

      expect(mocks.userStateService.getUserCurrentRoom).toHaveBeenCalledWith(testData.currentUser.id);
      expect(mocks.prisma.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'room-123' },
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

      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        'room:room-123',
        3600,
        expect.stringContaining(testData.currentUser.username)
      );

      expect(mocks.userStateService.setUserCurrentRoom).toHaveBeenCalledWith(
        testData.currentUser.id,
        'room-123'
      );
    });

    it('should require room ID', async () => {
      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Room ID is required');
    });

    it('should prevent joining when already in another room', async () => {
      mocks.userStateService.getUserCurrentRoom.mockResolvedValue('other-room');

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'room-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('You are already in another room');
      expect(response.body.currentRoom).toBe('other-room');
    });

    it('should handle room not found', async () => {
      mocks.prisma.room.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'nonexistent-room'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Room not found');
    });

    it('should handle ended room', async () => {
      mocks.prisma.room.findUnique.mockResolvedValue({
        ...testData.room,
        status: 'ENDED',
        owner: testData.roomOwner
      });

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'room-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Room has ended');
    });

    it('should validate password', async () => {
      mocks.prisma.room.findUnique.mockResolvedValue({
        ...testData.room,
        password: 'secret123',
        owner: testData.roomOwner
      });

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'room-123',
          password: 'wrong-password'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Incorrect password');
    });

    it('should handle full room', async () => {
      const fullRoomState = {
        ...testData.roomState,
        currentPlayers: 6,
        playerLimit: 6,
        players: Array.from({ length: 6 }, (_, i) => ({
          id: `player-${i}`,
          username: `player${i}`,
          chips: 5000,
          position: i,
          isOwner: i === 0
        }))
      };
      mocks.redis.get.mockResolvedValue(JSON.stringify(fullRoomState));

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'room-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Room is full');
    });

    it('should prevent joining same room twice', async () => {
      const roomStateWithUser = {
        ...testData.roomState,
        players: [
          ...testData.roomState.players,
          {
            id: testData.currentUser.id,
            username: testData.currentUser.username,
            chips: 5000,
            position: 1,
            isOwner: false
          }
        ]
      };
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomStateWithUser));

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'room-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('You are already in this room');
    });

    it('should rebuild room state from database when Redis is empty', async () => {
      mocks.redis.get.mockResolvedValue(null);
      
      // Mock the room with the owner being a different user
      mocks.prisma.room.findUnique.mockResolvedValue({
        ...testData.room,
        ownerId: 'owner-user-id', // Different from current user
        owner: {
          id: 'owner-user-id',
          username: 'owner',
          avatar: null
        }
      });

      const response = await request(app)
        .post('/api/room/join')
        .set('Authorization', 'Bearer valid-token')
        .send({
          roomId: 'room-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.room.currentPlayers).toBe(2); // Owner + new player
    });
  });

  describe('DELETE /:id', () => {
    it('should delete room successfully', async () => {
      const response = await request(app)
        .delete('/api/room/room-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Room deleted successfully');

      expect(mocks.prisma.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'room-123' }
      });

      expect(mocks.prisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room-123' },
        data: { status: 'ENDED' }
      });

      expect(mocks.redis.del).toHaveBeenCalledWith('room:room-123');
      expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith(testData.currentUser.id);
    });

    it('should handle room not found', async () => {
      mocks.prisma.room.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/room/nonexistent-room')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Room not found');
    });

    it('should prevent non-owner from deleting room', async () => {
      mocks.prisma.room.findUnique.mockResolvedValue({
        ...testData.room,
        ownerId: 'different-user-id'
      });

      const response = await request(app)
        .delete('/api/room/room-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Only room owner can delete the room');
    });

    it('should handle database errors', async () => {
      mocks.prisma.room.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/room/room-123')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('Security and Validation', () => {
    it('should require authentication for all endpoints', async () => {
      const mockAuth = require('../../src/middleware/auth');
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Token missing' });
      });

      const endpoints = [
        { method: 'post', path: '/api/room/create', data: { playerLimit: 6 } },
        { method: 'post', path: '/api/room/join', data: { roomId: 'room-123' } },
        { method: 'delete', path: '/api/room/room-123', data: {} }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).send(endpoint.data);
        expect(response.status).toBe(401);
      }

      // Restore mock
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = testData.currentUser;
        next();
      });
    });

    it('should sanitize and validate input data', async () => {
      const maliciousData = {
        playerLimit: 1, // Invalid player limit
        password: '../../etc/passwd',
        bigBlind: 20,
        smallBlind: 10
      };

      const response = await request(app)
        .post('/api/room/create')
        .set('Authorization', 'Bearer valid-token')
        .send(maliciousData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Player limit must be between 2 and 9');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent room creation', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/room/create')
          .set('Authorization', 'Bearer valid-token')
          .send({
            playerLimit: 6,
            bigBlind: 20,
            smallBlind: 10
          })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should use efficient database queries', async () => {
      await request(app)
        .get('/api/room/list?page=1&limit=10');

      expect(mocks.prisma.room.findMany).toHaveBeenCalledWith({
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
        skip: 0,
        take: 10
      });

      // Verify only necessary fields are selected
      const selectObj = mocks.prisma.room.findMany.mock.calls[0][0].include.owner.select;
      expect(selectObj).toEqual({
        id: true,
        username: true,
        avatar: true
      });
    });
  });
});