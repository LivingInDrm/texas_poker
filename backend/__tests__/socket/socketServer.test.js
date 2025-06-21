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
const socketTestUtils_1 = require("../shared/socketTestUtils");
const socket_1 = require("../../src/types/socket");
// Create mocks first
const mockPrisma = mockFactory_1.MockFactory.createPrismaMock();
const mockRedis = mockFactory_1.MockFactory.createRedisMock();
const mockJWT = mockFactory_1.MockFactory.createJWTMock();
const mockUserStateService = mockFactory_1.MockFactory.createUserStateServiceMock();
// Mock dependencies before importing
jest.mock('jsonwebtoken', () => mockJWT);
jest.mock('../../src/prisma', () => mockPrisma);
jest.mock('../../src/db', () => ({
    redisClient: mockRedis
}));
jest.mock('../../src/services/userStateService', () => ({
    userStateService: mockUserStateService
}));
// Mock handler setup functions
jest.mock('../../src/socket/handlers/systemHandlers', () => ({
    setupSystemHandlers: jest.fn()
}));
jest.mock('../../src/socket/handlers/roomHandlers', () => ({
    setupRoomHandlers: jest.fn()
}));
jest.mock('../../src/socket/handlers/gameHandlers', () => ({
    setupGameHandlers: jest.fn()
}));
// Mock Socket.IO server
const mockSocketIOServer = jest.fn().mockImplementation(() => ({
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn().mockReturnValue({
        emit: jest.fn()
    }),
    emit: jest.fn(),
    sockets: {
        adapter: {
            rooms: new Map()
        },
        sockets: new Map()
    },
    engine: {
        on: jest.fn()
    }
}));
jest.mock('socket.io', () => ({
    Server: mockSocketIOServer
}));
// Import after mocking
const socketServer_1 = require("../../src/socket/socketServer");
describe('Socket Server Tests', () => {
    let httpServer;
    let mockIo;
    let mocks;
    let testData;
    beforeAll(() => {
        // Create test data
        testData = {
            validUser: testDataGenerator_1.TestDataGenerator.createUserData({
                id: 'user-123',
                username: 'testuser'
            }),
            roomState: testDataGenerator_1.TestDataGenerator.createRedisRoomStateData({
                id: 'room-456',
                currentPlayers: 2,
                players: [
                    {
                        id: 'user-123',
                        username: 'testuser',
                        chips: 5000,
                        position: 0,
                        isOwner: true,
                        isConnected: true
                    },
                    {
                        id: 'user-456',
                        username: 'otheruser',
                        chips: 5000,
                        position: 1,
                        isOwner: false,
                        isConnected: true
                    }
                ]
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
            redis: mockRedis,
            jwt: mockJWT,
            userStateService: mockUserStateService
        };
        // Setup HTTP server mock
        httpServer = {
            listen: jest.fn()
        };
    });
    beforeEach(() => {
        jest.clearAllMocks();
        testDataGenerator_1.TimerCleanup.cleanup();
        // Reset mock implementations
        mockSocketIOServer.mockClear();
        // Setup default mock behaviors
        mocks.jwt.verify.mockReturnValue(testData.jwtPayload);
        mocks.prisma.user.findUnique.mockResolvedValue(testData.validUser);
        mocks.redis.get.mockResolvedValue(JSON.stringify(testData.roomState));
        mocks.redis.setEx.mockResolvedValue('OK');
        mocks.userStateService.clearUserCurrentRoom.mockResolvedValue(true);
        // Create mock Socket.IO server instance
        mockIo = {
            use: jest.fn(),
            on: jest.fn(),
            to: jest.fn().mockReturnValue({
                emit: jest.fn()
            }),
            emit: jest.fn(),
            sockets: {
                adapter: {
                    rooms: new Map()
                },
                sockets: new Map()
            },
            engine: {
                on: jest.fn()
            }
        };
        mockSocketIOServer.mockReturnValue(mockIo);
    });
    afterEach(() => {
        testDataGenerator_1.TimerCleanup.cleanup();
    });
    describe('createSocketServer', () => {
        it('should create Socket.IO server with correct configuration', () => {
            const io = (0, socketServer_1.createSocketServer)(httpServer);
            expect(mockSocketIOServer).toHaveBeenCalledWith(httpServer, {
                cors: {
                    origin: "http://localhost:5173",
                    methods: ["GET", "POST"],
                    credentials: true
                },
                pingTimeout: 60000,
                pingInterval: 25000
            });
            expect(mockIo.use).toHaveBeenCalled(); // Auth middleware
            expect(mockIo.on).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.CONNECTION, expect.any(Function));
            expect(mockIo.engine.on).toHaveBeenCalledWith('connection_error', expect.any(Function));
        });
        it('should use custom FRONTEND_URL when provided', () => {
            const originalEnv = process.env.FRONTEND_URL;
            process.env.FRONTEND_URL = 'https://example.com';
            (0, socketServer_1.createSocketServer)(httpServer);
            expect(mockSocketIOServer).toHaveBeenCalledWith(httpServer, expect.objectContaining({
                cors: expect.objectContaining({
                    origin: 'https://example.com'
                })
            }));
            process.env.FRONTEND_URL = originalEnv;
        });
    });
    describe('JWT Authentication Middleware', () => {
        let authMiddleware;
        let mockSocket;
        let nextCallback;
        beforeEach(() => {
            (0, socketServer_1.createSocketServer)(httpServer);
            authMiddleware = mockIo.use.mock.calls[0][0];
            mockSocket = (0, socketTestUtils_1.createMockAuthenticatedSocket)({
                userId: 'user-123',
                username: 'testuser'
            });
            Object.defineProperty(mockSocket, 'handshake', {
                value: {
                    auth: { token: 'valid-token' },
                    headers: {}
                },
                writable: true
            });
            nextCallback = jest.fn();
        });
        it('should authenticate valid token successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            yield authMiddleware(mockSocket, nextCallback);
            expect(mocks.jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
            expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 'user-123' }
            });
            expect(mockSocket.data.userId).toBe('user-123');
            expect(mockSocket.data.username).toBe('testuser');
            expect(mockSocket.data.authenticated).toBe(true);
            expect(nextCallback).toHaveBeenCalledWith();
        }));
        it('should authenticate with token from Authorization header', () => __awaiter(void 0, void 0, void 0, function* () {
            Object.defineProperty(mockSocket, 'handshake', {
                value: {
                    auth: {},
                    headers: {
                        authorization: 'Bearer header-token'
                    }
                },
                writable: true
            });
            yield authMiddleware(mockSocket, nextCallback);
            expect(mocks.jwt.verify).toHaveBeenCalledWith('header-token', process.env.JWT_SECRET);
            expect(nextCallback).toHaveBeenCalledWith();
        }));
        it('should reject connection without token', () => __awaiter(void 0, void 0, void 0, function* () {
            Object.defineProperty(mockSocket, 'handshake', {
                value: {
                    auth: {},
                    headers: {}
                },
                writable: true
            });
            yield authMiddleware(mockSocket, nextCallback);
            expect(nextCallback).toHaveBeenCalledWith(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
        }));
        it('should reject invalid JWT token', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.jwt.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });
            yield authMiddleware(mockSocket, nextCallback);
            expect(nextCallback).toHaveBeenCalledWith(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
        }));
        it('should reject token for non-existent user', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockResolvedValue(null);
            yield authMiddleware(mockSocket, nextCallback);
            expect(nextCallback).toHaveBeenCalledWith(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
        }));
        it('should handle database errors during user verification', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));
            yield authMiddleware(mockSocket, nextCallback);
            expect(nextCallback).toHaveBeenCalledWith(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
        }));
    });
    describe('Connection Handling', () => {
        let connectionHandler;
        let mockSocket;
        beforeEach(() => {
            (0, socketServer_1.createSocketServer)(httpServer);
            connectionHandler = mockIo.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.CONNECTION)[1];
            mockSocket = (0, socketTestUtils_1.createMockAuthenticatedSocket)({
                userId: 'user-123',
                username: 'testuser'
            });
        });
        it('should handle new connection properly', () => {
            const setupSystemHandlers = require('../../src/socket/handlers/systemHandlers').setupSystemHandlers;
            const setupRoomHandlers = require('../../src/socket/handlers/roomHandlers').setupRoomHandlers;
            const setupGameHandlers = require('../../src/socket/handlers/gameHandlers').setupGameHandlers;
            connectionHandler(mockSocket);
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.CONNECTED, {
                message: 'Welcome testuser! You are connected to Texas Poker.'
            });
            expect(setupSystemHandlers).toHaveBeenCalledWith(mockSocket, mockIo);
            expect(setupRoomHandlers).toHaveBeenCalledWith(mockSocket, mockIo);
            expect(setupGameHandlers).toHaveBeenCalledWith(mockSocket, mockIo);
            expect(mockSocket.on).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.DISCONNECT, expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
        it('should handle socket errors', () => {
            connectionHandler(mockSocket);
            const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
            const mockError = new Error('Test error');
            errorHandler(mockError);
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'An error occurred',
                code: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        });
    });
    describe('Disconnect Handling', () => {
        let disconnectHandler;
        let mockSocket;
        beforeEach(() => {
            (0, socketServer_1.createSocketServer)(httpServer);
            const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.CONNECTION)[1];
            mockSocket = (0, socketTestUtils_1.createMockAuthenticatedSocket)({
                userId: 'user-123',
                username: 'testuser',
                roomId: 'room-456'
            });
            connectionHandler(mockSocket);
            disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.DISCONNECT)[1];
        });
        it('should handle disconnect without room gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockSocket.data.roomId = undefined;
            yield disconnectHandler('client disconnect', {});
            expect(mocks.redis.get).not.toHaveBeenCalled();
        }));
        it('should handle player disconnect from room', () => __awaiter(void 0, void 0, void 0, function* () {
            yield disconnectHandler('client disconnect', {});
            expect(mocks.redis.get).toHaveBeenCalledWith('room:room-456');
            expect(mocks.redis.setEx).toHaveBeenCalledWith('room:room-456', 3600, expect.stringContaining('"isConnected":false'));
            expect(mockSocket.to).toHaveBeenCalledWith('room-456');
        }));
        it('should clear user state when player not in room', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomStateWithoutUser = Object.assign(Object.assign({}, testData.roomState), { players: testData.roomState.players.filter((p) => p.id !== 'user-123') });
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomStateWithoutUser));
            yield disconnectHandler('client disconnect', {});
            expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
        }));
        it('should clear user state when room does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.redis.get.mockResolvedValue(null);
            yield disconnectHandler('client disconnect', {});
            expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
        }));
        it('should handle Redis errors during disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.redis.get.mockRejectedValue(new Error('Redis error'));
            yield disconnectHandler('client disconnect', {});
            expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
        }));
        it('should handle cleanup errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.redis.get.mockRejectedValue(new Error('Redis error'));
            mocks.userStateService.clearUserCurrentRoom.mockRejectedValue(new Error('Cleanup error'));
            // Should not throw
            yield expect(disconnectHandler('client disconnect')).resolves.toBeUndefined();
        }));
    });
    describe('Utility Functions', () => {
        beforeEach(() => {
            (0, socketServer_1.createSocketServer)(httpServer);
        });
        describe('getRoomSocketCount', () => {
            it('should return correct room socket count', () => {
                const mockRoom = new Set(['socket1', 'socket2', 'socket3']);
                mockIo.sockets.adapter.rooms.set('room-123', mockRoom);
                const count = (0, socketServer_1.getRoomSocketCount)(mockIo, 'room-123');
                expect(count).toBe(3);
            });
            it('should return 0 for non-existent room', () => {
                const count = (0, socketServer_1.getRoomSocketCount)(mockIo, 'nonexistent-room');
                expect(count).toBe(0);
            });
        });
        describe('getUserSocket', () => {
            it('should find socket by user ID', () => {
                const mockSocket1 = { data: { userId: 'user-1' } };
                const mockSocket2 = { data: { userId: 'user-2' } };
                mockIo.sockets.sockets.set('socket1', mockSocket1);
                mockIo.sockets.sockets.set('socket2', mockSocket2);
                const socket = (0, socketServer_1.getUserSocket)(mockIo, 'user-2');
                expect(socket).toBe(mockSocket2);
            });
            it('should return null for non-existent user', () => {
                const socket = (0, socketServer_1.getUserSocket)(mockIo, 'nonexistent-user');
                expect(socket).toBeNull();
            });
            it('should handle sockets without data', () => {
                const mockSocketWithoutData = {};
                mockIo.sockets.sockets.set('socket1', mockSocketWithoutData);
                const socket = (0, socketServer_1.getUserSocket)(mockIo, 'user-1');
                expect(socket).toBeNull();
            });
        });
        describe('broadcastToRoom', () => {
            it('should broadcast message to room', () => {
                const testData = { message: 'Hello room!' };
                (0, socketServer_1.broadcastToRoom)(mockIo, 'room-123', socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, testData);
                expect(mockIo.to).toHaveBeenCalledWith('room-123');
                expect(mockIo.to('room-123').emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, testData);
            });
        });
        describe('sendToUser', () => {
            it('should send message to specific user successfully', () => {
                const mockSocket = {
                    emit: jest.fn(),
                    data: { userId: 'user-123' }
                };
                mockIo.sockets.sockets.set('socket1', mockSocket);
                const testData = { message: 'Hello user!' };
                const result = (0, socketServer_1.sendToUser)(mockIo, 'user-123', socket_1.SOCKET_EVENTS.CONNECTED, testData);
                expect(result).toBe(true);
                expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.CONNECTED, testData);
            });
            it('should return false when user not found', () => {
                const testData = { message: 'Hello user!' };
                const result = (0, socketServer_1.sendToUser)(mockIo, 'nonexistent-user', socket_1.SOCKET_EVENTS.CONNECTED, testData);
                expect(result).toBe(false);
            });
        });
    });
    describe('Error Handling', () => {
        it('should handle global connection errors', () => {
            (0, socketServer_1.createSocketServer)(httpServer);
            const errorHandler = mockIo.engine.on.mock.calls.find(call => call[0] === 'connection_error')[1];
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockError = new Error('Connection error');
            errorHandler(mockError);
            expect(consoleSpy).toHaveBeenCalledWith('Socket.IO connection error:', mockError);
            consoleSpy.mockRestore();
        });
    });
    describe('Environment Configuration', () => {
        it('should handle missing JWT_SECRET', () => __awaiter(void 0, void 0, void 0, function* () {
            const originalSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;
            (0, socketServer_1.createSocketServer)(httpServer);
            const authMiddleware = mockIo.use.mock.calls[0][0];
            const mockSocket = (0, socketTestUtils_1.createMockAuthenticatedSocket)();
            Object.defineProperty(mockSocket, 'handshake', {
                value: { auth: { token: 'test-token' }, headers: {} },
                writable: true
            });
            const nextCallback = jest.fn();
            // JWT should be called with undefined, causing an error
            mocks.jwt.verify.mockImplementation(() => {
                throw new Error('secretOrPrivateKey is required');
            });
            yield authMiddleware(mockSocket, nextCallback);
            expect(nextCallback).toHaveBeenCalledWith(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
            process.env.JWT_SECRET = originalSecret;
        }));
    });
    describe('Performance and Concurrency', () => {
        it('should handle multiple concurrent connections', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, socketServer_1.createSocketServer)(httpServer);
            const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.CONNECTION)[1];
            const sockets = Array.from({ length: 10 }, (_, i) => (0, socketTestUtils_1.createMockAuthenticatedSocket)({
                userId: `user-${i}`,
                username: `user${i}`
            }));
            const start = Date.now();
            // Simulate concurrent connections
            yield Promise.all(sockets.map(socket => {
                return Promise.resolve(connectionHandler(socket));
            }));
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
            sockets.forEach(socket => {
                expect(socket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.CONNECTED, expect.objectContaining({
                    message: expect.stringContaining('Welcome')
                }));
            });
        }));
        it('should handle rapid disconnect/reconnect cycles', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            (0, socketServer_1.createSocketServer)(httpServer);
            const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.CONNECTION)[1];
            const mockSocket = (0, socketTestUtils_1.createMockAuthenticatedSocket)({
                userId: 'user-123',
                username: 'testuser',
                roomId: undefined // No room, so clearUserCurrentRoom should be called
            });
            // Connect
            connectionHandler(mockSocket);
            const disconnectHandler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.DISCONNECT)) === null || _a === void 0 ? void 0 : _a[1];
            // Multiple rapid disconnects
            if (disconnectHandler) {
                yield Promise.all([
                    disconnectHandler('client disconnect', {}),
                    disconnectHandler('transport close', {}),
                    disconnectHandler('client disconnect', {})
                ]);
            }
            // Should handle gracefully without errors
            expect(true).toBe(true); // Just ensure no crashes occur
        }));
    });
});
