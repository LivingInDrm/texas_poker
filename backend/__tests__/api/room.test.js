"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const Redis = __importStar(require("redis"));
// Import the modules to test
const room_1 = __importDefault(require("../../src/routes/room"));
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
};
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
};
client_1.PrismaClient.mockImplementation(() => mockPrisma);
Redis.createClient.mockReturnValue(mockRedis);
describe('Room Management API Tests', () => {
    let app;
    beforeAll(() => {
        // Setup Express app with routes
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        // Mock JWT verification
        jsonwebtoken_1.default.verify.mockImplementation((token, secret, callback) => {
            if (token === 'valid-token') {
                callback(null, { userId: 'user-123', username: 'testuser' });
            }
            else {
                callback(new Error('Invalid token'));
            }
        });
        // Add routes to app
        app.use('/api/room', room_1.default);
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
        it('should create a room successfully with valid data', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock user exists
            mockPrisma.user.findUnique.mockResolvedValue({
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
            mockPrisma.room.create.mockResolvedValue(mockRoom);
            // Mock password hashing
            bcrypt_1.default.hash.mockResolvedValue('hashed-password');
            // Mock Redis operations
            mockRedis.set.mockResolvedValue('OK');
            const response = yield (0, supertest_1.default)(app)
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
            expect(mockRedis.set).toHaveBeenCalledWith('room:room-123', expect.stringContaining('"id":"room-123"'));
        }));
        it('should fail without authentication', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .send(validCreatePayload);
            expect(response.status).toBe(401);
        }));
        it('should fail with invalid player limit (too low)', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send(Object.assign(Object.assign({}, validCreatePayload), { playerLimit: 1 }));
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Player limit must be between 2 and 9');
        }));
        it('should fail with invalid player limit (too high)', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send(Object.assign(Object.assign({}, validCreatePayload), { playerLimit: 10 }));
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Player limit must be between 2 and 9');
        }));
        it('should fail with invalid blind amounts', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send(Object.assign(Object.assign({}, validCreatePayload), { bigBlind: 10, smallBlind: 20 // Big blind smaller than small blind
             }));
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Big blind must be greater than small blind');
        }));
        it('should create room without password', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.user.findUnique.mockResolvedValue({
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
            mockPrisma.room.create.mockResolvedValue(mockRoom);
            mockRedis.set.mockResolvedValue('OK');
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send(Object.assign(Object.assign({}, validCreatePayload), { password: '' }));
            expect(response.status).toBe(201);
            expect(bcrypt_1.default.hash).not.toHaveBeenCalled();
        }));
    });
    describe('GET /api/room/list', () => {
        it('should return paginated room list', () => __awaiter(void 0, void 0, void 0, function* () {
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
            mockPrisma.room.findMany.mockResolvedValue(mockRooms);
            mockPrisma.room.count.mockResolvedValue(2);
            // Mock Redis to return room states
            mockRedis.get.mockImplementation((key) => {
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
            const response = yield (0, supertest_1.default)(app)
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
        }));
        it('should handle pagination correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findMany.mockResolvedValue([]);
            mockPrisma.room.count.mockResolvedValue(25);
            const response = yield (0, supertest_1.default)(app)
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
        }));
        it('should use default pagination values', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findMany.mockResolvedValue([]);
            mockPrisma.room.count.mockResolvedValue(0);
            const response = yield (0, supertest_1.default)(app)
                .get('/api/room/list');
            expect(response.status).toBe(200);
            expect(mockPrisma.room.findMany).toHaveBeenCalledWith({
                where: { status: { in: ['WAITING', 'PLAYING'] } },
                include: { owner: { select: { username: true } } },
                orderBy: { createdAt: 'desc' },
                skip: 0, // Default page 1
                take: 20 // Default limit
            });
        }));
    });
    describe('POST /api/room/join', () => {
        const validJoinPayload = {
            roomId: 'room-123'
        };
        beforeEach(() => {
            // Mock user exists
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 'user-456',
                username: 'joiner'
            });
        });
        it('should join a room successfully without password', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock room exists in database
            mockPrisma.room.findUnique.mockResolvedValue({
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
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.set.mockResolvedValue('OK');
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send(validJoinPayload);
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Successfully joined room');
            // Verify Redis state was updated
            expect(mockRedis.set).toHaveBeenCalledWith('room:room-123', expect.stringContaining('"currentPlayerCount":2'));
        }));
        it('should join a room successfully with correct password', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
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
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.set.mockResolvedValue('OK');
            // Mock password comparison
            bcrypt_1.default.compare.mockResolvedValue(true);
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send(Object.assign(Object.assign({}, validJoinPayload), { password: 'correct-password' }));
            expect(response.status).toBe(200);
            expect(bcrypt_1.default.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
        }));
        it('should fail with wrong password', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: 'hashed-password',
                status: 'WAITING'
            });
            bcrypt_1.default.compare.mockResolvedValue(false);
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send(Object.assign(Object.assign({}, validJoinPayload), { password: 'wrong-password' }));
            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Incorrect room password');
        }));
        it('should fail when room is full', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
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
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send(validJoinPayload);
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Room is full');
        }));
        it('should fail when room does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue(null);
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send(validJoinPayload);
            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Room not found');
        }));
        it('should fail when already in the room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
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
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send(validJoinPayload);
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('You are already in this room');
        }));
    });
    describe('DELETE /api/room/:id', () => {
        it('should delete room successfully by owner', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock room exists and user is owner
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                ownerId: 'user-123',
                status: 'WAITING'
            });
            mockPrisma.room.update.mockResolvedValue({
                id: 'room-123',
                status: 'ENDED'
            });
            mockRedis.del.mockResolvedValue(1);
            const response = yield (0, supertest_1.default)(app)
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
        }));
        it('should fail when user is not the owner', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                ownerId: 'different-user',
                status: 'WAITING'
            });
            const response = yield (0, supertest_1.default)(app)
                .delete('/api/room/room-123')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(403);
            expect(response.body.message).toBe('Only room owner can delete the room');
        }));
        it('should fail when room does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue(null);
            const response = yield (0, supertest_1.default)(app)
                .delete('/api/room/room-123')
                .set('Authorization', 'Bearer valid-token');
            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Room not found');
        }));
        it('should fail without authentication', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .delete('/api/room/room-123');
            expect(response.status).toBe(401);
        }));
    });
    describe('Error Handling', () => {
        it('should handle database connection errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.create.mockRejectedValue(new Error('Database connection failed'));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send({
                playerLimit: 6,
                bigBlind: 20,
                smallBlind: 10
            });
            expect(response.status).toBe(500);
            expect(response.body.message).toContain('Internal server error');
        }));
        it('should handle Redis connection errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
            mockPrisma.room.create.mockResolvedValue({ id: 'room-123' });
            mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send({
                playerLimit: 6,
                bigBlind: 20,
                smallBlind: 10
            });
            expect(response.status).toBe(500);
        }));
    });
    describe('Input Validation', () => {
        it('should validate UUID format for room ID', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send({ roomId: 'invalid-uuid' });
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid room ID format');
        }));
        it('should validate required fields for room creation', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send({}); // Empty payload
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('required');
        }));
        it('should validate numeric fields are numbers', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send({
                playerLimit: 'not-a-number',
                bigBlind: 20,
                smallBlind: 10
            });
            expect(response.status).toBe(400);
        }));
    });
});
