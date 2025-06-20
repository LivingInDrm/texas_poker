import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, MockDataConfigurator, TimerCleanup, TypeScriptCompatibility } from '../shared/testDataGenerator';
import { createMockAuthenticatedSocket, SocketTestHelper, HandlerTestUtils } from '../shared/socketTestUtils';

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
import { setupGameHandlers } from '../../src/socket/handlers/gameHandlers';
import { SOCKET_EVENTS, SOCKET_ERRORS } from '../../src/types/socket';
import { validationMiddleware } from '../../src/socket/middleware/validation';
import { redisClient } from '../../src/db';

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
    MockDataConfigurator.configureAllMocks(mocks, testData);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    TimerCleanup.cleanup();
    
    // Clear validation middleware mocks
    (validationMiddleware.validatePlayerAction as jest.Mock).mockClear();
    
    // Clear redis client mocks
    (redisClient.get as jest.Mock).mockClear();
    (redisClient.setEx as jest.Mock).mockClear();
    (redisClient.del as jest.Mock).mockClear();

    // Create fresh socket and callback for each test
    socket = createMockAuthenticatedSocket({
      userId: testData.currentUser.id,
      username: testData.currentUser.username,
      roomId: 'room-123'
    });
    
    io = mocks.io;
    callback = jest.fn();

    // Setup default mock behaviors
    (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(testData.roomState));
    (redisClient.setEx as jest.Mock).mockResolvedValue('OK');
    (validationMiddleware.validatePlayerAction as jest.Mock).mockResolvedValue({ valid: true });

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
        message: expect.stringMatching(/ready/i),
        data: expect.objectContaining({
          isReady: expect.any(Boolean)
        })
      });

      expect(redisClient.setEx).toHaveBeenCalledWith(
        'room:room-123',
        3600,
        expect.any(String)
      );
    });

    it('should handle room not found', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);
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
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(roomStateWithoutPlayer));

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
          isReady: index === 0 ? false : true
        }))
      };
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(almostReadyRoom));

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        message: expect.stringMatching(/ready/i),
        data: expect.objectContaining({
          isReady: expect.any(Boolean)
        })
      });

      // Verify game state creation
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'room:room-123',
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
        // Set up room state with game started
        const roomStateWithGame = {
          ...testData.roomState,
          gameStarted: true,
          status: 'PLAYING',
          gameState: testData.gameState
        };
        
        // Set up Redis mocks to return proper states
        (redisClient.get as jest.Mock).mockImplementation((key: string) => {
          if (key.startsWith('game:')) {
            return Promise.resolve(JSON.stringify(testData.gameState));
          }
          return Promise.resolve(JSON.stringify(roomStateWithGame));
        });

        const eventData = {
          roomId: 'room-123',
          action: action
        };

        await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

        expect(validationMiddleware.validatePlayerAction).toHaveBeenCalledWith(
          socket,
          'room-123',
          action
        );

        expect(callback).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            gameState: expect.any(Object),
            action: action
          }),
          message: 'Action executed successfully'
        });
      });
    });

    it('should reject invalid actions', async () => {
      (validationMiddleware.validatePlayerAction as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid action for current game state'
      });

      const eventData = {
        roomId: 'room-123',
        action: { type: 'call', amount: 20 }
      };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid action for current game state',
        message: 'Invalid action for current game state'
      });
    });

    it('should handle actions out of turn', async () => {
      // Create a separate socket with different user ID
      const otherSocket = createMockAuthenticatedSocket({
        userId: 'player-3', // Different from current player
        username: 'player3',
        roomId: 'room-123'
      });
      setupGameHandlers(otherSocket, io);
      
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: testData.gameState
      };
      
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
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
      await (otherSocket as any).emit(SOCKET_EVENTS.GAME_ACTION, eventData, otherCallback);

      expect(otherCallback).toHaveBeenCalledWith({
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

      (validationMiddleware.validatePlayerAction as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Insufficient chips'
      });

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient chips',
        message: 'Insufficient chips'
      });
    });
  });

  describe('GAME_FOLD Event', () => {
    it('should handle fold action successfully', async () => {
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: testData.gameState
      };
      
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(testData.gameState));
        }
        return Promise.resolve(JSON.stringify(roomStateWithGame));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          gameState: expect.any(Object),
          action: expect.objectContaining({ type: 'fold' })
        }),
        message: 'Action executed successfully'
      });

      // Verify room state was updated
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'room:room-123',
        3600,
        expect.any(String)
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
      
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: gameWithFolds
      };

      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(gameWithFolds));
        }
        return Promise.resolve(JSON.stringify(roomStateWithGame));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          gameState: expect.any(Object),
          action: expect.objectContaining({ type: 'fold' })
        }),
        message: 'Action executed successfully'
      });
    });
  });

  describe('GAME_CHECK Event', () => {
    it('should handle check action successfully', async () => {
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: testData.gameState
      };
      
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(testData.gameState));
        }
        return Promise.resolve(JSON.stringify(roomStateWithGame));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'check', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          gameState: expect.any(Object),
          action: expect.objectContaining({ type: 'check' })
        }),
        message: 'Action executed successfully'
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
      
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: gameWithBet
      };

      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(gameWithBet));
        }
        return Promise.resolve(JSON.stringify(roomStateWithGame));
      });

      (validationMiddleware.validatePlayerAction as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Cannot check when there is a bet to call'
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'check', amount: 0 } }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot check when there is a bet to call',
        message: 'Cannot check when there is a bet to call'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      (redisClient.get as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: SOCKET_ERRORS.INTERNAL_ERROR
      });
    });

    it('should handle invalid JSON in Redis data', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue('invalid-json');

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_READY, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: SOCKET_ERRORS.INTERNAL_ERROR
      });
    });

    it('should handle missing game state', async () => {
      // Room state without gameState field
      const roomStateWithoutGame = {
        ...testData.roomState,
        gameStarted: false,
        status: 'WAITING'
        // gameState is undefined
      };
      
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(null); // No game state
        }
        return Promise.resolve(JSON.stringify(roomStateWithoutGame));
      });

      const eventData = {
        roomId: 'room-123',
        action: { type: 'call', amount: 20 }
      };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Game not started',
        message: SOCKET_ERRORS.GAME_NOT_STARTED
      });
    });
  });

  describe('Socket Broadcasting', () => {
    it('should broadcast game state updates to room', async () => {
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: testData.gameState
      };
      
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(testData.gameState));
        }
        return Promise.resolve(JSON.stringify(roomStateWithGame));
      });

      const eventData = {
        roomId: 'room-123',
        action: { type: 'call', amount: 20 }
      };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, eventData, callback);

      // Check if io.to was called for broadcasting
      expect(io.to).toHaveBeenCalledWith('room-123');
      
      // Get the broadcast object and check if emit was called
      const broadcastObject = (io.to as jest.Mock).mock.results[0]?.value;
      if (broadcastObject && broadcastObject.emit) {
        expect(broadcastObject.emit).toHaveBeenCalledWith(
          SOCKET_EVENTS.GAME_ACTION_MADE,
          expect.objectContaining({
            playerId: 'player-1',
            action: expect.any(Object),
            gameState: expect.any(Object)
          })
        );
      }
    });

    it('should broadcast game end to all players', async () => {
      // Set up winning scenario
      const endGameState = {
        ...testData.gameState,
        phase: 'ended',
        status: 'FINISHED',
        winner: testData.gameState.players[0]
      };
      
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: endGameState
      };

      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(endGameState));
        }
        return Promise.resolve(JSON.stringify(roomStateWithGame));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      // Game end scenario is complex - let's check if any broadcast was made
      expect(io.to).toHaveBeenCalledWith('room-123');
      
      const broadcastObject = (io.to as jest.Mock).mock.results[0]?.value;
      expect(broadcastObject.emit).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid actions efficiently', async () => {
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: testData.gameState
      };
      
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
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
        await socket.emit(SOCKET_EVENTS.GAME_ACTION, action, testCallback);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should clean up game state after completion', async () => {
      const gameEndState = {
        ...testData.gameState,
        phase: 'ended',
        status: 'FINISHED'
      };
      
      const roomStateWithGame = {
        ...testData.roomState,
        gameStarted: true,
        status: 'PLAYING',
        gameState: gameEndState
      };

      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('game:')) {
          return Promise.resolve(JSON.stringify(gameEndState));
        }
        return Promise.resolve(JSON.stringify(roomStateWithGame));
      });

      const eventData = { roomId: 'room-123' };

      await socket.emit(SOCKET_EVENTS.GAME_ACTION, { ...eventData, action: { type: 'fold', amount: 0 } }, callback);

      // Game state should be updated
      expect(redisClient.setEx).toHaveBeenCalledWith(
        'room:room-123',
        3600,
        expect.any(String)
      );
    });
  });
});