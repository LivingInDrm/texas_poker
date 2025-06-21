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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const mockFactory_1 = require("../shared/mockFactory");
const testDataGenerator_1 = require("../shared/testDataGenerator");
// Create mocks first
const mockPrisma = mockFactory_1.MockFactory.createPrismaMock();
const mockBcrypt = mockFactory_1.MockFactory.createBcryptMock();
const mockJwt = mockFactory_1.MockFactory.createJWTMock();
// Mock dependencies before importing modules
jest.mock('@prisma/client');
jest.mock('bcrypt', () => mockBcrypt);
jest.mock('jsonwebtoken', () => mockJwt);
jest.mock('../../src/prisma', () => mockPrisma);
jest.mock('../../src/db');
jest.mock('../../src/middleware/auth', () => ({
    generateToken: jest.fn((userId, username) => mockJwt.sign({ userId, username }, 'test-secret', { expiresIn: '24h' }))
}));
describe('Auth Routes', () => {
    let app;
    let mocks;
    let testData;
    beforeAll(() => {
        // Create comprehensive mock setup
        mocks = {
            prisma: mockPrisma,
            bcrypt: mockBcrypt,
            jwt: mockJwt
        };
        testData = {
            validUser: testDataGenerator_1.TestDataGenerator.createUserData({
                username: 'testuser',
                passwordHash: '$2b$10$hashedpassword'
            }),
            newUser: testDataGenerator_1.TestDataGenerator.createUserData({
                username: 'newuser'
            }),
            jwtPayload: testDataGenerator_1.TestDataGenerator.createJWTPayload()
        };
        // Configure mocks with proper return values
        testDataGenerator_1.MockDataConfigurator.configurePrismaWithTestData(mocks.prisma, testData);
        testDataGenerator_1.MockDataConfigurator.configureAuthMocks(mocks, testData);
        // Create test app
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        // Import routes after mocks are set up
        const authRoutes = require('../../src/routes/auth').default;
        app.use('/api/auth', authRoutes);
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('POST /register', () => {
        it('should register a new user successfully', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                username: 'newuser',
                password: 'password123'
            });
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.username).toBe('newuser');
        }));
        it('should reject duplicate username', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                username: 'testuser',
                password: 'password123'
            });
            expect(response.status).toBe(409);
            expect(response.body.error).toContain('already exists');
        }));
        it('should validate required fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                username: 'newuser'
                // missing password
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        }));
    });
    describe('POST /login', () => {
        it('should login with valid credentials', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
            mocks.bcrypt.compare.mockResolvedValue(true);
            mocks.jwt.sign.mockReturnValue('test-jwt-token');
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                username: 'testuser',
                password: 'correct-password'
            });
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
        }));
        it('should reject invalid username', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(null);
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                username: 'nonexistent',
                password: 'password123'
            });
            expect(response.status).toBe(401);
            expect(response.body.error).toContain('Invalid username or password');
        }));
        it('should reject invalid password', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
            mocks.bcrypt.compare.mockResolvedValue(false);
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                username: 'testuser',
                password: 'wrongpassword'
            });
            expect(response.status).toBe(401);
            expect(response.body.error).toContain('Invalid username or password');
        }));
        it('should validate required fields', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                username: 'testuser'
                // missing password
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        }));
    });
    describe('Error Handling', () => {
        it('should handle database errors during registration', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                username: 'newuser',
                password: 'password123'
            });
            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Internal server error');
        }));
        it('should handle database errors during login', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                username: 'testuser',
                password: 'password123'
            });
            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Internal server error');
        }));
        it('should handle bcrypt errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(null);
            mocks.bcrypt.hash.mockRejectedValue(new Error('Hash error'));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                username: 'newuser',
                password: 'password123'
            });
            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Internal server error');
        }));
    });
    describe('Security', () => {
        it('should not expose password hash in response', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                username: 'newuser',
                password: 'password123'
            });
            expect(response.status).toBe(201);
            expect(response.body.user).not.toHaveProperty('passwordHash');
            expect(response.body.user).not.toHaveProperty('password_hash');
        }));
        it('should generate secure JWT tokens', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
            mocks.bcrypt.compare.mockResolvedValue(true);
            const mockJwtSign = testDataGenerator_1.TypeScriptCompatibility.asMockFunction(mocks.jwt.sign);
            mockJwtSign.mockReturnValue('secure-jwt-token');
            const response = yield (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                username: 'testuser',
                password: 'correct-password'
            });
            expect(response.status).toBe(200);
            expect(mockJwt.sign).toHaveBeenCalledWith(expect.objectContaining({
                userId: testData.validUser.id,
                username: testData.validUser.username
            }), expect.any(String), expect.objectContaining({
                expiresIn: expect.any(String)
            }));
        }));
    });
    describe('Rate Limiting', () => {
        it('should handle rapid login attempts', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
            mocks.bcrypt.compare.mockResolvedValue(true);
            mocks.jwt.sign.mockReturnValue('test-jwt-token');
            // Simulate multiple rapid requests
            const requests = Array.from({ length: 5 }, () => (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                username: 'testuser',
                password: 'correct-password'
            }));
            const responses = yield Promise.all(requests);
            // All should succeed if no rate limiting implemented
            // This test documents expected behavior
            responses.forEach(response => {
                expect([200, 429]).toContain(response.status);
            });
        }));
    });
});
