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
const request = require('supertest');
const express = require('express');
const mockFactory_1 = require("../shared/mockFactory");
const testDataGenerator_1 = require("../shared/testDataGenerator");
// Create mocks first
const mockPrisma = mockFactory_1.MockFactory.createPrismaMock();
const mockJwt = mockFactory_1.MockFactory.createJWTMock();
// Mock dependencies before importing modules
jest.mock('@prisma/client');
jest.mock('jsonwebtoken', () => mockJwt);
jest.mock('../../src/prisma', () => mockPrisma);
jest.mock('../../src/middleware/auth', () => ({
    authenticateToken: jest.fn((req, res, next) => {
        req.user = { id: 'test-user-id', username: 'testuser' };
        next();
    })
}));
describe('User Routes', () => {
    let app;
    let mocks;
    let testData;
    beforeAll(() => {
        // Create comprehensive mock setup
        mocks = {
            prisma: mockPrisma,
            jwt: mockJwt
        };
        testData = {
            currentUser: testDataGenerator_1.TestDataGenerator.createUserData({
                id: 'test-user-id',
                username: 'testuser',
                chips: 5000,
                gamesPlayed: 10,
                winRate: 0.65
            }),
            otherUser: testDataGenerator_1.TestDataGenerator.createUserData({
                id: 'other-user-id',
                username: 'otheruser'
            }),
            jwtPayload: testDataGenerator_1.TestDataGenerator.createJWTPayload({
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
        testDataGenerator_1.MockDataConfigurator.configureAuthMocks(mocks, testData);
        // Mock authentication middleware
        const mockAuth = require('../../src/middleware/auth');
        mockAuth.authenticateToken = jest.fn((req, res, next) => {
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
        it('should return current user information', () => __awaiter(void 0, void 0, void 0, function* () {
            // Configure mock to return only selected fields (matching Prisma select)
            mocks.prisma.user.findUnique.mockResolvedValue({
                id: testData.currentUser.id,
                username: testData.currentUser.username,
                avatar: testData.currentUser.avatar,
                createdAt: testData.currentUser.createdAt,
                updatedAt: testData.currentUser.updatedAt
                // Note: passwordHash is excluded per Prisma select
            });
            const response = yield request(app)
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
        }));
        it('should handle user not found', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(null);
            const response = yield request(app)
                .get('/api/user/me')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(404);
            expect(response.body.error).toContain('User not found');
        }));
        it('should require authentication', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock auth middleware to reject
            const mockAuth = require('../../src/middleware/auth');
            mockAuth.authenticateToken.mockImplementation((req, res, next) => {
                res.status(401).json({ error: 'Unauthorized' });
            });
            const response = yield request(app)
                .get('/api/user/me');
            expect(response.status).toBe(401);
            expect(response.body.error).toContain('Unauthorized');
            // Restore mock
            mockAuth.authenticateToken.mockImplementation((req, res, next) => {
                req.user = testData.currentUser;
                next();
            });
        }));
        it('should handle database errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));
            const response = yield request(app)
                .get('/api/user/me')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Internal server error');
        }));
    });
    describe('PUT /me', () => {
        it('should update user profile successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const updatedUser = Object.assign(Object.assign({}, testData.currentUser), { avatar: 'new-avatar-url' });
            mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
            mocks.prisma.user.update.mockResolvedValue(updatedUser);
            const response = yield request(app)
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
        }));
        it('should reject invalid field updates', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield request(app)
                .put('/api/user/me')
                .set('Authorization', 'Bearer valid-token')
                .send({
                id: 'new-id', // Should not be updatable
                chips: 10000, // Should not be updatable
                passwordHash: 'hack-attempt' // Should not be updatable
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid field');
        }));
        it('should handle user not found during update', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(null);
            const response = yield request(app)
                .put('/api/user/me')
                .set('Authorization', 'Bearer valid-token')
                .send({
                avatar: 'new-avatar-url'
            });
            expect(response.status).toBe(404);
            expect(response.body.error).toContain('User not found');
        }));
        it('should handle database errors during update', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
            mocks.prisma.user.update.mockRejectedValue(new Error('Update failed'));
            const response = yield request(app)
                .put('/api/user/me')
                .set('Authorization', 'Bearer valid-token')
                .send({
                avatar: 'new-avatar-url'
            });
            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Internal server error');
        }));
    });
    describe('GET /profile/:userId', () => {
        it('should return public profile information', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock response with only public fields (no passwordHash)
            const publicUserData = {
                id: testData.otherUser.id,
                username: testData.otherUser.username,
                avatar: testData.otherUser.avatar,
                createdAt: testData.otherUser.createdAt,
                chips: testData.otherUser.chips,
                gamesPlayed: testData.otherUser.gamesPlayed,
                winRate: testData.otherUser.winRate
            };
            mocks.prisma.user.findUnique.mockResolvedValue(publicUserData);
            const response = yield request(app)
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
        }));
        it('should handle profile not found', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(null);
            const response = yield request(app)
                .get('/api/user/profile/nonexistent-id')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(404);
            expect(response.body.error).toContain('User not found');
        }));
        it('should validate userId parameter', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield request(app)
                .get('/api/user/profile/invalid-id-format')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid user ID');
        }));
    });
    describe('GET /leaderboard', () => {
        it('should return top players by win rate', () => __awaiter(void 0, void 0, void 0, function* () {
            const leaderboardUsers = testDataGenerator_1.TestDataGenerator.generateUsers(10, {
                gamesPlayed: 20,
                winRate: 0.7
            });
            mocks.prisma.user.findMany.mockResolvedValue(leaderboardUsers);
            const response = yield request(app)
                .get('/api/user/leaderboard')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(200);
            expect(response.body.leaderboard).toHaveLength(10);
            expect(response.body.leaderboard[0]).toHaveProperty('username');
            expect(response.body.leaderboard[0]).toHaveProperty('winRate');
            expect(response.body.leaderboard[0]).toHaveProperty('gamesPlayed');
            // Should not expose sensitive data
            expect(response.body.leaderboard[0]).not.toHaveProperty('passwordHash');
        }));
        it('should handle pagination', () => __awaiter(void 0, void 0, void 0, function* () {
            const leaderboardUsers = testDataGenerator_1.TestDataGenerator.generateUsers(5);
            mocks.prisma.user.findMany.mockResolvedValue(leaderboardUsers);
            const response = yield request(app)
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
        }));
        it('should filter by minimum games played', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield request(app)
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
        }));
    });
    describe('Security and Validation', () => {
        it('should sanitize input data', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
            mocks.prisma.user.update.mockResolvedValue(testData.currentUser);
            const response = yield request(app)
                .put('/api/user/me')
                .set('Authorization', 'Bearer valid-token')
                .send({
                avatar: '<script>alert("xss")</script>'
            });
            expect(response.status).toBe(200);
            expect(mocks.prisma.user.update).toHaveBeenCalledWith({
                where: { id: testData.currentUser.id },
                data: {
                    avatar: expect.not.stringContaining('<script>')
                },
                select: expect.any(Object)
            });
        }));
        it('should enforce field length limits', () => __awaiter(void 0, void 0, void 0, function* () {
            const longString = 'a'.repeat(1000);
            const response = yield request(app)
                .put('/api/user/me')
                .set('Authorization', 'Bearer valid-token')
                .send({
                avatar: longString
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('too long');
        }));
        it('should require authentication for all endpoints', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockAuth = require('../../src/middleware/auth');
            mockAuth.authenticateToken.mockImplementation((req, res, next) => {
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
                const response = yield request(app)[method](path);
                expect(response.status).toBe(401);
            }
            // Restore mock
            mockAuth.authenticateToken.mockImplementation((req, res, next) => {
                req.user = testData.currentUser;
                next();
            });
        }));
    });
    describe('Performance', () => {
        it('should handle concurrent requests efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
            const requests = Array.from({ length: 10 }, () => request(app)
                .get('/api/user/me')
                .set('Authorization', 'Bearer valid-token'));
            const start = Date.now();
            const responses = yield Promise.all(requests);
            const duration = Date.now() - start;
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
            // Should complete within reasonable time
            expect(duration).toBeLessThan(1000);
        }));
        it('should use efficient database queries', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.currentUser);
            yield request(app)
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
        }));
    });
});
