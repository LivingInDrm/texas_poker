import request from 'supertest';
import express from 'express';
import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, MockDataConfigurator, ApiTestHelper, TypeScriptCompatibility } from '../shared/testDataGenerator';

// Create mocks first
const mockPrisma = MockFactory.createPrismaMock();
const mockJwt = MockFactory.createJWTMock();

// Mock dependencies before importing modules
jest.mock('@prisma/client');
jest.mock('jsonwebtoken', () => mockJwt);
jest.mock('../../src/prisma', () => mockPrisma);
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', username: 'testuser' };
    next();
  })
}));

describe('User Routes', () => {
  let app: express.Application;
  let mocks: any;
  let testData: any;

  beforeAll(() => {
    // Create comprehensive mock setup
    mocks = {
      prisma: mockPrisma,
      jwt: mockJwt
    };
    
    testData = {
      currentUser: TestDataGenerator.createUserData({
        id: 'test-user-id',
        username: 'testuser',
        chips: 5000,
        gamesPlayed: 10,
        winRate: 0.65
      }),
      otherUser: TestDataGenerator.createUserData({
        id: 'other-user-id',
        username: 'otheruser'
      }),
      jwtPayload: TestDataGenerator.createJWTPayload({
        userId: 'test-user-id',
        username: 'testuser'
      })
    };

    // Configure mocks with proper user data
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: testData.currentUser.id,
      username: testData.currentUser.username,
      avatar: testData.currentUser.avatar,
      createdAt: testData.currentUser.createdAt,
      updatedAt: testData.currentUser.updatedAt
      // passwordHash deliberately excluded
    });
    
    MockDataConfigurator.configureAuthMocks(mocks, testData);

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
    const userRoutes = require('../../src/routes/user').default;
    app.use('/api/user', userRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /me', () => {
    it('should return current user information', async () => {
      // Configure mock to return only selected fields (matching Prisma select)
      mocks.prisma.user.findUnique.mockResolvedValue({
        id: testData.currentUser.id,
        username: testData.currentUser.username,
        avatar: testData.currentUser.avatar,
        createdAt: testData.currentUser.createdAt,
        updatedAt: testData.currentUser.updatedAt
        // Note: passwordHash is excluded per Prisma select
      });

      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: testData.currentUser.id,
        username: testData.currentUser.username,
        avatar: testData.currentUser.avatar
      });
      
      // Should not expose sensitive data
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should handle user not found', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('User not found');
    });

    it('should require authentication', async () => {
      // Mock auth middleware to reject
      const mockAuth = require('../../src/middleware/auth');
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/user/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');

      // Restore mock
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = testData.currentUser;
        next();
      });
    });

    it('should handle database errors', async () => {
      mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('PUT /me', () => {
    it('should update user profile successfully', async () => {
      const updatedUser = {
        ...testData.currentUser,
        avatar: 'new-avatar-url'
      };

      mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
      mocks.prisma.user.update.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/user/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          avatar: 'new-avatar-url'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.avatar).toBe('new-avatar-url');
      expect(mocks.prisma.user.update).toHaveBeenCalledWith({
        where: { id: testData.currentUser.id },
        data: { avatar: 'new-avatar-url' },
        select: expect.any(Object)
      });
    });

    it('should reject invalid field updates', async () => {
      const response = await request(app)
        .put('/api/user/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          id: 'new-id', // Should not be updatable
          chips: 10000, // Should not be updatable
          passwordHash: 'hack-attempt' // Should not be updatable
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid field');
    });

    it('should handle user not found during update', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/user/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          avatar: 'new-avatar-url'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('User not found');
    });

    it('should handle database errors during update', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
      mocks.prisma.user.update.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/user/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          avatar: 'new-avatar-url'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('GET /profile/:userId', () => {
    it('should return public profile information', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.otherUser);

      const response = await request(app)
        .get(`/api/user/profile/${testData.otherUser.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: testData.otherUser.id,
        username: testData.otherUser.username
      });
      
      // Should only expose public fields
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('email');
    });

    it('should handle profile not found', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/user/profile/nonexistent-id')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('User not found');
    });

    it('should validate userId parameter', async () => {
      const response = await request(app)
        .get('/api/user/profile/invalid-id-format')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid user ID');
    });
  });

  describe('GET /leaderboard', () => {
    it('should return top players by win rate', async () => {
      const leaderboardUsers = TestDataGenerator.generateUsers(10, {
        gamesPlayed: 20,
        winRate: 0.7
      });

      mocks.prisma.user.findMany.mockResolvedValue(leaderboardUsers);

      const response = await request(app)
        .get('/api/user/leaderboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.leaderboard).toHaveLength(10);
      expect(response.body.leaderboard[0]).toHaveProperty('username');
      expect(response.body.leaderboard[0]).toHaveProperty('winRate');
      expect(response.body.leaderboard[0]).toHaveProperty('gamesPlayed');
      
      // Should not expose sensitive data
      expect(response.body.leaderboard[0]).not.toHaveProperty('passwordHash');
    });

    it('should handle pagination', async () => {
      const leaderboardUsers = TestDataGenerator.generateUsers(5);
      mocks.prisma.user.findMany.mockResolvedValue(leaderboardUsers);

      const response = await request(app)
        .get('/api/user/leaderboard?page=2&limit=5')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mocks.prisma.user.findMany).toHaveBeenCalledWith({
        select: expect.any(Object),
        where: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 5, // (page - 1) * limit
        take: 5
      });
    });

    it('should filter by minimum games played', async () => {
      const response = await request(app)
        .get('/api/user/leaderboard?minGames=10')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(mocks.prisma.user.findMany).toHaveBeenCalledWith({
        select: expect.any(Object),
        where: {
          gamesPlayed: {
            gte: 10
          }
        },
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number)
      });
    });
  });

  describe('Security and Validation', () => {
    it('should sanitize input data', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
      mocks.prisma.user.update.mockResolvedValue(testData.currentUser);

      const response = await request(app)
        .put('/api/user/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          avatar: '<script>alert("xss")</script>',
          bio: 'Normal bio content'
        });

      expect(response.status).toBe(200);
      expect(mocks.prisma.user.update).toHaveBeenCalledWith({
        where: { id: testData.currentUser.id },
        data: {
          avatar: expect.not.stringContaining('<script>'),
          bio: 'Normal bio content'
        },
        select: expect.any(Object)
      });
    });

    it('should enforce field length limits', async () => {
      const longString = 'a'.repeat(1000);

      const response = await request(app)
        .put('/api/user/me')
        .set('Authorization', 'Bearer valid-token')
        .send({
          bio: longString
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('too long');
    });

    it('should require authentication for all endpoints', async () => {
      const mockAuth = require('../../src/middleware/auth');
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Token missing' });
      });

      const endpoints = [
        'get /api/user/me',
        'put /api/user/me',
        'get /api/user/profile/test-id',
        'get /api/user/leaderboard'
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        const response = await request(app)[method](path);
        expect(response.status).toBe(401);
      }

      // Restore mock
      mockAuth.authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = testData.currentUser;
        next();
      });
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);

      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/user/me')
          .set('Authorization', 'Bearer valid-token')
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000);
    });

    it('should use efficient database queries', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);

      await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer valid-token');

      // Verify only necessary fields are selected
      expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testData.currentUser.id },
        select: expect.objectContaining({
          id: true,
          username: true,
          avatar: true,
          chips: true,
          gamesPlayed: true,
          winRate: true,
          createdAt: true,
          updatedAt: true
        })
      });

      // Verify sensitive fields are not selected
      const selectObj = mocks.prisma.user.findUnique.mock.calls[0][0].select;
      expect(selectObj).not.toHaveProperty('passwordHash');
      expect(selectObj).not.toHaveProperty('password_hash');
    });
  });
});