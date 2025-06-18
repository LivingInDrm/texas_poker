import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { socketService } from '../socketService';

// Mock socket.io-client
const mockSocket = {
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('SocketService Enhanced Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  afterEach(() => {
    socketService.disconnect();
  });

  describe('getUserCurrentRoomStatus', () => {
    it('returns null roomId when socket is not connected', async () => {
      mockSocket.connected = false;
      
      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({ roomId: null });
    });

    it('successfully gets current room status', async () => {
      mockSocket.connected = true;
      
      const mockResponse = {
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
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'GET_USER_CURRENT_ROOM') {
          setTimeout(() => callback(mockResponse), 0);
        }
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({
        roomId: 'room-123',
        roomDetails: mockResponse.data.roomDetails
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('GET_USER_CURRENT_ROOM', {}, expect.any(Function));
    });

    it('handles server response with null roomId', async () => {
      mockSocket.connected = true;
      
      const mockResponse = {
        success: true,
        data: { roomId: null }
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'GET_USER_CURRENT_ROOM') {
          setTimeout(() => callback(mockResponse), 0);
        }
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({ roomId: null });
    });

    it('handles server error response', async () => {
      mockSocket.connected = true;
      
      const mockResponse = {
        success: false,
        error: 'Failed to get room status'
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'GET_USER_CURRENT_ROOM') {
          setTimeout(() => callback(mockResponse), 0);
        }
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({ roomId: null });
    });

    it('handles timeout scenario', async () => {
      mockSocket.connected = true;
      
      // Don't call the callback to simulate timeout
      mockSocket.emit.mockImplementation((event, data, callback) => {
        // Callback never called
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      // Should return null after timeout
      expect(result).toEqual({ roomId: null });
    }, 6000); // Increase timeout for this test
  });

  describe('attemptStateRecovery', () => {
    beforeEach(() => {
      mockSocket.connected = true;
    });

    it('attempts recovery when user is in a room', async () => {
      const mockGetRoomStatus = vi.fn().mockResolvedValue({
        roomId: 'room-123',
        roomDetails: {
          playerCount: 3,
          isGameStarted: true
        }
      });

      // Mock the getUserCurrentRoomStatus method
      vi.spyOn(socketService, 'getUserCurrentRoomStatus').mockImplementation(mockGetRoomStatus);

      // Set current room state
      (socketService as any).currentRoomId = 'room-123';

      // Trigger state recovery by calling attemptStateRecovery method
      await (socketService as any).attemptStateRecovery();

      expect(mockGetRoomStatus).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'RECONNECT_ATTEMPT',
        { roomId: 'room-123' }
      );
    });

    it('clears local state when server has no room state', async () => {
      const mockGetRoomStatus = vi.fn().mockResolvedValue({ roomId: null });
      
      vi.spyOn(socketService, 'getUserCurrentRoomStatus').mockImplementation(mockGetRoomStatus);
      
      // Set local state that should be cleared
      (socketService as any).currentRoomId = 'room-123';
      (socketService as any).currentGameState = { gameId: 'game-123' };
      (socketService as any).isInGame = true;

      await (socketService as any).attemptStateRecovery();

      expect((socketService as any).currentRoomId).toBe(null);
      expect((socketService as any).currentGameState).toBe(null);
      expect((socketService as any).isInGame).toBe(false);
    });

    it('syncs to server state when local state is inconsistent', async () => {
      const mockGetRoomStatus = vi.fn().mockResolvedValue({
        roomId: 'room-456',
        roomDetails: {
          playerCount: 2,
          isGameStarted: false
        }
      });

      vi.spyOn(socketService, 'getUserCurrentRoomStatus').mockImplementation(mockGetRoomStatus);

      // Set different local state
      (socketService as any).currentRoomId = 'room-123';

      await (socketService as any).attemptStateRecovery();

      expect((socketService as any).currentRoomId).toBe('room-456');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'RECONNECT_ATTEMPT',
        { roomId: 'room-456' }
      );
    });

    it('emits state recovery failure when error occurs', async () => {
      const mockGetRoomStatus = vi.fn().mockRejectedValue(new Error('Network error'));
      
      vi.spyOn(socketService, 'getUserCurrentRoomStatus').mockImplementation(mockGetRoomStatus);

      const mockEmit = vi.fn();
      (socketService as any).emit = mockEmit;

      await (socketService as any).attemptStateRecovery();

      expect(mockEmit).toHaveBeenCalledWith('state_recovery_failed', {
        error: expect.any(Error)
      });
    });
  });

  describe('Enhanced reconnection handling', () => {
    it('triggers state recovery on reconnection', () => {
      mockSocket.connected = true;
      
      const spyAttemptStateRecovery = vi.spyOn(socketService as any, 'attemptStateRecovery');
      
      // Simulate reconnection event
      const reconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'RECONNECT'
      )?.[1];
      
      if (reconnectHandler) {
        reconnectHandler(2); // attemptNumber
      }

      expect(spyAttemptStateRecovery).toHaveBeenCalled();
    });

    it('handles reconnection with room state', () => {
      const mockEmit = vi.fn();
      (socketService as any).emit = mockEmit;

      // Simulate RECONNECTED event with room state
      const reconnectedHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'RECONNECTED'
      )?.[1];

      const eventData = {
        roomId: 'room-123',
        gameState: {
          gameId: 'game-456',
          phase: 'preflop'
        }
      };

      if (reconnectedHandler) {
        reconnectedHandler(eventData);
      }

      expect((socketService as any).currentRoomId).toBe('room-123');
      expect((socketService as any).currentGameState).toEqual(eventData.gameState);
      expect((socketService as any).isInGame).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('RECONNECTED', eventData);
    });
  });

  describe('Connection status tracking', () => {
    it('updates connection status on connect', () => {
      const mockEmit = vi.fn();
      (socketService as any).emit = mockEmit;

      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        connectHandler();
      }

      expect((socketService as any).connectionStatus).toBe('connected');
      expect(mockEmit).toHaveBeenCalledWith('connection_status_change', 'connected');
    });

    it('updates connection status on disconnect', () => {
      const mockEmit = vi.fn();
      (socketService as any).emit = mockEmit;

      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        disconnectHandler('transport close');
      }

      expect((socketService as any).connectionStatus).toBe('disconnected');
      expect(mockEmit).toHaveBeenCalledWith('connection_status_change', 'disconnected');
    });

    it('updates connection status during reconnection attempts', () => {
      const mockEmit = vi.fn();
      (socketService as any).emit = mockEmit;

      const reconnectAttemptHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'reconnect_attempt'
      )?.[1];

      if (reconnectAttemptHandler) {
        reconnectAttemptHandler(1);
      }

      expect((socketService as any).connectionStatus).toBe('reconnecting');
      expect(mockEmit).toHaveBeenCalledWith('connection_status_change', 'reconnecting');
    });
  });

  describe('Error handling', () => {
    it('handles socket errors properly', () => {
      const mockEmitError = vi.fn();
      (socketService as any).emitError = mockEmitError;

      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'ERROR'
      )?.[1];

      const errorData = {
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND'
      };

      if (errorHandler) {
        errorHandler(errorData);
      }

      expect(mockEmitError).toHaveBeenCalledWith(errorData);
    });

    it('handles getUserCurrentRoomStatus timeout gracefully', async () => {
      mockSocket.connected = true;
      
      // Don't call callback to simulate no response
      mockSocket.emit.mockImplementation(() => {});

      const startTime = Date.now();
      const result = await socketService.getUserCurrentRoomStatus();
      const endTime = Date.now();

      expect(result).toEqual({ roomId: null });
      expect(endTime - startTime).toBeGreaterThanOrEqual(5000);
      expect(endTime - startTime).toBeLessThan(5100);
    }, 6000);
  });

  describe('Event listener management', () => {
    it('prevents duplicate event listeners', () => {
      // Call setup multiple times
      (socketService as any).setupConnectionHandlers();
      (socketService as any).setupConnectionHandlers();
      
      // Each event should only be registered once
      const connectCalls = mockSocket.on.mock.calls.filter(call => call[0] === 'connect');
      expect(connectCalls.length).toBeLessThanOrEqual(1);
    });

    it('manages custom event listeners correctly', () => {
      const mockListener = vi.fn();
      
      socketService.on('test_event', mockListener);
      (socketService as any).emit('test_event', { data: 'test' });
      
      expect(mockListener).toHaveBeenCalledWith({ data: 'test' });
      
      socketService.off('test_event', mockListener);
      (socketService as any).emit('test_event', { data: 'test2' });
      
      // Should not be called again after removing listener
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });
});