import { Server as HttpServer } from 'http';
import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, TimerCleanup } from '../shared/testDataGenerator';
import { createMockAuthenticatedSocket } from '../shared/socketTestUtils';
import { SOCKET_EVENTS, SOCKET_ERRORS } from '../../src/types/socket';

// Create mocks first
const mockPrisma = MockFactory.createPrismaMock();
const mockRedis = MockFactory.createRedisMock();
const mockJWT = MockFactory.createJWTMock();
const mockUserStateService = MockFactory.createUserStateServiceMock();

// Mock dependencies before importing
jest.mock('jsonwebtoken', () => mockJWT);
jest.mock('../../src/prisma', () => ({
  default: mockPrisma
}));
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
import { 
  createSocketServer, 
  getRoomSocketCount, 
  getUserSocket, 
  broadcastToRoom, 
  sendToUser 
} from '../../src/socket/socketServer';

describe('Socket Server Tests', () => {
  let httpServer: HttpServer;
  let mockIo: any;
  let mocks: any;
  let testData: any;

  beforeAll(() => {
    // Create test data
    testData = {
      validUser: TestDataGenerator.createUserData({
        id: 'user-123',
        username: 'testuser'
      }),
      roomState: TestDataGenerator.createRedisRoomStateData({
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
    } as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    TimerCleanup.cleanup();

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
    TimerCleanup.cleanup();
  });

  describe('createSocketServer', () => {
    it('should create Socket.IO server with correct configuration', () => {
      const io = createSocketServer(httpServer);

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
      expect(mockIo.on).toHaveBeenCalledWith(SOCKET_EVENTS.CONNECTION, expect.any(Function));
      expect(mockIo.engine.on).toHaveBeenCalledWith('connection_error', expect.any(Function));
    });

    it('should use custom FRONTEND_URL when provided', () => {
      const originalEnv = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://example.com';

      createSocketServer(httpServer);

      expect(mockSocketIOServer).toHaveBeenCalledWith(httpServer, 
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: 'https://example.com'
          })
        })
      );

      process.env.FRONTEND_URL = originalEnv;
    });
  });

  describe('JWT Authentication Middleware', () => {
    let authMiddleware: Function;
    let mockSocket: any;
    let nextCallback: jest.Mock;

    beforeEach(() => {
      createSocketServer(httpServer);
      authMiddleware = mockIo.use.mock.calls[0][0];
      
      mockSocket = createMockAuthenticatedSocket({
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

    it('should authenticate valid token successfully', async () => {
      await authMiddleware(mockSocket, nextCallback);

      expect(mocks.jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      });
      expect(mockSocket.data.userId).toBe('user-123');
      expect(mockSocket.data.username).toBe('testuser');
      expect(mockSocket.data.authenticated).toBe(true);
      expect(nextCallback).toHaveBeenCalledWith();
    });

    it('should authenticate with token from Authorization header', async () => {
      Object.defineProperty(mockSocket, 'handshake', {
        value: {
          auth: {},
          headers: {
            authorization: 'Bearer header-token'
          }
        },
        writable: true
      });

      await authMiddleware(mockSocket, nextCallback);

      expect(mocks.jwt.verify).toHaveBeenCalledWith('header-token', process.env.JWT_SECRET);
      expect(nextCallback).toHaveBeenCalledWith();
    });

    it('should reject connection without token', async () => {
      Object.defineProperty(mockSocket, 'handshake', {
        value: {
          auth: {},
          headers: {}
        },
        writable: true
      });

      await authMiddleware(mockSocket, nextCallback);

      expect(nextCallback).toHaveBeenCalledWith(
        new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED)
      );
    });

    it('should reject invalid JWT token', async () => {
      mocks.jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware(mockSocket, nextCallback);

      expect(nextCallback).toHaveBeenCalledWith(
        new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED)
      );
    });

    it('should reject token for non-existent user', async () => {
      mocks.prisma.user.findUnique.mockResolvedValue(null);

      await authMiddleware(mockSocket, nextCallback);

      expect(nextCallback).toHaveBeenCalledWith(
        new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED)
      );
    });

    it('should handle database errors during user verification', async () => {
      mocks.prisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await authMiddleware(mockSocket, nextCallback);

      expect(nextCallback).toHaveBeenCalledWith(
        new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED)
      );
    });
  });

  describe('Connection Handling', () => {
    let connectionHandler: Function;
    let mockSocket: any;

    beforeEach(() => {
      createSocketServer(httpServer);
      connectionHandler = mockIo.on.mock.calls.find(call => 
        call[0] === SOCKET_EVENTS.CONNECTION
      )[1];
      
      mockSocket = createMockAuthenticatedSocket({
        userId: 'user-123',
        username: 'testuser'
      });
    });

    it('should handle new connection properly', () => {
      const setupSystemHandlers = require('../../src/socket/handlers/systemHandlers').setupSystemHandlers;
      const setupRoomHandlers = require('../../src/socket/handlers/roomHandlers').setupRoomHandlers;
      const setupGameHandlers = require('../../src/socket/handlers/gameHandlers').setupGameHandlers;

      connectionHandler(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.CONNECTED, {
        message: 'Welcome testuser! You are connected to Texas Poker.'
      });

      expect(setupSystemHandlers).toHaveBeenCalledWith(mockSocket, mockIo);
      expect(setupRoomHandlers).toHaveBeenCalledWith(mockSocket, mockIo);
      expect(setupGameHandlers).toHaveBeenCalledWith(mockSocket, mockIo);

      expect(mockSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.DISCONNECT, expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle socket errors', () => {
      connectionHandler(mockSocket);
      
      const errorHandler = mockSocket.on.mock.calls.find(call => 
        call[0] === 'error'
      )[1];

      const mockError = new Error('Test error');
      errorHandler(mockError);

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'An error occurred',
        code: SOCKET_ERRORS.INTERNAL_ERROR
      });
    });
  });

  describe('Disconnect Handling', () => {
    let disconnectHandler: Function;
    let mockSocket: any;

    beforeEach(() => {
      createSocketServer(httpServer);
      const connectionHandler = mockIo.on.mock.calls.find(call => 
        call[0] === SOCKET_EVENTS.CONNECTION
      )[1];
      
      mockSocket = createMockAuthenticatedSocket({
        userId: 'user-123',
        username: 'testuser',
        roomId: 'room-456'
      });
      
      connectionHandler(mockSocket);
      
      disconnectHandler = mockSocket.on.mock.calls.find(call => 
        call[0] === SOCKET_EVENTS.DISCONNECT
      )[1];
    });

    it('should handle disconnect without room gracefully', async () => {
      mockSocket.data.roomId = undefined;

      await disconnectHandler('client disconnect', {});

      expect(mocks.redis.get).not.toHaveBeenCalled();
    });

    it('should handle player disconnect from room', async () => {
      await disconnectHandler('client disconnect', {});

      expect(mocks.redis.get).toHaveBeenCalledWith('room:room-456');
      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        'room:room-456',
        3600,
        expect.stringContaining('"isConnected":false')
      );

      expect(mockSocket.to).toHaveBeenCalledWith('room-456');
    });

    it('should clear user state when player not in room', async () => {
      const roomStateWithoutUser = {
        ...testData.roomState,
        players: testData.roomState.players.filter((p: any) => p.id !== 'user-123')
      };
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomStateWithoutUser));

      await disconnectHandler('client disconnect', {});

      expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
    });

    it('should clear user state when room does not exist', async () => {
      mocks.redis.get.mockResolvedValue(null);

      await disconnectHandler('client disconnect', {});

      expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
    });

    it('should handle Redis errors during disconnect', async () => {
      mocks.redis.get.mockRejectedValue(new Error('Redis error'));

      await disconnectHandler('client disconnect', {});

      expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
    });

    it('should handle cleanup errors gracefully', async () => {
      mocks.redis.get.mockRejectedValue(new Error('Redis error'));
      mocks.userStateService.clearUserCurrentRoom.mockRejectedValue(new Error('Cleanup error'));

      // Should not throw
      await expect(disconnectHandler('client disconnect')).resolves.toBeUndefined();
    });
  });

  describe('Utility Functions', () => {
    beforeEach(() => {
      createSocketServer(httpServer);
    });

    describe('getRoomSocketCount', () => {
      it('should return correct room socket count', () => {
        const mockRoom = new Set(['socket1', 'socket2', 'socket3']);
        mockIo.sockets.adapter.rooms.set('room-123', mockRoom);

        const count = getRoomSocketCount(mockIo, 'room-123');

        expect(count).toBe(3);
      });

      it('should return 0 for non-existent room', () => {
        const count = getRoomSocketCount(mockIo, 'nonexistent-room');

        expect(count).toBe(0);
      });
    });

    describe('getUserSocket', () => {
      it('should find socket by user ID', () => {
        const mockSocket1 = { data: { userId: 'user-1' } };
        const mockSocket2 = { data: { userId: 'user-2' } };
        
        mockIo.sockets.sockets.set('socket1', mockSocket1);
        mockIo.sockets.sockets.set('socket2', mockSocket2);

        const socket = getUserSocket(mockIo, 'user-2');

        expect(socket).toBe(mockSocket2);
      });

      it('should return null for non-existent user', () => {
        const socket = getUserSocket(mockIo, 'nonexistent-user');

        expect(socket).toBeNull();
      });

      it('should handle sockets without data', () => {
        const mockSocketWithoutData = {};
        mockIo.sockets.sockets.set('socket1', mockSocketWithoutData);

        const socket = getUserSocket(mockIo, 'user-1');

        expect(socket).toBeNull();
      });
    });

    describe('broadcastToRoom', () => {
      it('should broadcast message to room', () => {
        const testData = { message: 'Hello room!' };

        broadcastToRoom(mockIo, 'room-123', SOCKET_EVENTS.ROOM_STATE_UPDATE, testData);

        expect(mockIo.to).toHaveBeenCalledWith('room-123');
        expect(mockIo.to('room-123').emit).toHaveBeenCalledWith(
          SOCKET_EVENTS.ROOM_STATE_UPDATE, 
          testData
        );
      });
    });

    describe('sendToUser', () => {
      it('should send message to specific user successfully', () => {
        const mockSocket = { emit: jest.fn() };
        mockIo.sockets.sockets.set('socket1', { data: { userId: 'user-123' } });
        
        // Mock getUserSocket to return our test socket
        jest.doMock('../../src/socket/socketServer', () => ({
          ...jest.requireActual('../../src/socket/socketServer'),
          getUserSocket: jest.fn().mockReturnValue(mockSocket)
        }));

        const testData = { message: 'Hello user!' };
        const result = sendToUser(mockIo, 'user-123', SOCKET_EVENTS.CONNECTED, testData);

        expect(result).toBe(true);
      });

      it('should return false when user not found', () => {
        const testData = { message: 'Hello user!' };
        const result = sendToUser(mockIo, 'nonexistent-user', SOCKET_EVENTS.CONNECTED, testData);

        expect(result).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle global connection errors', () => {
      createSocketServer(httpServer);
      
      const errorHandler = mockIo.engine.on.mock.calls.find(call => 
        call[0] === 'connection_error'
      )[1];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockError = new Error('Connection error');
      errorHandler(mockError);

      expect(consoleSpy).toHaveBeenCalledWith('Socket.IO connection error:', mockError);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing JWT_SECRET', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      createSocketServer(httpServer);
      const authMiddleware = mockIo.use.mock.calls[0][0];
      
      const mockSocket = createMockAuthenticatedSocket();
      Object.defineProperty(mockSocket, 'handshake', {
        value: { auth: { token: 'test-token' }, headers: {} },
        writable: true
      });
      const nextCallback = jest.fn();

      // JWT should be called with undefined, causing an error
      mocks.jwt.verify.mockImplementation(() => {
        throw new Error('secretOrPrivateKey is required');
      });

      await authMiddleware(mockSocket, nextCallback);

      expect(nextCallback).toHaveBeenCalledWith(
        new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED)
      );

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle multiple concurrent connections', async () => {
      createSocketServer(httpServer);
      const connectionHandler = mockIo.on.mock.calls.find(call => 
        call[0] === SOCKET_EVENTS.CONNECTION
      )[1];

      const sockets = Array.from({ length: 10 }, (_, i) => 
        createMockAuthenticatedSocket({
          userId: `user-${i}`,
          username: `user${i}`
        })
      );

      const start = Date.now();

      // Simulate concurrent connections
      await Promise.all(sockets.map(socket => {
        return Promise.resolve(connectionHandler(socket));
      }));

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be very fast
      sockets.forEach(socket => {
        expect(socket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.CONNECTED, 
          expect.objectContaining({
            message: expect.stringContaining('Welcome')
          })
        );
      });
    });

    it('should handle rapid disconnect/reconnect cycles', async () => {
      createSocketServer(httpServer);
      const connectionHandler = mockIo.on.mock.calls.find(call => 
        call[0] === SOCKET_EVENTS.CONNECTION
      )[1];

      const mockSocket = createMockAuthenticatedSocket({
        userId: 'user-123',
        username: 'testuser',
        roomId: 'room-456'
      });

      // Connect
      connectionHandler(mockSocket);
      
      const disconnectHandler = mockSocket.on.mock.calls.find(call => 
        call[0] === SOCKET_EVENTS.DISCONNECT
      )?.[1];

      // Multiple rapid disconnects
      if (disconnectHandler) {
        await Promise.all([
          disconnectHandler('client disconnect', {}),
          disconnectHandler('transport close', {}),
          disconnectHandler('client disconnect', {})
        ]);
      }

      // Should handle gracefully without errors
      expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalled();
    });
  });
});