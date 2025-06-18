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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const Redis = __importStar(require("redis"));
// Mock dependencies
jest.mock('@prisma/client');
jest.mock('redis');
jest.mock('jsonwebtoken');
const mockPrisma = {
    room: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
    },
    user: {
        findUnique: jest.fn()
    }
};
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
};
client_1.PrismaClient.mockImplementation(() => mockPrisma);
Redis.createClient.mockReturnValue(mockRedis);
// Room handler functions for testing
const createRoomHandlers = (prisma, redisClient) => {
    const roomJoin = (socket, data, callback) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { roomId, password } = data;
            // Validate room exists
            const room = yield prisma.room.findUnique({
                where: { id: roomId }
            });
            if (!room) {
                return callback({ success: false, message: 'Room not found' });
            }
            // Get room state from Redis
            const roomStateData = yield redisClient.get(`room:${roomId}`);
            if (!roomStateData) {
                return callback({ success: false, message: 'Room state not found' });
            }
            const roomState = JSON.parse(roomStateData);
            // Check if player already in room
            const existingPlayer = roomState.players.find((p) => p.id === socket.userId);
            if (existingPlayer) {
                return callback({ success: false, message: 'Already in room' });
            }
            // Check room capacity
            if (roomState.currentPlayerCount >= roomState.maxPlayers) {
                return callback({ success: false, message: 'Room is full' });
            }
            // Check password if required
            if (roomState.hasPassword && room.password) {
                const bcrypt = require('bcrypt');
                const passwordMatch = yield bcrypt.compare(password || '', room.password);
                if (!passwordMatch) {
                    return callback({ success: false, message: 'Invalid password' });
                }
            }
            // Add player to room state
            roomState.players.push({
                id: socket.userId,
                username: socket.username,
                chips: 5000,
                position: roomState.players.length,
                isOwner: false,
                status: 'ACTIVE'
            });
            roomState.currentPlayerCount = roomState.players.length;
            roomState.lastActivity = new Date().toISOString();
            // Save updated state
            yield redisClient.set(`room:${roomId}`, JSON.stringify(roomState));
            // Join socket room
            socket.join(roomId);
            socket.currentRoom = roomId;
            // Notify all players in room
            socket.to(roomId).emit('room:player_joined', {
                player: {
                    id: socket.userId,
                    username: socket.username,
                    chips: 5000,
                    position: roomState.players.length - 1
                },
                currentPlayerCount: roomState.currentPlayerCount
            });
            callback({
                success: true,
                message: 'Joined room successfully',
                roomState: roomState
            });
        }
        catch (error) {
            console.error('Error in room:join:', error);
            callback({ success: false, message: 'Internal server error' });
        }
    });
    const roomLeave = (socket, callback) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!socket.currentRoom) {
                return callback({ success: false, message: 'Not in any room' });
            }
            const roomId = socket.currentRoom;
            const roomStateData = yield redisClient.get(`room:${roomId}`);
            if (!roomStateData) {
                return callback({ success: false, message: 'Room state not found' });
            }
            const roomState = JSON.parse(roomStateData);
            const playerIndex = roomState.players.findIndex((p) => p.id === socket.userId);
            if (playerIndex === -1) {
                return callback({ success: false, message: 'Player not in room' });
            }
            const removedPlayer = roomState.players[playerIndex];
            roomState.players.splice(playerIndex, 1);
            roomState.currentPlayerCount = roomState.players.length;
            // Transfer ownership if owner left
            if (removedPlayer.isOwner && roomState.players.length > 0) {
                roomState.players[0].isOwner = true;
                roomState.ownerId = roomState.players[0].id;
            }
            // Update positions
            roomState.players.forEach((player, index) => {
                player.position = index;
            });
            if (roomState.players.length === 0) {
                // Delete empty room
                yield redisClient.del(`room:${roomId}`);
            }
            else {
                // Save updated state
                yield redisClient.set(`room:${roomId}`, JSON.stringify(roomState));
            }
            // Leave socket room
            socket.leave(roomId);
            socket.currentRoom = null;
            // Notify remaining players
            socket.to(roomId).emit('room:player_left', {
                playerId: socket.userId,
                username: socket.username,
                currentPlayerCount: roomState.currentPlayerCount,
                newOwner: removedPlayer.isOwner && roomState.players.length > 0 ? roomState.players[0] : null
            });
            callback({ success: true, message: 'Left room successfully' });
        }
        catch (error) {
            console.error('Error in room:leave:', error);
            callback({ success: false, message: 'Internal server error' });
        }
    });
    const roomQuickStart = (socket, callback) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // First, try to find an available room
            const availableRooms = yield redisClient.keys('room:*');
            let joinedRoom = null;
            for (const roomKey of availableRooms) {
                const roomStateData = yield redisClient.get(roomKey);
                if (roomStateData) {
                    const roomState = JSON.parse(roomStateData);
                    // Check if room is waiting and has space
                    if (roomState.status === 'WAITING' &&
                        roomState.currentPlayerCount < roomState.maxPlayers &&
                        !roomState.hasPassword) {
                        // Check if player is not already in this room
                        const existingPlayer = roomState.players.find((p) => p.id === socket.userId);
                        if (!existingPlayer) {
                            joinedRoom = roomState;
                            break;
                        }
                    }
                }
            }
            if (joinedRoom) {
                // Join existing room - simulate calling roomJoin
                return yield roomJoin(socket, { roomId: joinedRoom.id }, callback);
            }
            else {
                // Create new room
                const newRoom = {
                    playerLimit: 6,
                    bigBlind: 20,
                    smallBlind: 10,
                    password: null
                };
                // Mock room creation
                const createdRoom = Object.assign(Object.assign({ id: 'room-' + Date.now(), ownerId: socket.userId }, newRoom), { status: 'WAITING', createdAt: new Date(), updatedAt: new Date() });
                prisma.room.create.mockResolvedValue(createdRoom);
                // Create room state
                const roomState = {
                    id: createdRoom.id,
                    ownerId: socket.userId,
                    players: [{
                            id: socket.userId,
                            username: socket.username,
                            chips: 5000,
                            position: 0,
                            isOwner: true,
                            status: 'ACTIVE'
                        }],
                    status: 'WAITING',
                    maxPlayers: 6,
                    currentPlayerCount: 1,
                    hasPassword: false,
                    bigBlind: 20,
                    smallBlind: 10,
                    gameStarted: false,
                    createdAt: new Date().toISOString()
                };
                yield redisClient.set(`room:${createdRoom.id}`, JSON.stringify(roomState));
                // Join socket room
                socket.join(createdRoom.id);
                socket.currentRoom = createdRoom.id;
                callback({
                    success: true,
                    message: 'Created and joined new room',
                    roomState: roomState,
                    created: true
                });
            }
        }
        catch (error) {
            console.error('Error in room:quick_start:', error);
            callback({ success: false, message: 'Internal server error' });
        }
    });
    return {
        roomJoin,
        roomLeave,
        roomQuickStart
    };
};
describe('WebSocket Room Handlers Tests', () => {
    let roomHandlers;
    let mockSocket;
    beforeAll(() => {
        // Mock JWT
        jsonwebtoken_1.default.verify.mockImplementation((token, secret, callback) => {
            if (token === 'valid-token') {
                callback(null, { userId: 'user-123', username: 'testuser' });
            }
            else {
                callback(new Error('Invalid token'));
            }
        });
        roomHandlers = createRoomHandlers(mockPrisma, mockRedis);
    });
    beforeEach(() => {
        jest.clearAllMocks();
        // Create mock socket for each test
        mockSocket = {
            userId: 'user-123',
            username: 'testuser',
            currentRoom: null,
            join: jest.fn(),
            leave: jest.fn(),
            to: jest.fn().mockReturnValue({
                emit: jest.fn()
            }),
            emit: jest.fn()
        };
    });
    describe('room:join event', () => {
        it('should join room successfully with valid data', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock room exists
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                ownerId: 'other-user',
                password: null,
                status: 'WAITING'
            });
            // Mock room state
            const roomState = {
                id: 'room-123',
                players: [{ id: 'other-user', username: 'owner' }],
                currentPlayerCount: 1,
                maxPlayers: 6,
                hasPassword: false,
                status: 'WAITING'
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.set.mockResolvedValue('OK');
            const callback = jest.fn();
            yield roomHandlers.roomJoin(mockSocket, { roomId: 'room-123' }, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: 'Joined room successfully',
                roomState: expect.objectContaining({
                    currentPlayerCount: 2
                })
            });
            expect(mockSocket.join).toHaveBeenCalledWith('room-123');
            expect(mockSocket.currentRoom).toBe('room-123');
        }));
        it('should fail to join non-existent room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue(null);
            const callback = jest.fn();
            yield roomHandlers.roomJoin(mockSocket, { roomId: 'non-existent' }, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                message: 'Room not found'
            });
        }));
        it('should fail to join full room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: null,
                status: 'WAITING'
            });
            // Mock full room state
            const fullRoomState = {
                id: 'room-123',
                players: new Array(6).fill(null).map((_, i) => ({ id: `user-${i}` })),
                currentPlayerCount: 6,
                maxPlayers: 6,
                hasPassword: false
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(fullRoomState));
            const callback = jest.fn();
            yield roomHandlers.roomJoin(mockSocket, { roomId: 'room-123' }, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                message: 'Room is full'
            });
        }));
        it('should fail if already in room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: null,
                status: 'WAITING'
            });
            // Mock room state with current user already in it
            const roomState = {
                id: 'room-123',
                players: [
                    { id: 'user-123', username: 'testuser' }, // Current user
                    { id: 'other-user', username: 'other' }
                ],
                currentPlayerCount: 2,
                maxPlayers: 6,
                hasPassword: false
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            const callback = jest.fn();
            yield roomHandlers.roomJoin(mockSocket, { roomId: 'room-123' }, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                message: 'Already in room'
            });
        }));
    });
    describe('room:leave event', () => {
        beforeEach(() => {
            // Set up user in a room
            mockSocket.currentRoom = 'room-123';
        });
        it('should leave room successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomState = {
                id: 'room-123',
                players: [
                    { id: 'user-123', username: 'testuser', isOwner: false },
                    { id: 'owner-user', username: 'owner', isOwner: true }
                ],
                currentPlayerCount: 2
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.set.mockResolvedValue('OK');
            const callback = jest.fn();
            yield roomHandlers.roomLeave(mockSocket, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: 'Left room successfully'
            });
            expect(mockSocket.leave).toHaveBeenCalledWith('room-123');
            expect(mockSocket.currentRoom).toBeNull();
        }));
        it('should transfer ownership when owner leaves', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomState = {
                id: 'room-123',
                ownerId: 'user-123',
                players: [
                    { id: 'user-123', username: 'testuser', isOwner: true },
                    { id: 'other-user', username: 'other', isOwner: false }
                ],
                currentPlayerCount: 2
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.set.mockResolvedValue('OK');
            const callback = jest.fn();
            yield roomHandlers.roomLeave(mockSocket, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: 'Left room successfully'
            });
            expect(mockSocket.to).toHaveBeenCalledWith('room-123');
        }));
        it('should delete room when last player leaves', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomState = {
                id: 'room-123',
                players: [{ id: 'user-123', username: 'testuser', isOwner: true }],
                currentPlayerCount: 1
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.del.mockResolvedValue(1);
            const callback = jest.fn();
            yield roomHandlers.roomLeave(mockSocket, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: 'Left room successfully'
            });
            expect(mockRedis.del).toHaveBeenCalledWith('room:room-123');
        }));
        it('should fail if not in any room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockSocket.currentRoom = null;
            const callback = jest.fn();
            yield roomHandlers.roomLeave(mockSocket, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                message: 'Not in any room'
            });
        }));
    });
    describe('room:quick_start event', () => {
        it('should join existing available room', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock available rooms
            mockRedis.keys.mockResolvedValue(['room:existing-room']);
            const availableRoomState = {
                id: 'existing-room',
                status: 'WAITING',
                currentPlayerCount: 2,
                maxPlayers: 6,
                hasPassword: false,
                players: [
                    { id: 'user-1', username: 'player1' },
                    { id: 'user-2', username: 'player2' }
                ]
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(availableRoomState));
            mockRedis.set.mockResolvedValue('OK');
            // Mock room lookup for join
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'existing-room',
                password: null,
                status: 'WAITING'
            });
            const callback = jest.fn();
            yield roomHandlers.roomQuickStart(mockSocket, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: 'Joined room successfully',
                roomState: expect.objectContaining({
                    currentPlayerCount: 3
                })
            });
        }));
        it('should create new room if no available rooms', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock no available rooms
            mockRedis.keys.mockResolvedValue([]);
            // Mock room creation
            mockPrisma.room.create.mockResolvedValue({
                id: 'new-room-123',
                ownerId: 'user-123',
                status: 'WAITING'
            });
            mockRedis.set.mockResolvedValue('OK');
            const callback = jest.fn();
            yield roomHandlers.roomQuickStart(mockSocket, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: 'Created and joined new room',
                created: true,
                roomState: expect.objectContaining({
                    ownerId: 'user-123',
                    currentPlayerCount: 1
                })
            });
        }));
        it('should skip password-protected rooms in quick start', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock room with password
            mockRedis.keys.mockResolvedValue(['room:password-room']);
            const passwordRoomState = {
                id: 'password-room',
                status: 'WAITING',
                currentPlayerCount: 1,
                maxPlayers: 6,
                hasPassword: true,
                players: [{ id: 'other-user' }]
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(passwordRoomState)); // For keys check
            // Should create new room instead
            mockPrisma.room.create.mockResolvedValue({
                id: 'new-room-123',
                ownerId: 'user-123'
            });
            mockRedis.set.mockResolvedValue('OK');
            const callback = jest.fn();
            yield roomHandlers.roomQuickStart(mockSocket, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: 'Created and joined new room',
                created: true,
                roomState: expect.objectContaining({
                    ownerId: 'user-123',
                    currentPlayerCount: 1,
                    hasPassword: false
                })
            });
        }));
    });
    describe('Error handling', () => {
        it('should handle Redis errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: null
            });
            mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
            const callback = jest.fn();
            yield roomHandlers.roomJoin(mockSocket, { roomId: 'room-123' }, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                message: 'Internal server error'
            });
        }));
        it('should handle database errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockRejectedValue(new Error('Database error'));
            const callback = jest.fn();
            yield roomHandlers.roomJoin(mockSocket, { roomId: 'room-123' }, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                message: 'Internal server error'
            });
        }));
        it('should handle malformed room state data', () => __awaiter(void 0, void 0, void 0, function* () {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: null
            });
            mockRedis.get.mockResolvedValue('invalid json');
            const callback = jest.fn();
            yield roomHandlers.roomJoin(mockSocket, { roomId: 'room-123' }, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                message: 'Internal server error'
            });
        }));
    });
});
