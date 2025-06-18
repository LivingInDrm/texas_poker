import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket, SOCKET_EVENTS } from '@/types/socket';
import { setupSystemHandlers } from '@/socket/handlers/systemHandlers';
import { userStateService } from '@/services/userStateService';
import { redisClient } from '@/db';

// Mock dependencies
jest.mock('@/services/userStateService');
jest.mock('@/db');

describe('SystemHandlers Enhanced Features', () => {
  let mockSocket: jest.Mocked<AuthenticatedSocket>;
  let mockIo: jest.Mocked<SocketIOServer>;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    mockCallback = jest.fn();
    
    mockSocket = {
      data: {
        userId: 'user-123',
        username: 'testuser'
      },
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;

    mockIo = {
      emit: jest.fn(),
    } as any;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET_USER_CURRENT_ROOM event handler', () => {
    beforeEach(() => {
      setupSystemHandlers(mockSocket, mockIo);
    });

    it('should return null roomId when user has no current room', async () => {
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(null);

      // Find the GET_USER_CURRENT_ROOM handler
      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === 'GET_USER_CURRENT_ROOM'
      )?.[1];

      await handler({}, mockCallback);

      expect(userStateService.getUserCurrentRoom).toHaveBeenCalledWith('user-123');
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: { roomId: null }
      });
    });

    it('should return room details when user is in a room', async () => {
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

      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-123');
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === 'GET_USER_CURRENT_ROOM'
      )?.[1];

      await handler({}, mockCallback);

      expect(redisClient.get).toHaveBeenCalledWith('room:room-123');
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
    });

    it('should clear user state when room does not exist', async () => {
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-nonexistent');
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (userStateService.clearUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === 'GET_USER_CURRENT_ROOM'
      )?.[1];

      await handler({}, mockCallback);

      expect(userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: { roomId: null }
      });
    });

    it('should handle errors gracefully', async () => {
      (userStateService.getUserCurrentRoom as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === 'GET_USER_CURRENT_ROOM'
      )?.[1];

      await handler({}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get current room status',
        message: 'Internal server error'
      });
    });
  });

  describe('Enhanced RECONNECT_ATTEMPT handler', () => {
    beforeEach(() => {
      setupSystemHandlers(mockSocket, mockIo);
    });

    it('should handle room state inconsistency', async () => {
      const mockRoomState = {
        id: 'room-456',
        players: [
          { id: 'user-123', username: 'testuser', isConnected: false }
        ]
      };

      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-789');
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      (userStateService.forceLeaveCurrentRoom as jest.Mock).mockResolvedValue(undefined);

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT
      )?.[1];

      await handler({ roomId: 'room-456' });

      expect(userStateService.forceLeaveCurrentRoom).toHaveBeenCalledWith(
        'user-123',
        mockSocket,
        mockIo,
        'Reconnecting to different room'
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'You are not a member of this room',
        code: 'ROOM_ACCESS_DENIED'
      });
    });

    it('should successfully reconnect user to existing room', async () => {
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

      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-123');
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      (userStateService.setUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT
      )?.[1];

      await handler({ roomId: 'room-123' });

      expect(mockSocket.join).toHaveBeenCalledWith('room-123');
      expect(userStateService.setUserCurrentRoom).toHaveBeenCalledWith('user-123', 'room-123');
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.RECONNECTED, {
        roomId: 'room-123',
        gameState: { phase: 'preflop' },
        roomState: mockRoomState
      });
    });

    it('should handle room not found during reconnection', async () => {
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-123');
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (userStateService.clearUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT
      )?.[1];

      await handler({ roomId: 'room-123' });

      expect(userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND'
      });
    });

    it('should attempt recovery when no roomId is provided', async () => {
      const mockRoomState = {
        id: 'room-456',
        gameState: { phase: 'turn' },
        players: [
          { id: 'user-123', username: 'testuser', isConnected: false }
        ]
      };

      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-456');
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      (userStateService.setUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT
      )?.[1];

      await handler({});

      expect(mockSocket.join).toHaveBeenCalledWith('room-456');
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.RECONNECTED, {
        roomId: 'room-456',
        gameState: { phase: 'turn' },
        roomState: mockRoomState
      });
    });

    it('should clean up inconsistent state when room does not exist', async () => {
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-nonexistent');
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (userStateService.clearUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT
      )?.[1];

      await handler({});

      expect(userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.RECONNECTED, {
        roomId: 'room-nonexistent'
      });
    });

    it('should handle errors during reconnection', async () => {
      (userStateService.getUserCurrentRoom as jest.Mock).mockRejectedValue(
        new Error('Redis connection error')
      );

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT
      )?.[1];

      await handler({ roomId: 'room-123' });

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'Reconnection failed',
        code: 'RECONNECT_FAILED'
      });
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to socket messages', () => {
      const originalEmit = mockSocket.emit;
      
      setupSystemHandlers(mockSocket, mockIo);

      // The emit function should be wrapped with rate limiting
      expect(mockSocket.emit).not.toBe(originalEmit);
    });
  });

  describe('PING handler', () => {
    it('should respond to ping with timestamp', () => {
      setupSystemHandlers(mockSocket, mockIo);

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.PING
      )?.[1];

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
      
      setupSystemHandlers(mockSocket, mockIo);

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      );
    });

    it('should clean up heartbeat on disconnect', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      setupSystemHandlers(mockSocket, mockIo);

      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.DISCONNECT
      )?.[1];

      disconnectHandler();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Room state validation', () => {
    it('should validate room state consistency during reconnection', async () => {
      const mockRoomState = {
        id: 'room-123',
        players: [
          { id: 'user-456', username: 'otheruser' } // User not in room
        ]
      };

      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue('room-123');
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      (userStateService.clearUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);

      const handler = mockSocket.on.mock.calls.find(
        call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT
      )?.[1];

      await handler({ roomId: 'room-123' });

      expect(userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('user-123');
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'You are not a member of this room',
        code: 'ROOM_ACCESS_DENIED'
      });
    });
  });
});