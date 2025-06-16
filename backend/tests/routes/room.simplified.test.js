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
};
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
};
client_1.PrismaClient.mockImplementation(() => mockPrisma);
Redis.createClient.mockReturnValue(mockRedis);
// Create simplified room routes for testing
const createRoomRoutes = (prisma, redisClient) => {
    const router = express_1.default.Router();
    // Authentication middleware mock
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        jsonwebtoken_1.default.verify(token, 'test-secret', (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid token' });
            }
            req.user = { id: decoded.userId, username: decoded.username };
            next();
        });
    };
    // POST /create
    router.post('/create', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { playerLimit, password, bigBlind, smallBlind } = req.body;
            const { id: userId, username } = req.user;
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
            let hashedPassword = null;
            if (password && password.trim() !== '') {
                hashedPassword = yield bcrypt_1.default.hash(password, 10);
            }
            // Create room
            const room = yield prisma.room.create({
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
            yield redisClient.set(`room:${room.id}`, JSON.stringify(roomState), 'EX', 3600);
            res.status(201).json({
                success: true,
                message: 'Room created successfully',
                data: { room }
            });
        }
        catch (error) {
            console.error('Create room error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }));
    // GET /list
    router.get('/list', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const rooms = yield prisma.room.findMany({
                where: { status: { in: ['WAITING', 'PLAYING'] } },
                include: { owner: { select: { username: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });
            const total = yield prisma.room.count({
                where: { status: { in: ['WAITING', 'PLAYING'] } }
            });
            // Get room states from Redis
            const roomsWithState = yield Promise.all(rooms.map((room) => __awaiter(void 0, void 0, void 0, function* () {
                const roomStateStr = yield redisClient.get(`room:${room.id}`);
                let currentPlayerCount = 0;
                if (roomStateStr) {
                    const roomState = JSON.parse(roomStateStr);
                    currentPlayerCount = roomState.currentPlayerCount || 0;
                }
                return Object.assign(Object.assign({}, room), { currentPlayerCount, hasPassword: !!room.password });
            })));
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
        }
        catch (error) {
            console.error('Get room list error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }));
    // POST /join
    router.post('/join', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { roomId, password } = req.body;
            const { id: userId, username } = req.user;
            if (!roomId) {
                return res.status(400).json({
                    success: false,
                    message: 'Room ID is required'
                });
            }
            // Check if room exists
            const room = yield prisma.room.findUnique({
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
                const passwordMatch = yield bcrypt_1.default.compare(password || '', room.password);
                if (!passwordMatch) {
                    return res.status(403).json({
                        success: false,
                        message: 'Incorrect room password'
                    });
                }
            }
            // Get room state from Redis
            const roomStateStr = yield redisClient.get(`room:${roomId}`);
            if (!roomStateStr) {
                return res.status(404).json({
                    success: false,
                    message: 'Room state not found'
                });
            }
            const roomState = JSON.parse(roomStateStr);
            // Check if player already in room
            const existingPlayer = roomState.players.find((p) => p.id === userId);
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
            yield redisClient.set(`room:${roomId}`, JSON.stringify(roomState), 'EX', 3600);
            res.json({
                success: true,
                message: 'Successfully joined room'
            });
        }
        catch (error) {
            console.error('Join room error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }));
    // DELETE /:id
    router.delete('/:id', authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const roomId = req.params.id;
            const { id: userId } = req.user;
            // Check if room exists and user is owner
            const room = yield prisma.room.findUnique({
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
            yield prisma.room.update({
                where: { id: roomId },
                data: { status: 'ENDED' }
            });
            // Delete from Redis
            yield redisClient.del(`room:${roomId}`);
            res.json({
                success: true,
                message: 'Room deleted successfully'
            });
        }
        catch (error) {
            console.error('Delete room error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }));
    return router;
};
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
        it('should create a room successfully with valid data', () => __awaiter(void 0, void 0, void 0, function* () {
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
            expect(mockRedis.set).toHaveBeenCalledWith('room:room-123', expect.stringContaining('"id":"room-123"'), 'EX', 3600);
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
        it('should fail with invalid blind amounts', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/create')
                .set('Authorization', 'Bearer valid-token')
                .send(Object.assign(Object.assign({}, validCreatePayload), { bigBlind: 10, smallBlind: 20 }));
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Big blind must be greater than small blind');
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
                    password: null,
                    createdAt: new Date(),
                    owner: { username: 'user1' }
                }
            ];
            mockPrisma.room.findMany.mockResolvedValue(mockRooms);
            mockPrisma.room.count.mockResolvedValue(1);
            mockRedis.get.mockResolvedValue(JSON.stringify({
                currentPlayerCount: 2
            }));
            const response = yield (0, supertest_1.default)(app)
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
        }));
    });
    describe('POST /api/room/join', () => {
        it('should join a room successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                ownerId: 'user-456', // Different owner
                password: null,
                status: 'WAITING'
            });
            const roomState = {
                id: 'room-123',
                players: [{ id: 'user-456', username: 'owner' }], // Different owner
                currentPlayerCount: 1,
                maxPlayers: 6
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.set.mockResolvedValue('OK');
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send({ roomId: 'room-123' });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        }));
        it('should fail when room is full', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
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
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            const response = yield (0, supertest_1.default)(app)
                .post('/api/room/join')
                .set('Authorization', 'Bearer valid-token')
                .send({ roomId: 'room-123' });
            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Room is full');
        }));
    });
    describe('DELETE /api/room/:id', () => {
        it('should delete room successfully by owner', () => __awaiter(void 0, void 0, void 0, function* () {
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
    });
});
