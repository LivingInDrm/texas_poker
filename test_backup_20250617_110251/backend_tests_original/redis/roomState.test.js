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
Object.defineProperty(exports, "__esModule", { value: true });
const Redis = __importStar(require("redis"));
// Mock Redis client
jest.mock('redis');
describe('Room State Management in Redis', () => {
    let mockRedisClient;
    let roomStateManager;
    beforeAll(() => {
        // Mock Redis client
        mockRedisClient = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
            keys: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            hSet: jest.fn(),
            hGet: jest.fn(),
            hGetAll: jest.fn(),
            hDel: jest.fn()
        };
        Redis.createClient.mockReturnValue(mockRedisClient);
        // Create a room state manager for testing
        roomStateManager = {
            createRoomState: (roomData) => __awaiter(void 0, void 0, void 0, function* () {
                const roomState = {
                    id: roomData.id,
                    ownerId: roomData.ownerId,
                    players: [{
                            id: roomData.ownerId,
                            username: roomData.ownerUsername,
                            chips: 5000,
                            position: 0,
                            isOwner: true,
                            status: 'ACTIVE'
                        }],
                    status: 'WAITING',
                    maxPlayers: roomData.playerLimit,
                    currentPlayerCount: 1,
                    hasPassword: !!roomData.password,
                    bigBlind: roomData.bigBlind,
                    smallBlind: roomData.smallBlind,
                    gameStarted: false,
                    dealerPosition: 0,
                    currentTurn: null,
                    pot: 0,
                    communityCards: [],
                    gamePhase: 'WAITING',
                    createdAt: new Date().toISOString(),
                    lastActivity: new Date().toISOString()
                };
                yield mockRedisClient.set(`room:${roomData.id}`, JSON.stringify(roomState), 'EX', 3600 // 1 hour expiry
                );
                return roomState;
            }),
            getRoomState: (roomId) => __awaiter(void 0, void 0, void 0, function* () {
                const data = yield mockRedisClient.get(`room:${roomId}`);
                return data ? JSON.parse(data) : null;
            }),
            addPlayerToRoom: (roomId, playerData) => __awaiter(void 0, void 0, void 0, function* () {
                const roomState = yield roomStateManager.getRoomState(roomId);
                if (!roomState) {
                    throw new Error('Room not found');
                }
                // Check if player already in room
                const existingPlayer = roomState.players.find((p) => p.id === playerData.id);
                if (existingPlayer) {
                    throw new Error('Player already in room');
                }
                // Check room capacity
                if (roomState.currentPlayerCount >= roomState.maxPlayers) {
                    throw new Error('Room is full');
                }
                // Add player to room
                roomState.players.push({
                    id: playerData.id,
                    username: playerData.username,
                    chips: 5000,
                    position: roomState.players.length,
                    isOwner: false,
                    status: 'ACTIVE'
                });
                roomState.currentPlayerCount = roomState.players.length;
                roomState.lastActivity = new Date().toISOString();
                yield mockRedisClient.set(`room:${roomId}`, JSON.stringify(roomState), 'EX', 3600);
                return roomState;
            }),
            removePlayerFromRoom: (roomId, playerId) => __awaiter(void 0, void 0, void 0, function* () {
                const roomState = yield roomStateManager.getRoomState(roomId);
                if (!roomState) {
                    throw new Error('Room not found');
                }
                const playerIndex = roomState.players.findIndex((p) => p.id === playerId);
                if (playerIndex === -1) {
                    throw new Error('Player not in room');
                }
                const removedPlayer = roomState.players[playerIndex];
                roomState.players.splice(playerIndex, 1);
                roomState.currentPlayerCount = roomState.players.length;
                // If owner left and there are other players, transfer ownership
                if (removedPlayer.isOwner && roomState.players.length > 0) {
                    roomState.players[0].isOwner = true;
                    roomState.ownerId = roomState.players[0].id;
                }
                // Update positions
                roomState.players.forEach((player, index) => {
                    player.position = index;
                });
                roomState.lastActivity = new Date().toISOString();
                if (roomState.players.length === 0) {
                    // Delete empty room
                    yield mockRedisClient.del(`room:${roomId}`);
                    return null;
                }
                else {
                    yield mockRedisClient.set(`room:${roomId}`, JSON.stringify(roomState), 'EX', 3600);
                    return roomState;
                }
            }),
            updateRoomStatus: (roomId, status) => __awaiter(void 0, void 0, void 0, function* () {
                const roomState = yield roomStateManager.getRoomState(roomId);
                if (!roomState) {
                    throw new Error('Room not found');
                }
                roomState.status = status;
                roomState.lastActivity = new Date().toISOString();
                yield mockRedisClient.set(`room:${roomId}`, JSON.stringify(roomState), 'EX', 3600);
                return roomState;
            }),
            deleteRoom: (roomId) => __awaiter(void 0, void 0, void 0, function* () {
                const result = yield mockRedisClient.del(`room:${roomId}`);
                return result > 0;
            }),
            getAllRooms: () => __awaiter(void 0, void 0, void 0, function* () {
                const keys = yield mockRedisClient.keys('room:*');
                const rooms = [];
                for (const key of keys) {
                    const data = yield mockRedisClient.get(key);
                    if (data) {
                        rooms.push(JSON.parse(data));
                    }
                }
                return rooms;
            }),
            getRoomsByStatus: (status) => __awaiter(void 0, void 0, void 0, function* () {
                const allRooms = yield roomStateManager.getAllRooms();
                return allRooms.filter((room) => room.status === status);
            })
        };
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('Room State Creation and Retrieval', () => {
        it('should create a new room state successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomData = {
                id: 'room-123',
                ownerId: 'user-456',
                ownerUsername: 'testowner',
                playerLimit: 6,
                password: 'test123',
                bigBlind: 20,
                smallBlind: 10
            };
            mockRedisClient.set.mockResolvedValue('OK');
            const roomState = yield roomStateManager.createRoomState(roomData);
            expect(roomState).toMatchObject({
                id: 'room-123',
                ownerId: 'user-456',
                status: 'WAITING',
                maxPlayers: 6,
                currentPlayerCount: 1,
                hasPassword: true,
                bigBlind: 20,
                smallBlind: 10,
                gameStarted: false
            });
            expect(roomState.players).toHaveLength(1);
            expect(roomState.players[0]).toMatchObject({
                id: 'user-456',
                username: 'testowner',
                chips: 5000,
                position: 0,
                isOwner: true,
                status: 'ACTIVE'
            });
            expect(mockRedisClient.set).toHaveBeenCalledWith('room:room-123', expect.stringContaining('"id":"room-123"'), 'EX', 3600);
        }));
        it('should retrieve room state by ID', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockRoomState = {
                id: 'room-123',
                ownerId: 'user-456',
                players: [{ id: 'user-456', username: 'owner' }],
                status: 'WAITING',
                currentPlayerCount: 1
            };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            const roomState = yield roomStateManager.getRoomState('room-123');
            expect(roomState).toEqual(mockRoomState);
            expect(mockRedisClient.get).toHaveBeenCalledWith('room:room-123');
        }));
        it('should return null for non-existent room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.get.mockResolvedValue(null);
            const roomState = yield roomStateManager.getRoomState('non-existent');
            expect(roomState).toBeNull();
        }));
    });
    describe('Player Management', () => {
        let mockRoomState;
        beforeEach(() => {
            mockRoomState = {
                id: 'room-123',
                ownerId: 'user-456',
                players: [{
                        id: 'user-456',
                        username: 'owner',
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
                dealerPosition: 0,
                currentTurn: null,
                pot: 0,
                communityCards: [],
                gamePhase: 'WAITING',
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };
        });
        it('should add a player to room successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            mockRedisClient.set.mockResolvedValue('OK');
            const playerData = {
                id: 'user-789',
                username: 'newplayer'
            };
            const updatedState = yield roomStateManager.addPlayerToRoom('room-123', playerData);
            expect(updatedState.players).toHaveLength(2);
            expect(updatedState.currentPlayerCount).toBe(2);
            expect(updatedState.players[1]).toMatchObject({
                id: 'user-789',
                username: 'newplayer',
                chips: 5000,
                position: 1,
                isOwner: false,
                status: 'ACTIVE'
            });
            expect(mockRedisClient.set).toHaveBeenCalledWith('room:room-123', expect.stringContaining('"currentPlayerCount":2'), 'EX', 3600);
        }));
        it('should fail to add player when room is full', () => __awaiter(void 0, void 0, void 0, function* () {
            const fullRoomState = Object.assign(Object.assign({}, mockRoomState), { players: new Array(6).fill(null).map((_, i) => ({
                    id: `user-${i}`,
                    username: `player${i}`,
                    position: i,
                    chips: 5000,
                    isOwner: false,
                    status: 'ACTIVE'
                })), currentPlayerCount: 6, maxPlayers: 6 });
            mockRedisClient.get.mockResolvedValue(JSON.stringify(fullRoomState));
            const playerData = { id: 'user-new', username: 'newplayer' };
            yield expect(roomStateManager.addPlayerToRoom('room-123', playerData)).rejects.toThrow('Room is full');
        }));
        it('should fail to add player already in room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            const playerData = { id: 'user-456', username: 'owner' }; // Already in room
            yield expect(roomStateManager.addPlayerToRoom('room-123', playerData)).rejects.toThrow('Player already in room');
        }));
        it('should remove player from room successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomWithMultiplePlayers = Object.assign(Object.assign({}, mockRoomState), { players: [
                    { id: 'user-456', username: 'owner', position: 0, isOwner: true, chips: 5000, status: 'ACTIVE' },
                    { id: 'user-789', username: 'player2', position: 1, isOwner: false, chips: 5000, status: 'ACTIVE' },
                    { id: 'user-101', username: 'player3', position: 2, isOwner: false, chips: 5000, status: 'ACTIVE' }
                ], currentPlayerCount: 3 });
            mockRedisClient.get.mockResolvedValue(JSON.stringify(roomWithMultiplePlayers));
            mockRedisClient.set.mockResolvedValue('OK');
            const updatedState = yield roomStateManager.removePlayerFromRoom('room-123', 'user-789');
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players).toHaveLength(2);
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.currentPlayerCount).toBe(2);
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players.find((p) => p.id === 'user-789')).toBeUndefined();
            // Check positions were updated
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players[0].position).toBe(0);
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players[1].position).toBe(1);
        }));
        it('should transfer ownership when owner leaves', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomWithMultiplePlayers = Object.assign(Object.assign({}, mockRoomState), { players: [
                    { id: 'user-456', username: 'owner', position: 0, isOwner: true, chips: 5000, status: 'ACTIVE' },
                    { id: 'user-789', username: 'player2', position: 1, isOwner: false, chips: 5000, status: 'ACTIVE' }
                ], currentPlayerCount: 2 });
            mockRedisClient.get.mockResolvedValue(JSON.stringify(roomWithMultiplePlayers));
            mockRedisClient.set.mockResolvedValue('OK');
            const updatedState = yield roomStateManager.removePlayerFromRoom('room-123', 'user-456');
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players).toHaveLength(1);
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.ownerId).toBe('user-789');
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players[0]).toMatchObject({
                id: 'user-789',
                username: 'player2',
                position: 0,
                isOwner: true
            });
        }));
        it('should delete room when last player leaves', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            mockRedisClient.del.mockResolvedValue(1);
            const result = yield roomStateManager.removePlayerFromRoom('room-123', 'user-456');
            expect(result).toBeNull();
            expect(mockRedisClient.del).toHaveBeenCalledWith('room:room-123');
        }));
    });
    describe('Room Status Management', () => {
        it('should update room status successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomState = {
                id: 'room-123',
                status: 'WAITING',
                lastActivity: '2025-06-15T10:00:00.000Z'
            };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedisClient.set.mockResolvedValue('OK');
            const updatedState = yield roomStateManager.updateRoomStatus('room-123', 'PLAYING');
            expect(updatedState.status).toBe('PLAYING');
            expect(updatedState.lastActivity).not.toBe('2025-06-15T10:00:00.000Z');
            expect(mockRedisClient.set).toHaveBeenCalledWith('room:room-123', expect.stringContaining('"status":"PLAYING"'), 'EX', 3600);
        }));
        it('should fail to update status for non-existent room', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.get.mockResolvedValue(null);
            yield expect(roomStateManager.updateRoomStatus('non-existent', 'PLAYING')).rejects.toThrow('Room not found');
        }));
    });
    describe('Room Deletion', () => {
        it('should delete room successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.del.mockResolvedValue(1);
            const result = yield roomStateManager.deleteRoom('room-123');
            expect(result).toBe(true);
            expect(mockRedisClient.del).toHaveBeenCalledWith('room:room-123');
        }));
        it('should return false when room does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.del.mockResolvedValue(0);
            const result = yield roomStateManager.deleteRoom('non-existent');
            expect(result).toBe(false);
        }));
    });
    describe('Room Querying', () => {
        it('should get all rooms', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockRooms = [
                { id: 'room-1', status: 'WAITING' },
                { id: 'room-2', status: 'PLAYING' },
                { id: 'room-3', status: 'WAITING' }
            ];
            mockRedisClient.keys.mockResolvedValue(['room:room-1', 'room:room-2', 'room:room-3']);
            mockRedisClient.get
                .mockResolvedValueOnce(JSON.stringify(mockRooms[0]))
                .mockResolvedValueOnce(JSON.stringify(mockRooms[1]))
                .mockResolvedValueOnce(JSON.stringify(mockRooms[2]));
            const rooms = yield roomStateManager.getAllRooms();
            expect(rooms).toHaveLength(3);
            expect(rooms).toEqual(mockRooms);
            expect(mockRedisClient.keys).toHaveBeenCalledWith('room:*');
        }));
        it('should filter rooms by status', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockRooms = [
                { id: 'room-1', status: 'WAITING' },
                { id: 'room-2', status: 'PLAYING' },
                { id: 'room-3', status: 'WAITING' }
            ];
            mockRedisClient.keys.mockResolvedValue(['room:room-1', 'room:room-2', 'room:room-3']);
            mockRedisClient.get
                .mockResolvedValueOnce(JSON.stringify(mockRooms[0]))
                .mockResolvedValueOnce(JSON.stringify(mockRooms[1]))
                .mockResolvedValueOnce(JSON.stringify(mockRooms[2]));
            const waitingRooms = yield roomStateManager.getRoomsByStatus('WAITING');
            expect(waitingRooms).toHaveLength(2);
            expect(waitingRooms.every((room) => room.status === 'WAITING')).toBe(true);
        }));
        it('should handle empty room list', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.keys.mockResolvedValue([]);
            const rooms = yield roomStateManager.getAllRooms();
            expect(rooms).toHaveLength(0);
            expect(rooms).toEqual([]);
        }));
    });
    describe('Error Handling', () => {
        it('should handle Redis connection errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));
            const roomData = {
                id: 'room-123',
                ownerId: 'user-456',
                ownerUsername: 'testowner',
                playerLimit: 6,
                bigBlind: 20,
                smallBlind: 10
            };
            yield expect(roomStateManager.createRoomState(roomData)).rejects.toThrow('Redis connection failed');
        }));
        it('should handle malformed JSON data', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.get.mockResolvedValue('invalid json');
            yield expect(roomStateManager.getRoomState('room-123')).rejects.toThrow();
        }));
        it('should handle Redis timeout errors', () => __awaiter(void 0, void 0, void 0, function* () {
            mockRedisClient.get.mockRejectedValue(new Error('Command timeout'));
            yield expect(roomStateManager.getRoomState('room-123')).rejects.toThrow('Command timeout');
        }));
    });
    describe('Data Integrity', () => {
        it('should maintain consistent player count', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomState = {
                id: 'room-123',
                players: [
                    { id: 'user-1' },
                    { id: 'user-2' },
                    { id: 'user-3' }
                ],
                currentPlayerCount: 3,
                maxPlayers: 6
            };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedisClient.set.mockResolvedValue('OK');
            const playerData = { id: 'user-4', username: 'player4' };
            const updatedState = yield roomStateManager.addPlayerToRoom('room-123', playerData);
            expect(updatedState.players.length).toBe(updatedState.currentPlayerCount);
            expect(updatedState.currentPlayerCount).toBe(4);
        }));
        it('should maintain correct player positions after removal', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomState = {
                id: 'room-123',
                players: [
                    { id: 'user-1', position: 0, isOwner: true, chips: 5000, username: 'player1', status: 'ACTIVE' },
                    { id: 'user-2', position: 1, isOwner: false, chips: 5000, username: 'player2', status: 'ACTIVE' },
                    { id: 'user-3', position: 2, isOwner: false, chips: 5000, username: 'player3', status: 'ACTIVE' },
                    { id: 'user-4', position: 3, isOwner: false, chips: 5000, username: 'player4', status: 'ACTIVE' }
                ],
                currentPlayerCount: 4,
                ownerId: 'user-1'
            };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedisClient.set.mockResolvedValue('OK');
            // Remove middle player
            const updatedState = yield roomStateManager.removePlayerFromRoom('room-123', 'user-2');
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players).toHaveLength(3);
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players[0].position).toBe(0);
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players[1].position).toBe(1); // was user-3
            expect(updatedState === null || updatedState === void 0 ? void 0 : updatedState.players[2].position).toBe(2); // was user-4
        }));
        it('should preserve other room data when updating players', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomState = {
                id: 'room-123',
                ownerId: 'user-1',
                players: [{ id: 'user-1', isOwner: true, chips: 5000, username: 'owner', position: 0, status: 'ACTIVE' }],
                status: 'WAITING',
                maxPlayers: 6,
                currentPlayerCount: 1,
                bigBlind: 50,
                smallBlind: 25,
                hasPassword: true,
                gameStarted: false,
                pot: 0
            };
            mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
            mockRedisClient.set.mockResolvedValue('OK');
            const playerData = { id: 'user-2', username: 'player2' };
            const updatedState = yield roomStateManager.addPlayerToRoom('room-123', playerData);
            // Check that non-player data is preserved
            expect(updatedState.bigBlind).toBe(50);
            expect(updatedState.smallBlind).toBe(25);
            expect(updatedState.hasPassword).toBe(true);
            expect(updatedState.gameStarted).toBe(false);
            expect(updatedState.pot).toBe(0);
            expect(updatedState.status).toBe('WAITING');
        }));
    });
});
