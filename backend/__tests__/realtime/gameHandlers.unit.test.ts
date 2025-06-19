import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, MockDataConfigurator, TimerCleanup, TypeScriptCompatibility } from '../shared/testDataGenerator';
import { createMockAuthenticatedSocket, SocketTestHelper, HandlerTestUtils } from '../shared/socketTestUtils';

// Mock dependencies
jest.mock('../../src/db');
jest.mock('../../src/prisma');
jest.mock('../../src/game/GameState');
jest.mock('../../src/socket/middleware/validation');

// Import after mocking
import { setupGameHandlers } from '../../src/socket/handlers/gameHandlers';
import { SOCKET_EVENTS, SOCKET_ERRORS } from '../../src/types/socket';

describe('Game Handlers Unit Tests', () => {
  let mocks: any;
  let testData: any;
  let socket: any;
  let io: any;
  let callback: jest.Mock;

  beforeAll(() => {
    // Create comprehensive mock setup
    mocks = MockFactory.createGameHandlerMocks();
    
    testData = {
      currentUser: TestDataGenerator.createUserData({
        id: 'player-1',
        username: 'player1',
        chips: 5000
      }),
      roomState: TestDataGenerator.createRedisRoomStateData({
        id: 'room-123',
        status: 'WAITING',
        currentPlayerCount: 2,
        players: [
          {
            id: 'player-1',
            username: 'player1',
            chips: 5000,
            position: 0,
            isOwner: true,
            status: 'WAITING',
            isConnected: true
          },
          {
            id: 'player-2', 
            username: 'player2',
            chips: 5000,
            position: 1,
            isOwner: false,
            status: 'WAITING',
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
    MockDataConfigurator.configureAllMocks(mocks, testData);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    TimerCleanup.cleanup();

    // Create fresh socket and callback for each test
    socket = createMockAuthenticatedSocket({
      userId: testData.currentUser.id,
      username: testData.currentUser.username,
      roomId: 'room-123'
    });
    
    io = mocks.io;
    callback = jest.fn();

    // Setup default mock behaviors
    mocks.redis.get.mockResolvedValue(JSON.stringify(testData.roomState));
    mocks.redis.setEx.mockResolvedValue('OK');
    mocks.validationMiddleware.validatePlayerAction.mockReturnValue({ isValid: true });

    // Setup handlers
    setupGameHandlers(socket, io);
  });

  afterEach(() => {
    TimerCleanup.cleanup();
  });

  describe('GAME_READY Event', () => {
    it('should handle player ready successfully', async () => {
      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          roomState: expect.any(Object),
          playerStatus: 'READY'
        }),
        message: 'Player marked as ready'
      });

      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        'room:room-123',
        3600,
        expect.stringContaining('READY')
      );
    });

    it('should handle room not found', async () => {
      mocks.redis.get.mockResolvedValue(null);
      const eventData = { roomId: 'nonexistent-room' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Room not found',
        message: SOCKET_ERRORS.ROOM_NOT_FOUND
      });
    });

    it('should handle player not in room', async () => {
      const roomStateWithoutPlayer = {
        ...testData.roomState,
        players: [testData.roomState.players[1]] // Remove current player
      };
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomStateWithoutPlayer));

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Player not in room',
        message: SOCKET_ERRORS.PLAYER_NOT_IN_ROOM
      });
    });

    it('should start game when all players ready', async () => {
      // Set up room with all players ready except current
      const almostReadyRoom = {
        ...testData.roomState,
        players: testData.roomState.players.map((p: any, index: number) => ({
          ...p,
          status: index === 0 ? 'WAITING' : 'READY'
        }))
      };
      mocks.redis.get.mockResolvedValue(JSON.stringify(almostReadyRoom));

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          gameStarted: true
        }),
        message: 'Game started'
      });

      // Verify game state creation
      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        'game:room-123',
        3600,
        expect.any(String)
      );
    });
  });

  describe('GAME_ACTION Event', () => {
    const validActions = [
      { type: 'call', amount: 20 },
      { type: 'raise', amount: 40 },
      { type: 'fold', amount: 0 },
      { type: 'check', amount: 0 }
    ];

    validActions.forEach(action => {
      it(`should handle ${action.type} action successfully`, async () => {
        // Set up game state
        mocks.redis.get.mockImplementation((key: string) => {
          if (key.startsWith('game:')) {
            return Promise.resolve(JSON.stringify(testData.gameState));
          }
          return Promise.resolve(JSON.stringify(testData.roomState));
        });

        const eventData = {
          roomId: 'room-123',
          action: action
        };

        await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

        expect(mocks.validationMiddleware.validatePlayerAction).toHaveBeenCalledWith(
          testData.currentUser.id,
          action,
          expect.any(Object)
        );

        expect(callback).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            gameState: expect.any(Object),
            action: action
          }),
          message: 'Action processed successfully'
        });
      });
    });

    it('should reject invalid actions', async () => {
      mocks.validationMiddleware.validatePlayerAction.mockReturnValue({
        isValid: false,
        error: 'Invalid action for current game state'
      });

      const eventData = {
        roomId: 'room-123',
        action: { type: 'call', amount: 20 }
      };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid action',
        message: 'Invalid action for current game state'
      });
    });

    it('should handle actions out of turn', async () => {
      // Set up game state where it's not player's turn
      const gameStateNotTurn = {
        ...testData.gameState,
        currentPlayerIndex: 1 // Different player's turn
      };
      
      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(gameStateNotTurn));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = {
        roomId: 'room-123',
        action: { type: 'call', amount: 20 }
      };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Not your turn',
        message: SOCKET_ERRORS.NOT_PLAYER_TURN
      });
    });

    it('should handle insufficient chips', async () => {
      const eventData = {
        roomId: 'room-123',
        action: { type: 'raise', amount: 10000 } // More than player has
      };

      mocks.validationMiddleware.validatePlayerAction.mockReturnValue({
        isValid: false,
        error: 'Insufficient chips'
      });

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid action',
        message: 'Insufficient chips'
      });
    });
  });

  describe('GAME_FOLD Event', () => {
    it('should handle fold action successfully', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(testData.gameState));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          gameState: expect.any(Object),
          playerFolded: true
        }),
        message: 'Player folded'
      });

      // Verify player status updated
      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        'game:room-123',
        3600,
        expect.stringContaining('FOLDED')
      );
    });

    it('should handle game end when only one player left', async () => {
      // Set up game state with one player already folded
      const gameWithFolds = {
        ...testData.gameState,
        players: testData.gameState.players.map((p: any, index: number) => ({
          ...p,
          status: index === 1 ? 'FOLDED' : 'ACTIVE'
        }))
      };

      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(gameWithFolds));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          gameEnded: true,
          winner: expect.any(Object)
        }),
        message: 'Game ended - winner determined'
      });
    });
  });

  describe('GAME_CHECK Event', () => {
    it('should handle check action successfully', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(testData.gameState));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'check', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          gameState: expect.any(Object),
          actionType: 'check'
        }),
        message: 'Player checked'
      });
    });

    it('should reject check when bet is required', async () => {
      // Set up game state where there's an outstanding bet
      const gameWithBet = {
        ...testData.gameState,
        players: testData.gameState.players.map((p: any, index: number) => ({
          ...p,
          bet: index === 1 ? 40 : 20 // Player 2 has raised
        }))
      };

      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(gameWithBet));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      mocks.validationMiddleware.validatePlayerAction.mockReturnValue({
        isValid: false,
        error: 'Cannot check when there is a bet to call'
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'check', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid action',
        message: 'Cannot check when there is a bet to call'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      mocks.redis.get.mockRejectedValue(new Error('Redis connection failed'));

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process game action'
      });
    });

    it('should handle invalid JSON in Redis data', async () => {
      mocks.redis.get.mockResolvedValue('invalid-json');

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Failed to parse room data'
      });
    });

    it('should handle missing game state', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(null); // No game state
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = {
        roomId: 'room-123',
        action: { type: 'call', amount: 20 }
      };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Game not found',
        message: 'No active game in this room'
      });
    });
  });

  describe('Socket Broadcasting', () => {
    it('should broadcast game state updates to room', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(testData.gameState));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = {
        roomId: 'room-123',
        action: { type: 'call', amount: 20 }
      };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      SocketTestHelper.expectSocketBroadcast(
        socket,
        'room-123',
        SOCKET_EVENTS.ROOM_STATE_UPDATE,
        expect.objectContaining({
          gameState: expect.any(Object),
          lastAction: expect.any(Object)
        })
      );
    });

    it('should broadcast game end to all players', async () => {
      // Set up winning scenario
      const endGameState = {
        ...testData.gameState,
        status: 'FINISHED',
        winner: testData.gameState.players[0]
      };

      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(endGameState));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      SocketTestHelper.expectSocketBroadcast(
        socket,
        'room-123',
        SOCKET_EVENTS.GAME_ENDED,
        expect.objectContaining({
          winner: expect.any(Object),
          finalState: expect.any(Object)
        })
      );
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid actions efficiently', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(testData.gameState));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const actions = Array.from({ length: 10 }, (_, i) => ({
        roomId: 'room-123',
        action: { type: 'check', amount: 0 }
      }));

      const start = Date.now();
      
      for (const action of actions) {
        const testCallback = jest.fn();
        await socket.emit(SOCKET_EVENTS.GAME_ACTION, action, testCallback);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should clean up game state after completion', async () => {
      const gameEndState = {
        ...testData.gameState,
        status: 'FINISHED'
      };

      mocks.redis.get.mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(gameEndState));
        }
        return Promise.resolve(JSON.stringify(testData.roomState));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      // Verify cleanup operations
      expect(mocks.redis.del).toHaveBeenCalledWith('game:room-123');
    });
  });
});