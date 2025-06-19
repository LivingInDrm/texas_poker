import request from 'supertest';
import express from 'express';
import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, MockDataConfigurator, ApiTestHelper, TypeScriptCompatibility } from '../shared/testDataGenerator';

// Create mocks first
const mockPrisma = MockFactory.createPrismaMock();
const mockBcrypt = MockFactory.createBcryptMock();
const mockJwt = MockFactory.createJWTMock();

// Mock dependencies before importing modules
jest.mock('@prisma/client');
jest.mock('bcrypt', () => mockBcrypt); 
jest.mock('jsonwebtoken', () => mockJwt);
jest.mock('../../src/prisma', () => mockPrisma);
jest.mock('../../src/db');
jest.mock('../../src/middleware/auth', () => ({
  generateToken: jest.fn((userId: string, username: string) => 
    mockJwt.sign({ userId, username }, 'test-secret', { expiresIn: '24h' }))
}));

describe('Auth Routes', () => {
  let app: express.Application;
  let mocks: any;
  let testData: any;

  beforeAll(() => {
    // Create comprehensive mock setup
    mocks = {
      prisma: mockPrisma,
      bcrypt: mockBcrypt,
      jwt: mockJwt
    };
    
    testData = {
      validUser: TestDataGenerator.createUserData({
        username: 'testuser',
        passwordHash: '$2b$10$hashedpassword'
      }),
      newUser: TestDataGenerator.createUserData({
        username: 'newuser'
      }),
      jwtPayload: TestDataGenerator.createJWTPayload()
    };

    // Configure mocks with proper return values
    MockDataConfigurator.configurePrismaWithTestData(mocks.prisma, testData);
    MockDataConfigurator.configureAuthMocks(mocks, testData);

    // Create test app
    app = express();
    app.use(express.json());
    
    // Import routes after mocks are set up
    const authRoutes = require('../../src/routes/auth').default;
    app.use('/api/auth', authRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      // Setup mocks
      mocks.prisma.user.findUnique.mockResolvedValue(null);
      mocks.prisma.user.create.mockResolvedValue({
        id: testData.newUser.id,
        username: testData.newUser.username,
        avatar: testData.newUser.avatar,
        createdAt: testData.newUser.createdAt
        // passwordHash is deliberately excluded as per Prisma select
      });
      mocks.bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword');
      mocks.jwt.sign.mockReturnValue('test-jwt-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('newuser');
    });

    it('should reject duplicate username', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser'
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('POST /login', () => {
    it('should login with valid credentials', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
      mocks.bcrypt.compare.mockResolvedValue(true);
      mocks.jwt.sign.mockReturnValue('test-jwt-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'correct-password'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid username', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid username or password');
    });

    it('should reject invalid password', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
      mocks.bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid username or password');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser'
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during registration', async () => {
      mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle database errors during login', async () => {
      mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });

    it('should handle bcrypt errors', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);
      mocks.bcrypt.hash.mockRejectedValue(new Error('Hash error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('Security', () => {
    it('should not expose password hash in response', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);
      mocks.prisma.user.create.mockResolvedValue({
        id: testData.newUser.id,
        username: testData.newUser.username,
        avatar: testData.newUser.avatar,
        createdAt: testData.newUser.createdAt
        // passwordHash excluded
      });
      mocks.bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword');
      mocks.jwt.sign.mockReturnValue('test-jwt-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should generate secure JWT tokens', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
      mocks.bcrypt.compare.mockResolvedValue(true);
      
      const mockJwtSign = TypeScriptCompatibility.asMockFunction(mocks.jwt.sign);
      mockJwtSign.mockReturnValue('secure-jwt-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'correct-password'
        });

      expect(response.status).toBe(200);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testData.validUser.id,
          username: testData.validUser.username
        }),
        expect.any(String),
        expect.objectContaining({
          expiresIn: expect.any(String)
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rapid login attempts', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
      mocks.bcrypt.compare.mockResolvedValue(true);
      mocks.jwt.sign.mockReturnValue('test-jwt-token');

      // Simulate multiple rapid requests
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'correct-password'
          })
      );

      const responses = await Promise.all(requests);
      
      // All should succeed if no rate limiting implemented
      // This test documents expected behavior
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});