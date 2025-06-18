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
const systemHandlers_1 = require("../../src/socket/handlers/systemHandlers");
const userStateService_1 = require("../../src/services/userStateService");
const db_1 = require("../../src/db");
const socket_1 = require("../../src/types/socket");
// Mock dependencies
jest.mock('../../src/services/userStateService');
jest.mock('../../src/db');
// Mock types for testing
const mockSocket = {
    data: {
        userId: 'test-user-id',
        username: 'test-user'
    },
    emit: jest.fn(),
    on: jest.fn(),
    join: jest.fn(),
    to: jest.fn().mockReturnValue({
        emit: jest.fn()
    }),
    connected: true
};
const mockIo = {
    emit: jest.fn()
};
const mockRoomState = {
    id: 'test-room-id',
    ownerId: 'test-owner-id',
    status: 'WAITING',
    maxPlayers: 6,
    currentPlayerCount: 2,
    hasPassword: false,
    bigBlind: 20,
    smallBlind: 10,
    players: [
        {
            id: 'test-user-id',
            username: 'test-user',
            avatar: 'avatar.png',
            chips: 1000,
            isReady: false,
            position: 0,
            isConnected: false,
            lastAction: undefined
        }
    ],
    gameStarted: false
};
describe('System Handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocks
        if (mockSocket.on && typeof mockSocket.on.mockClear === 'function') {
            mockSocket.on.mockClear();
        }
        if (mockSocket.emit && typeof mockSocket.emit.mockClear === 'function') {
            mockSocket.emit.mockClear();
        }
    });
    describe('GET_USER_CURRENT_ROOM event handler', () => {
        it('should return null when user has no current room', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCallback = jest.fn();
            // Mock userStateService to return null
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(null);
            // Setup handlers
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            // Find and call the GET_USER_CURRENT_ROOM handler
            const handlers = mockSocket.on.mock.calls;
            const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
            expect(getRoomHandler).toBeTruthy();
            yield getRoomHandler[1]({}, mockCallback);
            expect(mockCallback).toHaveBeenCalledWith({
                success: true,
                data: { roomId: null }
            });
        }));
        it('should return room details when user has current room', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCallback = jest.fn();
            const roomId = 'test-room-id';
            // Mock userStateService and redis
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(roomId);
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
            yield getRoomHandler[1]({}, mockCallback);
            expect(mockCallback).toHaveBeenCalledWith({
                success: true,
                data: {
                    roomId: roomId,
                    roomDetails: {
                        playerCount: 1,
                        isGameStarted: false,
                        roomState: {
                            id: roomId,
                            status: 'WAITING',
                            maxPlayers: 6,
                            currentPlayerCount: 2
                        }
                    }
                }
            });
        }));
        it('should clear user state and return null when room does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCallback = jest.fn();
            const roomId = 'non-existent-room';
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(roomId);
            db_1.redisClient.get.mockResolvedValue(null);
            userStateService_1.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
            yield getRoomHandler[1]({}, mockCallback);
            expect(userStateService_1.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('test-user-id');
            expect(mockCallback).toHaveBeenCalledWith({
                success: true,
                data: { roomId: null }
            });
        }));
        it('should handle errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockCallback = jest.fn();
            const error = new Error('Database error');
            userStateService_1.userStateService.getUserCurrentRoom.mockRejectedValue(error);
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
            yield getRoomHandler[1]({}, mockCallback);
            expect(mockCallback).toHaveBeenCalledWith({
                success: false,
                error: 'Failed to get current room status',
                message: 'Internal server error'
            });
        }));
    });
    describe('RECONNECT_ATTEMPT event handler', () => {
        it('should handle successful reconnection to existing room', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomId = 'test-room-id';
            const eventData = { roomId };
            // Mock successful state validation
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(roomId);
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            userStateService_1.userStateService.setUserCurrentRoom.mockResolvedValue(undefined);
            db_1.redisClient.setEx.mockResolvedValue('OK');
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const reconnectHandler = handlers.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT);
            yield reconnectHandler[1](eventData);
            expect(mockSocket.join).toHaveBeenCalledWith(roomId);
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.RECONNECTED, {
                roomId,
                gameState: mockRoomState.gameState,
                roomState: mockRoomState
            });
        }));
        it('should handle room not found error', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomId = 'non-existent-room';
            const eventData = { roomId };
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(roomId);
            db_1.redisClient.get.mockResolvedValue(null);
            userStateService_1.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const reconnectHandler = handlers.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT);
            yield reconnectHandler[1](eventData);
            expect(userStateService_1.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('test-user-id');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'Room not found',
                code: 'ROOM_NOT_FOUND'
            });
        }));
        it('should handle state inconsistency', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomId = 'test-room-id';
            const differentRoomId = 'different-room-id';
            const eventData = { roomId };
            // User global state says they're in a different room
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(differentRoomId);
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            userStateService_1.userStateService.forceLeaveCurrentRoom.mockResolvedValue(undefined);
            // User is not in the requested room
            const roomStateWithoutUser = Object.assign(Object.assign({}, mockRoomState), { players: [] // No players in room
             });
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(roomStateWithoutUser));
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const reconnectHandler = handlers.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT);
            yield reconnectHandler[1](eventData);
            expect(userStateService_1.userStateService.forceLeaveCurrentRoom).toHaveBeenCalledWith('test-user-id', mockSocket, mockIo, 'Reconnecting to different room');
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'You are not a member of this room',
                code: 'ROOM_ACCESS_DENIED'
            });
        }));
        it('should handle reconnection without specified room', () => __awaiter(void 0, void 0, void 0, function* () {
            const eventData = {}; // No roomId specified
            const currentRoomId = 'user-current-room';
            userStateService_1.userStateService.getUserCurrentRoom.mockResolvedValue(currentRoomId);
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
            db_1.redisClient.setEx.mockResolvedValue('OK');
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const reconnectHandler = handlers.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT);
            yield reconnectHandler[1](eventData);
            expect(mockSocket.join).toHaveBeenCalledWith(currentRoomId);
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.RECONNECTED, {
                roomId: currentRoomId,
                gameState: mockRoomState.gameState,
                roomState: mockRoomState
            });
        }));
        it('should handle errors during reconnection', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomId = 'test-room-id';
            const eventData = { roomId };
            const error = new Error('Database connection failed');
            userStateService_1.userStateService.getUserCurrentRoom.mockRejectedValue(error);
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            const handlers = mockSocket.on.mock.calls;
            const reconnectHandler = handlers.find(call => call[0] === socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT);
            yield reconnectHandler[1](eventData);
            expect(mockSocket.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'Reconnection failed',
                code: 'RECONNECT_FAILED'
            });
        }));
    });
    describe('Rate limiting', () => {
        it('should apply rate limiting to socket emit', () => {
            const originalEmit = mockSocket.emit;
            // Mock validation middleware
            const mockValidationMiddleware = {
                validateMessageRate: jest.fn().mockReturnValue(false)
            };
            // We need to mock the validation middleware import
            jest.doMock('../middleware/validation', () => ({
                validationMiddleware: mockValidationMiddleware
            }));
            (0, systemHandlers_1.setupSystemHandlers)(mockSocket, mockIo);
            // Emit should be replaced and rate limited
            const result = mockSocket.emit('test-event', 'test-data');
            expect(mockValidationMiddleware.validateMessageRate).toHaveBeenCalledWith('test-user-id');
            expect(result).toBe(false);
        });
    });
});
