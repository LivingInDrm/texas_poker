import { Server as SocketIOServer } from 'socket.io';
import { setupSystemHandlers } from '@/socket/handlers/systemHandlers';
import { userStateService } from '@/services/userStateService';
import { redisClient } from '@/db';
import {
  AuthenticatedSocket,
  SOCKET_EVENTS,
  RoomState
} from '@/types/socket';

// Mock dependencies
jest.mock('../../../src/services/userStateService');
jest.mock('../../../src/db');

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
} as unknown as AuthenticatedSocket;

const mockIo = {
  emit: jest.fn()
} as unknown as SocketIOServer;

const mockRoomState: RoomState = {
  id: 'test-room-id',
  status: 'waiting',
  maxPlayers: 6,
  currentPlayerCount: 2,
  players: [
    {
      id: 'test-user-id',
      username: 'test-user',
      avatar: 'avatar.png',
      chips: 1000,
      isReady: false,
      position: 0,
      isConnected: false,
      lastAction: null
    }
  ],
  gameStarted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe('System Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset socket event handlers
    (mockSocket.on as jest.Mock).mockClear();
    (mockSocket.emit as jest.Mock).mockClear();
  });

  describe('GET_USER_CURRENT_ROOM event handler', () => {
    it('should return null when user has no current room', async () => {
      const mockCallback = jest.fn();
      
      // Mock userStateService to return null
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(null);
      
      // Setup handlers
      setupSystemHandlers(mockSocket, mockIo);
      
      // Find and call the GET_USER_CURRENT_ROOM handler
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
      expect(getRoomHandler).toBeTruthy();
      
      await getRoomHandler[1]({}, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: { roomId: null }
      });
    });

    it('should return room details when user has current room', async () => {
      const mockCallback = jest.fn();
      const roomId = 'test-room-id';
      
      // Mock userStateService and redis
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(roomId);
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
      
      await getRoomHandler[1]({}, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: {
          roomId: roomId,
          roomDetails: {
            playerCount: 1,
            isGameStarted: false,
            roomState: {
              id: roomId,
              status: 'waiting',
              maxPlayers: 6,
              currentPlayerCount: 2
            }
          }
        }
      });
    });

    it('should clear user state and return null when room does not exist', async () => {
      const mockCallback = jest.fn();
      const roomId = 'non-existent-room';
      
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(roomId);
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (userStateService.clearUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
      
      await getRoomHandler[1]({}, mockCallback);
      
      expect(userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('test-user-id');
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: { roomId: null }
      });
    });

    it('should handle errors gracefully', async () => {
      const mockCallback = jest.fn();
      const error = new Error('Database error');
      
      (userStateService.getUserCurrentRoom as jest.Mock).mockRejectedValue(error);
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const getRoomHandler = handlers.find(call => call[0] === 'GET_USER_CURRENT_ROOM');
      
      await getRoomHandler[1]({}, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get current room status',
        message: 'Internal server error'
      });
    });
  });

  describe('RECONNECT_ATTEMPT event handler', () => {
    it('should handle successful reconnection to existing room', async () => {
      const roomId = 'test-room-id';
      const eventData = { roomId };
      
      // Mock successful state validation
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(roomId);
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      (userStateService.setUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const reconnectHandler = handlers.find(call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT);
      
      await reconnectHandler[1](eventData);
      
      expect(mockSocket.join).toHaveBeenCalledWith(roomId);
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.RECONNECTED, {
        roomId,
        gameState: mockRoomState.gameState,
        roomState: mockRoomState
      });
    });

    it('should handle room not found error', async () => {
      const roomId = 'non-existent-room';
      const eventData = { roomId };
      
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(roomId);
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (userStateService.clearUserCurrentRoom as jest.Mock).mockResolvedValue(undefined);
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const reconnectHandler = handlers.find(call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT);
      
      await reconnectHandler[1](eventData);
      
      expect(userStateService.clearUserCurrentRoom).toHaveBeenCalledWith('test-user-id');
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND'
      });
    });

    it('should handle state inconsistency', async () => {
      const roomId = 'test-room-id';
      const differentRoomId = 'different-room-id';
      const eventData = { roomId };
      
      // User global state says they're in a different room
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(differentRoomId);
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      (userStateService.forceLeaveCurrentRoom as jest.Mock).mockResolvedValue(undefined);
      
      // User is not in the requested room
      const roomStateWithoutUser = {
        ...mockRoomState,
        players: [] // No players in room
      };
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(roomStateWithoutUser));
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const reconnectHandler = handlers.find(call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT);
      
      await reconnectHandler[1](eventData);
      
      expect(userStateService.forceLeaveCurrentRoom).toHaveBeenCalledWith(
        'test-user-id',
        mockSocket,
        mockIo,
        'Reconnecting to different room'
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'You are not a member of this room',
        code: 'ROOM_ACCESS_DENIED'
      });
    });

    it('should handle reconnection without specified room', async () => {
      const eventData = {}; // No roomId specified
      const currentRoomId = 'user-current-room';
      
      (userStateService.getUserCurrentRoom as jest.Mock).mockResolvedValue(currentRoomId);
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockRoomState));
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const reconnectHandler = handlers.find(call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT);
      
      await reconnectHandler[1](eventData);
      
      expect(mockSocket.join).toHaveBeenCalledWith(currentRoomId);
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.RECONNECTED, {
        roomId: currentRoomId,
        gameState: mockRoomState.gameState,
        roomState: mockRoomState
      });
    });

    it('should handle errors during reconnection', async () => {
      const roomId = 'test-room-id';
      const eventData = { roomId };
      const error = new Error('Database connection failed');
      
      (userStateService.getUserCurrentRoom as jest.Mock).mockRejectedValue(error);
      
      setupSystemHandlers(mockSocket, mockIo);
      
      const handlers = (mockSocket.on as jest.Mock).mock.calls;
      const reconnectHandler = handlers.find(call => call[0] === SOCKET_EVENTS.RECONNECT_ATTEMPT);
      
      await reconnectHandler[1](eventData);
      
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ERROR, {
        message: 'Reconnection failed',
        code: 'RECONNECT_FAILED'
      });
    });
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
      
      setupSystemHandlers(mockSocket, mockIo);
      
      // Emit should be replaced and rate limited
      const result = mockSocket.emit('test-event', 'test-data');
      
      expect(mockValidationMiddleware.validateMessageRate).toHaveBeenCalledWith('test-user-id');
      expect(result).toBe(false);
    });
  });
});