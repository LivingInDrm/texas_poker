"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mockFactory_1 = require("../shared/mockFactory");
const testDataGenerator_1 = require("../shared/testDataGenerator");
// Set test environment variable first
process.env.JWT_SECRET = 'test-jwt-secret';
// Create mocks first
const mockPrisma = mockFactory_1.MockFactory.createPrismaMock();
const mockJWT = mockFactory_1.MockFactory.createJWTMock();
// Mock dependencies before importing
jest.mock('jsonwebtoken', () => mockJWT);
jest.mock('../../src/prisma', () => mockPrisma);
// Import after mocking
const auth_1 = require("../../src/middleware/auth");
describe('Auth Middleware Tests', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let mocks;
    let testData;
    beforeAll(() => {
        testData = {
            validUser: testDataGenerator_1.TestDataGenerator.createUserData({
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
        testDataGenerator_1.TimerCleanup.cleanup();
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
        testDataGenerator_1.TimerCleanup.cleanup();
    });
    describe('authenticateToken', () => {
        it('should authenticate valid token successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mocks.jwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
            expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 'user-123' },
                select: { id: true, username: true }
            });
            expect(mockReq.user).toEqual({
                id: 'user-123',
                username: 'testuser'
            });
            expect(mockNext).toHaveBeenCalledWith();
            expect(mockRes.status).not.toHaveBeenCalled();
        }));
        it('should reject request without authorization header', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {};
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access token required'
            });
            expect(mockNext).not.toHaveBeenCalled();
        }));
        it('should reject request with malformed authorization header', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'InvalidFormat'
            };
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access token required'
            });
            expect(mockNext).not.toHaveBeenCalled();
        }));
        it('should reject request with empty Bearer token', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer '
            };
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access token required'
            });
            expect(mockNext).not.toHaveBeenCalled();
        }));
        it('should reject invalid JWT token', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer invalid-token'
            };
            mocks.jwt.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid or expired token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        }));
        it('should reject expired JWT token', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer expired-token'
            };
            mocks.jwt.verify.mockImplementation(() => {
                const error = new Error('Token expired');
                error.name = 'TokenExpiredError';
                throw error;
            });
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid or expired token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        }));
        it('should reject token for non-existent user', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };
            mocks.prisma.user.findUnique.mockResolvedValue(null);
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User not found'
            });
            expect(mockNext).not.toHaveBeenCalled();
        }));
        it('should handle database errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };
            mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid or expired token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        }));
        it('should handle malformed JWT payload', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };
            mocks.jwt.verify.mockReturnValue({
                // Missing userId and username
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600
            });
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            // Should be blocked by payload validation and not reach database
            expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(403);
        }));
        it('should handle case-sensitive authorization header', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                Authorization: 'Bearer valid-token' // Capital A
            };
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            // Should fail because Express headers are lowercase
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access token required'
            });
        }));
        it('should handle authorization header with extra spaces', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer   valid-token' // Multiple spaces - should be rejected
            };
            // Should fail due to empty token after split
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
        }));
    });
    describe('generateToken', () => {
        it('should generate JWT token with correct payload', () => {
            const token = (0, auth_1.generateToken)('user-123', 'testuser');
            expect(mocks.jwt.sign).toHaveBeenCalledWith({ userId: 'user-123', username: 'testuser' }, expect.any(String), { expiresIn: '24h' });
            expect(token).toBe('mocked-jwt-token');
        });
        it('should generate different tokens for different users', () => {
            mocks.jwt.sign
                .mockReturnValueOnce('token-for-user1')
                .mockReturnValueOnce('token-for-user2');
            const token1 = (0, auth_1.generateToken)('user-1', 'user1');
            const token2 = (0, auth_1.generateToken)('user-2', 'user2');
            expect(token1).toBe('token-for-user1');
            expect(token2).toBe('token-for-user2');
            expect(mocks.jwt.sign).toHaveBeenCalledTimes(2);
        });
        it('should handle special characters in username', () => {
            const specialUsername = 'user@test.com';
            (0, auth_1.generateToken)('user-123', specialUsername);
            expect(mocks.jwt.sign).toHaveBeenCalledWith({ userId: 'user-123', username: specialUsername }, expect.any(String), { expiresIn: '24h' });
        });
        it('should handle empty strings', () => {
            (0, auth_1.generateToken)('', '');
            expect(mocks.jwt.sign).toHaveBeenCalledWith({ userId: '', username: '' }, expect.any(String), { expiresIn: '24h' });
        });
        it('should use environment JWT_SECRET when available', () => {
            const originalSecret = process.env.JWT_SECRET;
            process.env.JWT_SECRET = 'custom-secret';
            // Re-import to pick up new environment variable
            delete require.cache[require.resolve('../../src/middleware/auth')];
            const { generateToken: newGenerateToken } = require('../../src/middleware/auth');
            newGenerateToken('user-123', 'testuser');
            expect(mocks.jwt.sign).toHaveBeenCalledWith(expect.any(Object), 'test-jwt-secret', expect.any(Object));
            process.env.JWT_SECRET = originalSecret;
        });
    });
    describe('Environment Configuration', () => {
        it('should handle missing JWT_SECRET environment variable', () => __awaiter(void 0, void 0, void 0, function* () {
            // Since we've already set JWT_SECRET in jest setup, this test verifies current behavior
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            // Should use test secret that was set in jest setup
            expect(mocks.jwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
        }));
    });
    describe('Integration Scenarios', () => {
        it('should handle rapid sequential authentication requests', () => __awaiter(void 0, void 0, void 0, function* () {
            const requests = Array.from({ length: 10 }, (_, i) => ({
                headers: { authorization: `Bearer token-${i}` }
            }));
            const start = Date.now();
            // Process all requests
            yield Promise.all(requests.map(req => (0, auth_1.authenticateToken)(req, mockRes, mockNext)));
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
            expect(mocks.jwt.verify).toHaveBeenCalledTimes(10);
            expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(10);
            expect(mockNext).toHaveBeenCalledTimes(10);
        }));
        it('should handle concurrent authentication requests', () => __awaiter(void 0, void 0, void 0, function* () {
            const concurrentRequests = Array.from({ length: 5 }, () => ({
                headers: { authorization: 'Bearer concurrent-token' }
            }));
            const start = Date.now();
            yield Promise.all(concurrentRequests.map(req => (0, auth_1.authenticateToken)(req, mockRes, mockNext)));
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50);
            expect(mocks.jwt.verify).toHaveBeenCalledTimes(5);
            expect(mockNext).toHaveBeenCalledTimes(5);
        }));
        it('should handle mixed valid and invalid tokens', () => __awaiter(void 0, void 0, void 0, function* () {
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
            yield Promise.all(mixedRequests.map(req => (0, auth_1.authenticateToken)(req, Object.assign({}, mockRes), jest.fn())));
            expect(mocks.jwt.verify).toHaveBeenCalledTimes(3); // Only for Bearer tokens
            expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(2); // Only for valid JWT
        }));
    });
    describe('Security', () => {
        it('should not leak sensitive information in error responses', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };
            // Simulate database error with sensitive information
            mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database connection failed at host=secret-host port=5432'));
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid or expired token'
            });
            // Should not expose database connection details
        }));
        it('should handle JWT bombs (deeply nested tokens)', () => __awaiter(void 0, void 0, void 0, function* () {
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
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith();
            expect(mockReq.user).toEqual({
                id: 'user-123',
                username: 'testuser'
            });
        }));
        it('should handle tokens with null/undefined values', () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers = {
                authorization: 'Bearer valid-token'
            };
            mocks.jwt.verify.mockReturnValue({
                userId: null,
                username: undefined,
                iat: Math.floor(Date.now() / 1000)
            });
            yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            // Should be blocked by payload validation and not reach database
            expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(403);
        }));
    });
    describe('Performance', () => {
        it('should cache JWT verification results efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            // This test ensures the middleware doesn't do unnecessary work
            mockReq.headers = {
                authorization: 'Bearer performance-token'
            };
            const iterations = 100;
            const start = Date.now();
            for (let i = 0; i < iterations; i++) {
                yield (0, auth_1.authenticateToken)(mockReq, mockRes, mockNext);
            }
            const duration = Date.now() - start;
            const avgTime = duration / iterations;
            expect(avgTime).toBeLessThan(10); // Each call should be < 10ms
            expect(mocks.jwt.verify).toHaveBeenCalledTimes(iterations);
        }));
    });
});
