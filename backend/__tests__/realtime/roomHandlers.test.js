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
const socket_io_1 = require("socket.io");
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const Redis = __importStar(require("redis"));
// Mock dependencies
jest.mock('@prisma/client');
jest.mock('redis');
jest.mock('jsonwebtoken');
const mockPrisma = {
    user: {
        findUnique: jest.fn()
    },
    room: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    }
};
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
};
client_1.PrismaClient.mockImplementation(() => mockPrisma);
Redis.createClient.mockReturnValue(mockRedis);
describe('WebSocket Room Handlers Tests', () => {
    let io;
    let serverSocket;
    let clientSocket;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // Mock JWT
        jsonwebtoken_1.default.verify.mockImplementation((token, secret, callback) => {
            if (token === 'valid-token') {
                callback(null, { userId: 'user-123', username: 'testuser' });
            }
            else {
                callback(new Error('Invalid token'));
            }
        });
        // Create Socket.IO server
        io = new socket_io_1.Server(3001, {
            cors: {
                origin: "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
        // Set up authentication middleware
        io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            jsonwebtoken_1.default.verify(token, 'test-secret', (err, decoded) => {
                if (err) {
                    return next(new Error('Authentication error'));
                }
                socket.data.userId = decoded.userId;
                socket.data.username = decoded.username;
                socket.data.authenticated = true;
                next();
            });
        });
        // Room handlers - simulate the actual handlers
        io.on('connection', (socket) => {
            console.log(`User ${socket.data.username} connected`);
            // room:join handler
            socket.on('room:join', (data, callback) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const { roomId, password } = data;
                    // Validate room exists
                    const room = yield mockPrisma.room.findUnique({
                        where: { id: roomId }
                    });
                    if (!room) {
                        return callback({ success: false, message: 'Room not found' });
                    }
                    // Get room state from Redis
                    const roomStateData = yield mockRedis.get(`room:${roomId}`);
                    if (!roomStateData) {
                        return callback({ success: false, message: 'Room state not found' });
                    }
                    const roomState = JSON.parse(roomStateData);
                    // Check if player already in room
                    const existingPlayer = roomState.players.find((p) => p.id === socket.data.userId);
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
                        id: socket.data.userId,
                        username: socket.data.username,
                        chips: 5000,
                        position: roomState.players.length,
                        isOwner: false,
                        status: 'ACTIVE'
                    });
                    roomState.currentPlayerCount = roomState.players.length;
                    roomState.lastActivity = new Date().toISOString();
                    // Save updated state
                    yield mockRedis.set(`room:${roomId}`, JSON.stringify(roomState));
                    // Join socket room
                    socket.join(roomId);
                    socket.data.roomId = roomId;
                    // Notify all players in room
                    socket.to(roomId).emit('room:player_joined', {
                        player: {
                            id: socket.data.userId,
                            username: socket.data.username,
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
            }));
            // room:leave handler
            socket.on('room:leave', (callback) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    if (!socket.data.roomId) {
                        return callback({ success: false, message: 'Not in any room' });
                    }
                    const roomId = socket.data.roomId;
                    const roomStateData = yield mockRedis.get(`room:${roomId}`);
                    if (!roomStateData) {
                        return callback({ success: false, message: 'Room state not found' });
                    }
                    const roomState = JSON.parse(roomStateData);
                    const playerIndex = roomState.players.findIndex((p) => p.id === socket.data.userId);
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
                        yield mockRedis.del(`room:${roomId}`);
                    }
                    else {
                        // Save updated state
                        yield mockRedis.set(`room:${roomId}`, JSON.stringify(roomState));
                    }
                    // Leave socket room
                    const currentRoomId = socket.data.roomId;
                    if (currentRoomId) {
                        socket.leave(currentRoomId);
                    }
                    socket.data.roomId = undefined;
                    // Notify remaining players
                    if (currentRoomId) {
                        socket.to(currentRoomId).emit('room:player_left', {
                            playerId: socket.data.userId,
                            username: socket.data.username,
                            currentPlayerCount: roomState.currentPlayerCount,
                            newOwner: removedPlayer.isOwner && roomState.players.length > 0 ? roomState.players[0] : null
                        });
                    }
                    callback({ success: true, message: 'Left room successfully' });
                }
                catch (error) {
                    console.error('Error in room:leave:', error);
                    callback({ success: false, message: 'Internal server error' });
                }
            }));
            // room:quick_start handler
            socket.on('room:quick_start', (callback) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    // First, try to find an available room
                    const availableRooms = yield mockRedis.keys('room:*');
                    let joinedRoom = null;
                    for (const roomKey of availableRooms) {
                        const roomStateData = yield mockRedis.get(roomKey);
                        if (roomStateData) {
                            const roomState = JSON.parse(roomStateData);
                            // Check if room is waiting and has space
                            if (roomState.status === 'WAITING' &&
                                roomState.currentPlayerCount < roomState.maxPlayers &&
                                !roomState.hasPassword) {
                                // Check if player is not already in this room
                                const existingPlayer = roomState.players.find((p) => p.id === socket.data.userId);
                                if (!existingPlayer) {
                                    joinedRoom = roomState;
                                    break;
                                }
                            }
                        }
                    }
                    if (joinedRoom) {
                        // Join existing room
                        socket.emit('room:join', { roomId: joinedRoom.id }, callback);
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
                        const createdRoom = Object.assign(Object.assign({ id: 'room-' + Date.now(), ownerId: socket.data.userId }, newRoom), { status: 'WAITING', createdAt: new Date(), updatedAt: new Date() });
                        mockPrisma.room.create.mockResolvedValue(createdRoom);
                        // Create room state
                        const roomState = {
                            id: createdRoom.id,
                            ownerId: socket.data.userId,
                            players: [{
                                    id: socket.data.userId,
                                    username: socket.data.username,
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
                        yield mockRedis.set(`room:${createdRoom.id}`, JSON.stringify(roomState));
                        // Join socket room
                        socket.join(createdRoom.id);
                        socket.data.roomId = createdRoom.id;
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
            }));
            // Handle disconnect
            socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
                console.log(`User ${socket.data.username} disconnected`);
                if (socket.data.roomId) {
                    // Auto-leave room on disconnect
                    socket.emit('room:leave', () => { });
                }
            }));
        });
        // Wait for server to start
        yield new Promise(resolve => {
            io.on('connection', () => resolve());
        });
    }));
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        // Clear all mocks
        jest.clearAllMocks();
        // Create client socket for each test
        clientSocket = (0, socket_io_client_1.default)(`http://localhost:3001`, {
            auth: {
                token: 'valid-token'
            }
        });
        // Wait for connection
        yield new Promise(resolve => {
            clientSocket.on('connect', resolve);
        });
        // Get server socket
        serverSocket = [...io.sockets.sockets.values()][0];
    }));
    afterEach(() => {
        if (clientSocket && clientSocket.connected) {
            clientSocket.disconnect();
        }
    });
    afterAll(() => {
        io.close();
    });
    describe('room:join event', () => {
        it('should join room successfully with valid data', (done) => {
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
            clientSocket.emit('room:join', { roomId: 'room-123' }, (response) => {
                expect(response.success).toBe(true);
                expect(response.message).toBe('Joined room successfully');
                expect(response.roomState).toBeDefined();
                expect(response.roomState.currentPlayerCount).toBe(2);
                done();
            });
        });
        it('should fail to join non-existent room', (done) => {
            mockPrisma.room.findUnique.mockResolvedValue(null);
            clientSocket.emit('room:join', { roomId: 'non-existent' }, (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Room not found');
                done();
            });
        });
        it('should fail to join full room', (done) => {
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
            clientSocket.emit('room:join', { roomId: 'room-123' }, (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Room is full');
                done();
            });
        });
        it('should fail to join room with wrong password', (done) => {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: 'hashed-password',
                status: 'WAITING'
            });
            const roomState = {
                id: 'room-123',
                players: [{ id: 'owner' }],
                currentPlayerCount: 1,
                maxPlayers: 6,
                hasPassword: true
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            // Mock bcrypt comparison
            const bcrypt = require('bcrypt');
            bcrypt.compare = jest.fn().mockResolvedValue(false);
            clientSocket.emit('room:join', {
                roomId: 'room-123',
                password: 'wrong-password'
            }, (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Invalid password');
                done();
            });
        });
        it('should fail if already in room', (done) => {
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
            clientSocket.emit('room:join', { roomId: 'room-123' }, (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Already in room');
                done();
            });
        });
    });
    describe('room:leave event', () => {
        beforeEach(() => {
            // Set up user in a room
            serverSocket.currentRoom = 'room-123';
            serverSocket.join('room-123');
        });
        it('should leave room successfully', (done) => {
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
            clientSocket.emit('room:leave', (response) => {
                expect(response.success).toBe(true);
                expect(response.message).toBe('Left room successfully');
                done();
            });
        });
        it('should transfer ownership when owner leaves', (done) => {
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
            // Listen for ownership transfer notification
            clientSocket.on('room:player_left', (data) => {
                expect(data.newOwner).toBeDefined();
                expect(data.newOwner.id).toBe('other-user');
                done();
            });
            clientSocket.emit('room:leave', (response) => {
                expect(response.success).toBe(true);
            });
        });
        it('should delete room when last player leaves', (done) => {
            const roomState = {
                id: 'room-123',
                players: [{ id: 'user-123', username: 'testuser', isOwner: true }],
                currentPlayerCount: 1
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.del.mockResolvedValue(1);
            clientSocket.emit('room:leave', (response) => {
                expect(response.success).toBe(true);
                expect(mockRedis.del).toHaveBeenCalledWith('room:room-123');
                done();
            });
        });
        it('should fail if not in any room', (done) => {
            serverSocket.currentRoom = null;
            clientSocket.emit('room:leave', (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Not in any room');
                done();
            });
        });
    });
    describe('room:quick_start event', () => {
        it('should join existing available room', (done) => {
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
            clientSocket.emit('room:quick_start', (response) => {
                expect(response.success).toBe(true);
                expect(response.roomState).toBeDefined();
                expect(response.created).toBeUndefined(); // Joined existing room
                done();
            });
        });
        it('should create new room if no available rooms', (done) => {
            // Mock no available rooms
            mockRedis.keys.mockResolvedValue([]);
            // Mock room creation
            const newRoomId = 'room-' + Date.now();
            mockPrisma.room.create.mockResolvedValue({
                id: newRoomId,
                ownerId: 'user-123',
                status: 'WAITING'
            });
            mockRedis.set.mockResolvedValue('OK');
            clientSocket.emit('room:quick_start', (response) => {
                expect(response.success).toBe(true);
                expect(response.created).toBe(true);
                expect(response.roomState).toBeDefined();
                expect(response.roomState.ownerId).toBe('user-123');
                expect(response.roomState.currentPlayerCount).toBe(1);
                done();
            });
        });
        it('should skip password-protected rooms in quick start', (done) => {
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
            mockRedis.get.mockResolvedValue(JSON.stringify(passwordRoomState));
            // Should create new room instead
            mockPrisma.room.create.mockResolvedValue({
                id: 'new-room',
                ownerId: 'user-123'
            });
            mockRedis.set.mockResolvedValue('OK');
            clientSocket.emit('room:quick_start', (response) => {
                expect(response.success).toBe(true);
                expect(response.created).toBe(true);
                expect(response.roomState.id).toBe('new-room');
                done();
            });
        });
        it('should skip rooms where user is already present', (done) => {
            mockRedis.keys.mockResolvedValue(['room:user-room']);
            const roomWithUser = {
                id: 'user-room',
                status: 'WAITING',
                currentPlayerCount: 2,
                maxPlayers: 6,
                hasPassword: false,
                players: [
                    { id: 'user-123', username: 'testuser' }, // Current user already in room
                    { id: 'other-user', username: 'other' }
                ]
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomWithUser));
            // Should create new room
            mockPrisma.room.create.mockResolvedValue({
                id: 'new-room',
                ownerId: 'user-123'
            });
            mockRedis.set.mockResolvedValue('OK');
            clientSocket.emit('room:quick_start', (response) => {
                expect(response.success).toBe(true);
                expect(response.created).toBe(true);
                done();
            });
        });
    });
    describe('Player notifications', () => {
        let secondClient;
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            // Create second client to test notifications
            secondClient = (0, socket_io_client_1.default)(`http://localhost:3001`, {
                auth: { token: 'valid-token' }
            });
            yield new Promise(resolve => {
                secondClient.on('connect', resolve);
            });
            // Both clients join the same room
            const roomState = {
                id: 'room-123',
                players: [{ id: 'existing-user', username: 'existing' }],
                currentPlayerCount: 1,
                maxPlayers: 6,
                hasPassword: false,
                status: 'WAITING'
            };
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: null,
                status: 'WAITING'
            });
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.set.mockResolvedValue('OK');
        }));
        afterEach(() => {
            if (secondClient && secondClient.connected) {
                secondClient.disconnect();
            }
        });
        it('should notify other players when someone joins', (done) => {
            secondClient.on('room:player_joined', (data) => {
                expect(data.player).toBeDefined();
                expect(data.player.username).toBe('testuser');
                expect(data.currentPlayerCount).toBe(2);
                done();
            });
            clientSocket.emit('room:join', { roomId: 'room-123' }, (response) => {
                expect(response.success).toBe(true);
            });
        });
        it('should notify other players when someone leaves', (done) => {
            // First join the room
            clientSocket.emit('room:join', { roomId: 'room-123' }, () => {
                // Then set up listener for leave notification
                secondClient.on('room:player_left', (data) => {
                    expect(data.playerId).toBe('user-123');
                    expect(data.username).toBe('testuser');
                    done();
                });
                // Leave the room
                clientSocket.emit('room:leave', () => { });
            });
        });
    });
    describe('Error handling', () => {
        it('should handle Redis errors gracefully', (done) => {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: null
            });
            mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
            clientSocket.emit('room:join', { roomId: 'room-123' }, (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Internal server error');
                done();
            });
        });
        it('should handle database errors gracefully', (done) => {
            mockPrisma.room.findUnique.mockRejectedValue(new Error('Database error'));
            clientSocket.emit('room:join', { roomId: 'room-123' }, (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Internal server error');
                done();
            });
        });
        it('should handle malformed room state data', (done) => {
            mockPrisma.room.findUnique.mockResolvedValue({
                id: 'room-123',
                password: null
            });
            mockRedis.get.mockResolvedValue('invalid json');
            clientSocket.emit('room:join', { roomId: 'room-123' }, (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Internal server error');
                done();
            });
        });
    });
    describe('Authentication', () => {
        it('should reject connections with invalid tokens', (done) => {
            const invalidClient = (0, socket_io_client_1.default)(`http://localhost:3001`, {
                auth: { token: 'invalid-token' }
            });
            invalidClient.on('connect_error', (error) => {
                expect(error.message).toContain('Authentication error');
                done();
            });
        });
        it('should reject connections without tokens', (done) => {
            const noTokenClient = (0, socket_io_client_1.default)(`http://localhost:3001`);
            noTokenClient.on('connect_error', (error) => {
                expect(error.message).toContain('Authentication error');
                done();
            });
        });
    });
    describe('Disconnect handling', () => {
        it('should handle auto-leave when user disconnects', (done) => {
            // Set up user in room
            const roomState = {
                id: 'room-123',
                players: [{ id: 'user-123', username: 'testuser' }],
                currentPlayerCount: 1
            };
            mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedis.del.mockResolvedValue(1);
            serverSocket.currentRoom = 'room-123';
            // Listen for disconnect
            serverSocket.on('disconnect', () => {
                // Verify auto-leave was triggered
                setTimeout(() => {
                    expect(mockRedis.del).toHaveBeenCalledWith('room:room-123');
                    done();
                }, 100);
            });
            // Simulate disconnect
            clientSocket.disconnect();
        });
    });
});
