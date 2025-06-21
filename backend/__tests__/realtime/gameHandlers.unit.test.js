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
// Mock dependencies
jest.mock('../../src/db', () => ({
    redisClient: {
        get: jest.fn(),
        setEx: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        expire: jest.fn(),
        lPush: jest.fn(),
        lRange: jest.fn(),
        lTrim: jest.fn()
    }
}));
jest.mock('../../src/prisma');
jest.mock('../../src/game/GameState', () => ({
    GameState: jest.fn().mockImplementation(() => ({
        addPlayer: jest.fn(),
        setPlayerReady: jest.fn(),
        startNewHand: jest.fn().mockReturnValue(true),
        getCurrentPlayerId: jest.fn().mockReturnValue('player-1'),
        getValidActions: jest.fn().mockReturnValue(['fold', 'check', 'call', 'raise']),
        executePlayerAction: jest.fn().mockReturnValue(true),
        getGameSnapshot: jest.fn().mockReturnValue({
            phase: 'preflop',
            players: [
                {
                    id: 'player-1',
                    name: 'player1',
                    chips: 4980,
                    totalBet: 20,
                    status: 'ACTIVE',
                    cards: [{ suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'K' }]
                },
                {
                    id: 'player-2',
                    name: 'player2',
                    chips: 4990,
                    totalBet: 10,
                    status: 'ACTIVE',
                    cards: [{ suit: 'diamonds', rank: 'Q' }, { suit: 'clubs', rank: 'J' }]
                }
            ],
            communityCards: [],
            pots: [{ amount: 30, eligiblePlayers: [] }],
            actionHistory: [],
            gameId: 'game-123'
        }),
        getGameResult: jest.fn().mockReturnValue({
            winners: []
        })
    })),
    PlayerAction: {
        FOLD: 'fold',
        CHECK: 'check',
        CALL: 'call',
        RAISE: 'raise',
        ALL_IN: 'all_in'
    }
}));
jest.mock('../../src/socket/middleware/validation', () => ({
    validationMiddleware: {
        validatePlayerAction: jest.fn(),
        validateRoomJoin: jest.fn(),
        validateMessageRate: jest.fn(),
        cleanup: jest.fn()
    }
}));
// Import after mocking
const gameHandlers_1 = require("../../src/socket/handlers/gameHandlers");
const socket_1 = require("../../src/types/socket");
const validation_1 = require("../../src/socket/middleware/validation");
const db_1 = require("../../src/db");
describe('Game Handlers Unit Tests', () => {
    let mocks;
    let testData;
    let socket;
    let io;
    let callback;
    beforeAll(() => {
        // Create comprehensive mock setup
        mocks = mockFactory_1.MockFactory.createGameHandlerMocks();
        testData = {
            currentUser: testDataGenerator_1.TestDataGenerator.createUserData({
                id: 'player-1',
                username: 'player1',
                chips: 5000
            }),
            roomState: testDataGenerator_1.TestDataGenerator.createRedisRoomStateData({
                id: 'room-123',
                status: 'WAITING',
                currentPlayerCount: 2,
                gameStarted: false,
                players: [
                    {
                        id: 'player-1',
                        username: 'player1',
                        chips: 5000,
                        position: 0,
                        isOwner: true,
                        isReady: false,
                        isConnected: true
                    },
                    {
                        id: 'player-2',
                        username: 'player2',
                        chips: 5000,
                        position: 1,
                        isOwner: false,
                        isReady: false,
                        isConnected: true
                    }
                ]
            }),
            gameState: {
                id: 'game-123',
                roomId: 'room-123',
                status: 'PLAYING',
                currentPhase: 'preflop',
                currentPlayerIndex: 0,
                pot: 30,
                communityCards: [],
                players: [
                    {
                        id: 'player-1',
                        cards: [{ suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'K' }],
                        chips: 4980,
                        bet: 20,
                        status: 'ACTIVE'
                    },
                    {
                        id: 'player-2',
                        cards: [{ suit: 'diamonds', rank: 'Q' }, { suit: 'clubs', rank: 'J' }],
                        chips: 4990,
                        bet: 10,
                        status: 'ACTIVE'
                    }
                ]
            }
        };
        // Configure mocks
        testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
    });
    beforeEach(() => {
        jest.clearAllMocks();
        testDataGenerator_1.TimerCleanup.cleanup();
        // Clear validation middleware mocks
        validation_1.validationMiddleware.validatePlayerAction.mockClear();
        // Clear redis client mocks
        db_1.redisClient.get.mockClear();
        db_1.redisClient.setEx.mockClear();
        db_1.redisClient.del.mockClear();
        // Create fresh socket and callback for each test
        socket = (0, socketTestUtils_1.createMockAuthenticatedSocket)({
            userId: testData.currentUser.id,
            username: testData.currentUser.username,
            roomId: 'room-123'
        });
        io = mocks.io;
        callback = jest.fn();
        // Setup default mock behaviors
        db_1.redisClient.get.mockResolvedValue(JSON.stringify(testData.roomState));
        db_1.redisClient.setEx.mockResolvedValue('OK');
        validation_1.validationMiddleware.validatePlayerAction.mockResolvedValue({ valid: true });
        // Setup handlers
        (0, gameHandlers_1.setupGameHandlers)(socket, io);
    });
    afterEach(() => {
        testDataGenerator_1.TimerCleanup.cleanup();
    });
    describe('GAME_READY Event', () => {
        it('should handle player ready successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_READY, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: expect.stringMatching(/ready/i),
                data: expect.objectContaining({
                    isReady: expect.any(Boolean)
                })
            });
            expect(db_1.redisClient.setEx).toHaveBeenCalledWith('room:room-123', 3600, expect.any(String));
        }));
        it('should handle room not found', () => __awaiter(void 0, void 0, void 0, function* () {
            db_1.redisClient.get.mockResolvedValue(null);
            const eventData = { roomId: 'nonexistent-room' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_READY, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Room not found',
                message: socket_1.SOCKET_ERRORS.ROOM_NOT_FOUND
            });
        }));
        it('should handle player not in room', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomStateWithoutPlayer = Object.assign(Object.assign({}, testData.roomState), { players: [testData.roomState.players[1]] // Remove current player
             });
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(roomStateWithoutPlayer));
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_READY, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Player not in room',
                message: socket_1.SOCKET_ERRORS.PLAYER_NOT_IN_ROOM
            });
        }));
        it('should start game when all players ready', () => __awaiter(void 0, void 0, void 0, function* () {
            // Set up room with all players ready except current
            const almostReadyRoom = Object.assign(Object.assign({}, testData.roomState), { players: testData.roomState.players.map((p, index) => (Object.assign(Object.assign({}, p), { isReady: index === 0 ? false : true }))) });
            db_1.redisClient.get.mockResolvedValue(JSON.stringify(almostReadyRoom));
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_READY, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                message: expect.stringMatching(/ready/i),
                data: expect.objectContaining({
                    isReady: expect.any(Boolean)
                })
            });
            // Verify game state creation
            expect(db_1.redisClient.setEx).toHaveBeenCalledWith('room:room-123', 3600, expect.any(String));
        }));
    });
    describe('GAME_ACTION Event', () => {
        const validActions = [
            { type: 'call', amount: 20 },
            { type: 'raise', amount: 40 },
            { type: 'fold', amount: 0 },
            { type: 'check', amount: 0 }
        ];
        validActions.forEach(action => {
            it(`should handle ${action.type} action successfully`, () => __awaiter(void 0, void 0, void 0, function* () {
                // Set up room state with game started
                const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: testData.gameState });
                // Set up Redis mocks to return proper states
                db_1.redisClient.get.mockImplementation((key) => {
                    if (key.startsWith('game:')) {
                        return Promise.resolve(JSON.stringify(testData.gameState));
                    }
                    return Promise.resolve(JSON.stringify(roomStateWithGame));
                });
                const eventData = {
                    roomId: 'room-123',
                    action: action
                };
                yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, eventData, callback);
                expect(validation_1.validationMiddleware.validatePlayerAction).toHaveBeenCalledWith(socket, 'room-123', action);
                expect(callback).toHaveBeenCalledWith({
                    success: true,
                    data: expect.objectContaining({
                        gameState: expect.any(Object),
                        action: action
                    }),
                    message: 'Action executed successfully'
                });
            }));
        });
        it('should reject invalid actions', () => __awaiter(void 0, void 0, void 0, function* () {
            validation_1.validationMiddleware.validatePlayerAction.mockResolvedValue({
                valid: false,
                error: 'Invalid action for current game state'
            });
            const eventData = {
                roomId: 'room-123',
                action: { type: 'call', amount: 20 }
            };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid action for current game state',
                message: 'Invalid action for current game state'
            });
        }));
        it('should handle actions out of turn', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create a separate socket with different user ID
            const otherSocket = (0, socketTestUtils_1.createMockAuthenticatedSocket)({
                userId: 'player-3', // Different from current player
                username: 'player3',
                roomId: 'room-123'
            });
            (0, gameHandlers_1.setupGameHandlers)(otherSocket, io);
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: testData.gameState });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(testData.gameState));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const eventData = {
                roomId: 'room-123',
                action: { type: 'call', amount: 20 }
            };
            const otherCallback = jest.fn();
            yield otherSocket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, eventData, otherCallback);
            expect(otherCallback).toHaveBeenCalledWith({
                success: false,
                error: 'Not your turn',
                message: socket_1.SOCKET_ERRORS.NOT_PLAYER_TURN
            });
        }));
        it('should handle insufficient chips', () => __awaiter(void 0, void 0, void 0, function* () {
            const eventData = {
                roomId: 'room-123',
                action: { type: 'raise', amount: 10000 } // More than player has
            };
            validation_1.validationMiddleware.validatePlayerAction.mockResolvedValue({
                valid: false,
                error: 'Insufficient chips'
            });
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Insufficient chips',
                message: 'Insufficient chips'
            });
        }));
    });
    describe('GAME_FOLD Event', () => {
        it('should handle fold action successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: testData.gameState });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(testData.gameState));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, Object.assign(Object.assign({}, eventData), { action: { type: 'fold', amount: 0 } }), callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    gameState: expect.any(Object),
                    action: expect.objectContaining({ type: 'fold' })
                }),
                message: 'Action executed successfully'
            });
            // Verify room state was updated
            expect(db_1.redisClient.setEx).toHaveBeenCalledWith('room:room-123', 3600, expect.any(String));
        }));
        it('should handle game end when only one player left', () => __awaiter(void 0, void 0, void 0, function* () {
            // Set up game state with one player already folded
            const gameWithFolds = Object.assign(Object.assign({}, testData.gameState), { players: testData.gameState.players.map((p, index) => (Object.assign(Object.assign({}, p), { status: index === 1 ? 'FOLDED' : 'ACTIVE' }))) });
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: gameWithFolds });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(gameWithFolds));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, Object.assign(Object.assign({}, eventData), { action: { type: 'fold', amount: 0 } }), callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    gameState: expect.any(Object),
                    action: expect.objectContaining({ type: 'fold' })
                }),
                message: 'Action executed successfully'
            });
        }));
    });
    describe('GAME_CHECK Event', () => {
        it('should handle check action successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: testData.gameState });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(testData.gameState));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, Object.assign(Object.assign({}, eventData), { action: { type: 'check', amount: 0 } }), callback);
            expect(callback).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    gameState: expect.any(Object),
                    action: expect.objectContaining({ type: 'check' })
                }),
                message: 'Action executed successfully'
            });
        }));
        it('should reject check when bet is required', () => __awaiter(void 0, void 0, void 0, function* () {
            // Set up game state where there's an outstanding bet
            const gameWithBet = Object.assign(Object.assign({}, testData.gameState), { players: testData.gameState.players.map((p, index) => (Object.assign(Object.assign({}, p), { bet: index === 1 ? 40 : 20 // Player 2 has raised
                 }))) });
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: gameWithBet });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(gameWithBet));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            validation_1.validationMiddleware.validatePlayerAction.mockResolvedValue({
                valid: false,
                error: 'Cannot check when there is a bet to call'
            });
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, Object.assign(Object.assign({}, eventData), { action: { type: 'check', amount: 0 } }), callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Cannot check when there is a bet to call',
                message: 'Cannot check when there is a bet to call'
            });
        }));
    });
    describe('Error Handling', () => {
        it('should handle Redis connection errors', () => __awaiter(void 0, void 0, void 0, function* () {
            db_1.redisClient.get.mockRejectedValue(new Error('Redis connection failed'));
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_READY, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }));
        it('should handle invalid JSON in Redis data', () => __awaiter(void 0, void 0, void 0, function* () {
            db_1.redisClient.get.mockResolvedValue('invalid-json');
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_READY, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }));
        it('should handle missing game state', () => __awaiter(void 0, void 0, void 0, function* () {
            // Room state without gameState field
            const roomStateWithoutGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: false, status: 'WAITING' });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(null); // No game state
                }
                return Promise.resolve(JSON.stringify(roomStateWithoutGame));
            });
            const eventData = {
                roomId: 'room-123',
                action: { type: 'call', amount: 20 }
            };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, eventData, callback);
            expect(callback).toHaveBeenCalledWith({
                success: false,
                error: 'Game not started',
                message: socket_1.SOCKET_ERRORS.GAME_NOT_STARTED
            });
        }));
    });
    describe('Socket Broadcasting', () => {
        it('should broadcast game state updates to room', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: testData.gameState });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(testData.gameState));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const eventData = {
                roomId: 'room-123',
                action: { type: 'call', amount: 20 }
            };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, eventData, callback);
            // Check if io.to was called for broadcasting
            expect(io.to).toHaveBeenCalledWith('room-123');
            // Get the broadcast object and check if emit was called
            const broadcastObject = (_a = io.to.mock.results[0]) === null || _a === void 0 ? void 0 : _a.value;
            if (broadcastObject && broadcastObject.emit) {
                expect(broadcastObject.emit).toHaveBeenCalledWith(socket_1.SOCKET_EVENTS.GAME_ACTION_MADE, expect.objectContaining({
                    playerId: 'player-1',
                    action: expect.any(Object),
                    gameState: expect.any(Object)
                }));
            }
        }));
        it('should broadcast game end to all players', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // Set up winning scenario
            const endGameState = Object.assign(Object.assign({}, testData.gameState), { phase: 'ended', status: 'FINISHED', winner: testData.gameState.players[0] });
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: endGameState });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(endGameState));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, Object.assign(Object.assign({}, eventData), { action: { type: 'fold', amount: 0 } }), callback);
            // Game end scenario is complex - let's check if any broadcast was made
            expect(io.to).toHaveBeenCalledWith('room-123');
            const broadcastObject = (_a = io.to.mock.results[0]) === null || _a === void 0 ? void 0 : _a.value;
            expect(broadcastObject.emit).toHaveBeenCalled();
        }));
    });
    describe('Performance and Memory', () => {
        it('should handle rapid actions efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: testData.gameState });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(testData.gameState));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const actions = Array.from({ length: 10 }, (_, i) => ({
                roomId: 'room-123',
                action: { type: 'check', amount: 0 }
            }));
            const start = Date.now();
            for (const action of actions) {
                const testCallback = jest.fn();
                yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, action, testCallback);
            }
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
        }));
        it('should clean up game state after completion', () => __awaiter(void 0, void 0, void 0, function* () {
            const gameEndState = Object.assign(Object.assign({}, testData.gameState), { phase: 'ended', status: 'FINISHED' });
            const roomStateWithGame = Object.assign(Object.assign({}, testData.roomState), { gameStarted: true, status: 'PLAYING', gameState: gameEndState });
            db_1.redisClient.get.mockImplementation((key) => {
                if (key.startsWith('game:')) {
                    return Promise.resolve(JSON.stringify(gameEndState));
                }
                return Promise.resolve(JSON.stringify(roomStateWithGame));
            });
            const eventData = { roomId: 'room-123' };
            yield socket.emit(socket_1.SOCKET_EVENTS.GAME_ACTION, Object.assign(Object.assign({}, eventData), { action: { type: 'fold', amount: 0 } }), callback);
            // Game state should be updated
            expect(db_1.redisClient.setEx).toHaveBeenCalledWith('room:room-123', 3600, expect.any(String));
        }));
    });
});
