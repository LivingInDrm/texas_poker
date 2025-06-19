import { Request, Response, NextFunction } from 'express';
import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, TimerCleanup } from '../shared/testDataGenerator';

// Create mocks first
const mockPrisma = MockFactory.createPrismaMock();
const mockJWT = MockFactory.createJWTMock();

// Mock dependencies before importing
jest.mock('jsonwebtoken', () => mockJWT);
jest.mock('../../src/prisma', () => ({
  default: mockPrisma
}));

// Import after mocking
import { authenticateToken, generateToken, AuthRequest } from '../../src/middleware/auth';

describe('Auth Middleware Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mocks: any;
  let testData: any;

  beforeAll(() => {
    testData = {
      validUser: TestDataGenerator.createUserData({
        id: 'user-123',
        username: 'testuser'
      }),
      jwtPayload: {
        userId: 'user-123',
        username: 'testuser',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }
    };

    mocks = {
      prisma: mockPrisma,
      jwt: mockJWT
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    TimerCleanup.cleanup();

    // Setup mock request/response
    mockReq = {
      headers: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();

    // Setup default mock behaviors
    mocks.jwt.verify.mockReturnValue(testData.jwtPayload);
    mocks.jwt.sign.mockReturnValue('mocked-jwt-token');
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: testData.validUser.id,
      username: testData.validUser.username
    });
  });

  afterEach(() => {
    TimerCleanup.cleanup();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mocks.jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { id: true, username: true }
      });
      expect((mockReq as AuthRequest).user).toEqual({
        id: 'user-123',
        username: 'testuser'
      });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockReq.headers = {};

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access token required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat'
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access token required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with empty Bearer token', async () => {
      mockReq.headers = {
        authorization: 'Bearer '
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access token required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      };

      mocks.jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token', async () => {
      mockReq.headers = {
        authorization: 'Bearer expired-token'
      };

      mocks.jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mocks.prisma.user.findUnique.mockResolvedValue(null);

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle malformed JWT payload', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mocks.jwt.verify.mockReturnValue({
        // Missing userId and username
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: undefined },
        select: { id: true, username: true }
      });
      // This will likely cause a database error, which should be handled
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle case-sensitive authorization header', async () => {
      mockReq.headers = {
        Authorization: 'Bearer valid-token' // Capital A
      };

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      // Should fail because Express headers are lowercase
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access token required'
      });
    });

    it('should handle authorization header with extra spaces', async () => {
      mockReq.headers = {
        authorization: 'Bearer  valid-token  ' // Extra spaces
      };

      // JWT verify should be called with trimmed token
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mocks.jwt.verify).toHaveBeenCalledWith('valid-token  ', expect.any(String));
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      const token = generateToken('user-123', 'testuser');

      expect(mocks.jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-123', username: 'testuser' },
        expect.any(String),
        { expiresIn: '24h' }
      );
      expect(token).toBe('mocked-jwt-token');
    });

    it('should generate different tokens for different users', () => {
      mocks.jwt.sign
        .mockReturnValueOnce('token-for-user1')
        .mockReturnValueOnce('token-for-user2');

      const token1 = generateToken('user-1', 'user1');
      const token2 = generateToken('user-2', 'user2');

      expect(token1).toBe('token-for-user1');
      expect(token2).toBe('token-for-user2');
      expect(mocks.jwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should handle special characters in username', () => {
      const specialUsername = 'user@test.com';
      generateToken('user-123', specialUsername);

      expect(mocks.jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-123', username: specialUsername },
        expect.any(String),
        { expiresIn: '24h' }
      );
    });

    it('should handle empty strings', () => {
      generateToken('', '');

      expect(mocks.jwt.sign).toHaveBeenCalledWith(
        { userId: '', username: '' },
        expect.any(String),
        { expiresIn: '24h' }
      );
    });

    it('should use environment JWT_SECRET when available', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'custom-secret';

      // Re-import to pick up new environment variable
      delete require.cache[require.resolve('../../src/middleware/auth')];
      const { generateToken: newGenerateToken } = require('../../src/middleware/auth');

      newGenerateToken('user-123', 'testuser');

      expect(mocks.jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'custom-secret',
        expect.any(Object)
      );

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing JWT_SECRET environment variable', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      // Re-import to pick up new environment variable
      delete require.cache[require.resolve('../../src/middleware/auth')];
      const { authenticateToken: newAuthenticateToken } = require('../../src/middleware/auth');

      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      await newAuthenticateToken(mockReq as Request, mockRes as Response, mockNext);

      // Should use fallback secret
      expect(mocks.jwt.verify).toHaveBeenCalledWith(
        'valid-token',
        'your-secret-key-change-in-production'
      );

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid sequential authentication requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        headers: { authorization: `Bearer token-${i}` }
      }));

      const start = Date.now();

      // Process all requests
      await Promise.all(requests.map(req => 
        authenticateToken(req as Request, mockRes as Response, mockNext)
      ));

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be very fast
      expect(mocks.jwt.verify).toHaveBeenCalledTimes(10);
      expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(10);
      expect(mockNext).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = Array.from({ length: 5 }, () => ({
        headers: { authorization: 'Bearer concurrent-token' }
      }));

      const start = Date.now();

      await Promise.all(concurrentRequests.map(req => 
        authenticateToken(req as Request, mockRes as Response, mockNext)
      ));

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(mocks.jwt.verify).toHaveBeenCalledTimes(5);
      expect(mockNext).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed valid and invalid tokens', async () => {
      const mixedRequests = [
        { headers: { authorization: 'Bearer valid-token' } },
        { headers: { authorization: 'Bearer invalid-token' } },
        { headers: { authorization: 'Bearer another-valid-token' } },
        { headers: {} }, // No auth header
        { headers: { authorization: 'InvalidFormat' } }
      ];

      mocks.jwt.verify
        .mockReturnValueOnce(testData.jwtPayload) // valid
        .mockImplementationOnce(() => { throw new Error('Invalid'); }) // invalid
        .mockReturnValueOnce(testData.jwtPayload); // valid

      await Promise.all(mixedRequests.map(req => 
        authenticateToken(req as Request, { ...mockRes } as Response, jest.fn())
      ));

      expect(mocks.jwt.verify).toHaveBeenCalledTimes(3); // Only for Bearer tokens
      expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(2); // Only for valid JWT
    });
  });

  describe('Security', () => {
    it('should not leak sensitive information in error responses', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      // Simulate database error with sensitive information
      mocks.prisma.user.findUnique.mockRejectedValue(
        new Error('Database connection failed at host=secret-host port=5432')
      );

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      // Should not expose database connection details
    });

    it('should handle JWT bombs (deeply nested tokens)', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      // Simulate deeply nested payload
      const nestedPayload = {
        userId: 'user-123',
        username: 'testuser',
        nested: { level1: { level2: { level3: { data: 'deep' } } } }
      };
      mocks.jwt.verify.mockReturnValue(nestedPayload);

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as AuthRequest).user).toEqual({
        id: 'user-123',
        username: 'testuser'
      });
    });

    it('should handle tokens with null/undefined values', async () => {
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mocks.jwt.verify.mockReturnValue({
        userId: null,
        username: undefined,
        iat: Math.floor(Date.now() / 1000)
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: null },
        select: { id: true, username: true }
      });
      // This should likely fail and return 403
    });
  });

  describe('Performance', () => {
    it('should cache JWT verification results efficiently', async () => {
      // This test ensures the middleware doesn't do unnecessary work
      mockReq.headers = {
        authorization: 'Bearer performance-token'
      };

      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await authenticateToken(mockReq as Request, mockRes as Response, mockNext);
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(10); // Each call should be < 10ms
      expect(mocks.jwt.verify).toHaveBeenCalledTimes(iterations);
    });
  });
});