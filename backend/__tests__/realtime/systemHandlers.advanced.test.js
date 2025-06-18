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
const socket_1 = require("../../src/types/socket");
const systemHandlers_1 = require("../../src/socket/handlers/systemHandlers");
const userStateService_1 = require("../../src/services/userStateService");
const db_1 = require("../../src/db");
// Mock dependencies
jest.mock('@/services/userStateService');
jest.mock('@/db');
describe('SystemHandlers Enhanced Features', () => {
    let mockSocket;
    let mockIo;
    let mockCallback;
    beforeEach(() => {
        mockCallback = jest.fn();
        mockSocket = {
            data: {
                userId: 'user-123',
                username: 'testuser'
            },
            on: jest.fn(),
            emit: jest.fn().mockReturnValue(true),
            join: jest.fn().mockResolvedValue(undefined),
            to: jest.fn().mockReturnThis(),
        };
        mockIo = {
            emit: jest.fn(),
        };
        // Clear all mocks
        jest.clearAllMocks();
    });
    describe('GET_USER_CURRENT_ROOM event handler', () => {
        beforeEach(() => {
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
        });
        it('should return null roomId when user has no current room', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(null);
            // Find the GET_USER_CURRENT_ROOM handler
            const handler = (_a = mockSocket.on.mock.calls.find((call) => call[0] === 'GET_USER_CURRENT_ROOM')) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({}, mockCallback);
            expect(userStateService_1.userStateService.getUserCurrentRoom).toHaveBeenCalledWith('user-123');
            expect(mockCallback).toHaveBeenCalledWith({
                success: true,
                data: { roomId: null }
            });
        }));
        it('should return room details when user is in a room', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const mockRoomState = {
                id: 'room-123',
                status: 'waiting',
                maxPlayers: 6,
                currentPlayerCount: 3,
                players: [
                    { id: 'user-123', username: 'testuser' },
                    { id: 'user-456', username: 'player2' },
                    { id: 'user-789', username: 'player3' }
                ],
                gameStarted: false
            };
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-123');
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            const handler = (_a = mockSocket.on.mock.calls.find((call) => call[0] === 'GET_USER_CURRENT_ROOM')) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({}, mockCallback);
            expect(db_1.redisClient.get).toHaveBeenCalledWith('room:room-123');
            expect(mockCallback).toHaveBeenCalledWith({
                success: true,
                data: {
                    roomId: 'room-123',
                    roomDetails: {
                        playerCount: 3,
                        isGameStarted: false,
                        roomState: {
                            id: 'room-123',
                            status: 'waiting',
                            maxPlayers: 6,
                            currentPlayerCount: 3
                        }
                    }
                }
            });
        }));
        it('should clear user state when room does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-nonexistent');
            db_1.redisClient.get.mockResolvedValue(null);
            userStateService_1.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
            const handler = (_a = mockSocket.on.mock.calls.find((call) => call[0] === 'GET_USER_CURRENT_ROOM')) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({}, mockCallback);
            expect(userStateService_1.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
            expect(mockCallback).toHaveBeenCalledWith({
                success: true,
                data: { roomId: null }
            });
        }));
        it('should handle errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            userStateService_1.userStateService.getUserCurrentRoom.mockRejectedValue(new Error('Database error'));
            const handler = (_a = mockSocket.on.mock.calls.find((call) => call[0] === 'GET_USER_CURRENT_ROOM')) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({}, mockCallback);
            expect(mockCallback).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to get current room status',
                message: 'Internal server error'
            });
        }));
    });
    describe('Enhanced RECONNECT_ATTEMPT handler', () => {
        beforeEach(() => {
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
        });
        it('should handle room state inconsistency', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const mockRoomState = {
                id: 'room-456',
                players: [
                    { id: 'user-123', username: 'testuser', isConnected: false }
                ]
            };
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-789');
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            userStateService_1.userStateService.forceLeaveCurrentRoom.mockResolvedValue(undefined);
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT)) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({ roomId: 'room-456' });
            expect(userStateService_1.userStateService.forceLeaveCurrentRoom).toHaveBeenCalledWith('user-123', mockSocket, mockIo, 'Reconnecting to different room');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'You are not a member of this room',
                code: 'ROOM_ACCESS_DENIED'
            });
        }));
        it('should successfully reconnect user to existing room', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const mockRoomState = {
                id: 'room-123',
                gameState: { phase: 'preflop' },
                players: [
                    {
                        id: 'user-123',
                        username: 'testuser',
                        avatar: 'avatar.jpg',
                        chips: 1000,
                        isReady: true,
                        position: 0,
                        isConnected: false,
                        lastAction: null
                    }
                ]
            };
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-123');
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            userStateService_1.userStateService.setUserCurrentRoom.mockResolvedValue(undefined);
            db_1.redisClient.setEx.mockResolvedValue('OK');
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT)) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({ roomId: 'room-123' });
            expect(mockSocket.join).toHaveBeenCalledWith('room-123');
            expect(userStateService_1.userStateService.setUserCurrentRoom).toHaveBeenCalledWith('user-123', 'room-123');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.RECONNECTED, {
                roomId: 'room-123',
                gameState: { phase: 'preflop' },
                roomState: mockRoomState
            });
        }));
        it('should handle room not found during reconnection', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-123');
            db_1.redisClient.get.mockResolvedValue(null);
            userStateService_1.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT)) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({ roomId: 'room-123' });
            expect(userStateService_1.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'Room not found',
                code: 'ROOM_NOT_FOUND'
            });
        }));
        it('should attempt recovery when no roomId is provided', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const mockRoomState = {
                id: 'room-456',
                gameState: { phase: 'turn' },
                players: [
                    { id: 'user-123', username: 'testuser', isConnected: false }
                ]
            };
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-456');
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            userStateService_1.userStateService.setUserCurrentRoom.mockResolvedValue(undefined);
            db_1.redisClient.setEx.mockResolvedValue('OK');
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT)) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({});
            expect(mockSocket.join).toHaveBeenCalledWith('room-456');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.RECONNECTED, {
                roomId: 'room-456',
                gameState: { phase: 'turn' },
                roomState: mockRoomState
            });
        }));
        it('should clean up inconsistent state when room does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-nonexistent');
            db_1.redisClient.get.mockResolvedValue(null);
            userStateService_1.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT)) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({});
            expect(userStateService_1.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.RECONNECTED, {
                roomId: 'room-nonexistent'
            });
        }));
        it('should handle errors during reconnection', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            userStateService_1.userStateService.getUserCurrentRoom.mockRejectedValue(new Error('Redis connection error'));
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT)) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({ roomId: 'room-123' });
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'Reconnection failed',
                code: 'RECONNECT_FAILED'
            });
        }));
    });
    describe('Rate limiting', () => {
        it('should apply rate limiting to socket messages', () => {
            const originalEmit = mockSocket.emit;
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            // The emit function should be wrapped with rate limiting
            expect(mockSocket.emit).not.toBe(originalEmit);
        });
    });
    describe('PING handler', () => {
        it('should respond to ping with timestamp', () => {
            var _a;
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.PING)) === null || _a === void 0 ? void 0 : _a[1];
            const startTime = Date.now();
            handler(mockCallback);
            expect(mockCallback).toHaveBeenCalledWith(expect.any(Number));
            const responseTime = mockCallback.mock.calls[0][0];
            expect(responseTime).toBeGreaterThanOrEqual(startTime);
        });
    });
    describe('Heartbeat monitoring', () => {
        it('should set up heartbeat interval', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
        });
        it('should clean up heartbeat on disconnect', () => {
            var _a;
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const disconnectHandler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.DISCONNECT)) === null || _a === void 0 ? void 0 : _a[1];
            disconnectHandler();
            expect(clearIntervalSpy).toHaveBeenCalled();
        });
    });
    describe('Room state validation', () => {
        it('should validate room state consistency during reconnection', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const mockRoomState = {
                id: 'room-123',
                players: [
                    { id: 'user-456', username: 'otheruser' } // User not in room
                ]
            };
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue('room-123');
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            userStateService_1.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
            const handler = (_a = mockSocket.on.mock.calls.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT)) === null || _a === void 0 ? void 0 : _a[1];
            yield handler({ roomId: 'room-123' });
            expect(userStateService_1.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'You are not a member of this room',
                code: 'ROOM_ACCESS_DENIED'
            });
        }));
    });
});
