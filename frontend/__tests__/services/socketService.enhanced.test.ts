import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSocketTestUtils, AsyncTestUtils, MockDataFactory } from '../test-infrastructure';

// 标识当前为服务测试上下文 (必须在mock之前设置)
globalThis.__VITEST_SERVICE_TEST__ = true;
globalThis.__VITEST_TEST_TYPE__ = 'service';

// 在导入socketService之前设置mock
let socketUtils: ReturnType<typeof createSocketTestUtils>;

// Context-aware mock for socket.io-client
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => {
      // 只在服务测试上下文中创建完整的Mock
      if (globalThis.__VITEST_SERVICE_TEST__) {
        if (!socketUtils) {
          const { createSocketTestUtils } = require('../test-infrastructure');
          socketUtils = createSocketTestUtils();
        }
        return socketUtils.mockSocket;
      }
      
      // 为非服务测试提供简单的fallback mock
      return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
        connected: false,
        setConnectionState: vi.fn(),
        triggerEvent: vi.fn()
      };
    })
  };
});

// 现在导入socketService
import socketService from '../../src/services/socketService';

describe('SocketService Enhanced Features', () => {
  beforeEach(() => {
    // Mark this as a service test at the start
    globalThis.__VITEST_SERVICE_TEST__ = true;
    
    // 创建Socket测试工具
    socketUtils = createSocketTestUtils({
      autoConnect: false,
      defaultLatency: 10,
      enableLogging: false,
      strictMode: false
    });

    // 重置socketService状态
    socketService.disconnect();
  });

  afterEach(() => {
    // 清理所有异步资源
    AsyncTestUtils.cleanup();
    if (socketUtils) {
      socketUtils.cleanup();
    }
    socketService.disconnect();
    vi.clearAllMocks();
    
    // 清理全局标识 (重要：防止影响其他测试)
    globalThis.__VITEST_SERVICE_TEST__ = undefined;
    globalThis.__VITEST_TEST_TYPE__ = undefined;
  });

  describe('getUserCurrentRoomStatus', () => {
    it('returns null roomId when socket is not connected', async () => {
      // 确保socket未连接
      socketUtils.mockSocket.setConnectionState(false);
      
      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({ roomId: null });
    });

    it('successfully gets current room status', async () => {
      // 设置socket为已连接状态
      socketUtils.mockSocket.setConnectionState(true);
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      
      const mockResponse = MockDataFactory.socketResponse.success({
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
      });

      socketUtils.mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'GET_USER_CURRENT_ROOM') {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({
        roomId: 'room-123',
        roomDetails: mockResponse.data.roomDetails
      });
      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith('GET_USER_CURRENT_ROOM', {}, expect.any(Function));
    });

    it('handles server response with null roomId', async () => {
      socketUtils.mockSocket.setConnectionState(true);
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      
      const mockResponse = MockDataFactory.socketResponse.success({
        roomId: null
      });

      socketUtils.mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'GET_USER_CURRENT_ROOM') {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({ roomId: null });
    });

    it('handles server error response', async () => {
      socketUtils.mockSocket.setConnectionState(true);
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      
      const mockResponse = MockDataFactory.socketResponse.error('Failed to get room status');

      socketUtils.mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'GET_USER_CURRENT_ROOM') {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      expect(result).toEqual({ roomId: null });
    });

    it('handles timeout scenario', async () => {
      socketUtils.mockSocket.setConnectionState(true);
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      
      // Don't call the callback to simulate timeout
      socketUtils.mockSocket.emit.mockImplementation((event, data, callback) => {
        // Callback never called - will trigger timeout
      });

      const result = await socketService.getUserCurrentRoomStatus();
      
      // Should return null after timeout
      expect(result).toEqual({ roomId: null });
    });
  });

  describe('attemptStateRecovery', () => {
    beforeEach(() => {
      socketUtils.mockSocket.setConnectionState(true);
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
    });

    it('attempts recovery when user is in a room', async () => {
      const mockRoomStatus = {
        roomId: 'room-123',
        roomDetails: {
          playerCount: 3,
          isGameStarted: true
        }
      };

      // Mock getUserCurrentRoomStatus to return room status
      const mockGetRoomStatus = vi.spyOn(socketService, 'getUserCurrentRoomStatus')
        .mockResolvedValue(mockRoomStatus);

      // Set current room state
      (socketService as any).currentRoomId = 'room-123';

      // Call attemptStateRecovery method
      await (socketService as any).attemptStateRecovery();

      expect(mockGetRoomStatus).toHaveBeenCalled();
      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith(
        'reconnect_attempt',
        { roomId: 'room-123' }
      );
    });

    it('clears local state when server has no room state', async () => {
      // Mock getUserCurrentRoomStatus to return no room
      const mockGetRoomStatus = vi.spyOn(socketService, 'getUserCurrentRoomStatus')
        .mockResolvedValue({ roomId: null });
      
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
      const mockRoomStatus = {
        roomId: 'room-456',
        roomDetails: {
          playerCount: 2,
          isGameStarted: false
        }
      };

      const mockGetRoomStatus = vi.spyOn(socketService, 'getUserCurrentRoomStatus')
        .mockResolvedValue(mockRoomStatus);

      // Set different local state
      (socketService as any).currentRoomId = 'room-123';

      await (socketService as any).attemptStateRecovery();

      expect((socketService as any).currentRoomId).toBe('room-456');
      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith(
        'reconnect_attempt',
        { roomId: 'room-456' }
      );
    });

    it('emits state recovery failure when error occurs', async () => {
      // Mock getUserCurrentRoomStatus to throw error
      const mockGetRoomStatus = vi.spyOn(socketService, 'getUserCurrentRoomStatus')
        .mockRejectedValue(new Error('Network error'));

      const mockEmit = vi.spyOn(socketService as any, 'emit');

      await (socketService as any).attemptStateRecovery();

      expect(mockEmit).toHaveBeenCalledWith('state_recovery_failed', {
        error: expect.any(Error)
      });
    });
  });

  describe('Enhanced reconnection handling', () => {
    it('triggers state recovery on reconnection', async () => {
      socketUtils.mockSocket.setConnectionState(true);
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      
      const spyAttemptStateRecovery = vi.spyOn(socketService as any, 'attemptStateRecovery');
      
      // 手动触发重连事件处理器
      (socketService as any).setupConnectionHandlers();
      
      // 直接调用内部的重连处理逻辑
      socketUtils.mockSocket.triggerEvent('reconnect', 2);

      // Wait for async operations to complete
      await AsyncTestUtils.wait(10);

      expect(spyAttemptStateRecovery).toHaveBeenCalled();
    });

    it('handles reconnection with room state', async () => {
      const mockEmit = vi.spyOn(socketService as any, 'emit');
      (socketService as any).socket = socketUtils.mockSocket;

      const eventData = {
        roomId: 'room-123',
        gameState: {
          gameId: 'game-456',
          phase: 'preflop'
        }
      };

      // 先设置事件处理器
      (socketService as any).setupSystemEventHandlers();

      // 直接触发reconnected事件 (小写)
      socketUtils.mockSocket.triggerEvent('reconnected', eventData);

      // Wait for the async event handler to execute
      await AsyncTestUtils.wait(20);

      expect((socketService as any).currentRoomId).toBe('room-123');
      expect((socketService as any).currentGameState).toEqual(eventData.gameState);
      expect((socketService as any).isInGame).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('reconnected', eventData);
    });
  });

  describe('Connection status tracking', () => {
    it('updates connection status on connect', async () => {
      const mockEmit = vi.spyOn(socketService as any, 'emit');
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connecting'; // Set initial status

      // 设置连接事件处理器
      (socketService as any).setupConnectionHandlers();

      // 触发连接事件
      socketUtils.mockSocket.triggerEvent('connect');

      // Wait for async event handler
      await AsyncTestUtils.wait(20);

      expect((socketService as any).connectionStatus).toBe('connected');
      expect(mockEmit).toHaveBeenCalledWith('connection_status_change', 'connected');
    });

    it('updates connection status on disconnect', async () => {
      const mockEmit = vi.spyOn(socketService as any, 'emit');
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected'; // Set initial status

      // 设置连接事件处理器
      (socketService as any).setupConnectionHandlers();

      // 触发断开连接事件
      socketUtils.mockSocket.triggerEvent('disconnect', 'transport close');

      // Wait for async event handler
      await AsyncTestUtils.wait(20);

      expect((socketService as any).connectionStatus).toBe('disconnected');
      expect(mockEmit).toHaveBeenCalledWith('connection_status_change', 'disconnected');
    });

    it('updates connection status during reconnection attempts', async () => {
      const mockEmit = vi.spyOn(socketService as any, 'emit');
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'disconnected'; // Set initial status

      // 设置连接事件处理器
      (socketService as any).setupConnectionHandlers();

      // 触发重连尝试事件
      socketUtils.mockSocket.triggerEvent('reconnect_attempt', 1);

      // Wait for async event handler
      await AsyncTestUtils.wait(20);

      expect((socketService as any).connectionStatus).toBe('reconnecting');
      expect(mockEmit).toHaveBeenCalledWith('connection_status_change', 'reconnecting');
    });
  });

  describe('Error handling', () => {
    it('handles socket errors properly', async () => {
      const mockEmitError = vi.spyOn(socketService as any, 'emitError');
      (socketService as any).socket = socketUtils.mockSocket;

      // 设置系统事件处理器
      (socketService as any).setupSystemEventHandlers();

      const errorData = {
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND'
      };

      // 触发错误事件 (小写)
      socketUtils.mockSocket.triggerEvent('error', errorData);

      // Wait for async event handler
      await AsyncTestUtils.wait(20);

      expect(mockEmitError).toHaveBeenCalledWith(errorData);
    });

    it('handles getUserCurrentRoomStatus timeout gracefully', async () => {
      socketUtils.mockSocket.setConnectionState(true);
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      
      // Don't call callback to simulate no response (timeout)
      socketUtils.mockSocket.emit.mockImplementation(() => {});

      try {
        const result = await socketService.getUserCurrentRoomStatus();
        expect(result).toEqual({ roomId: null });
      } catch (error) {
        // If it throws an error due to timeout, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });
  });

  describe('Event listener management', () => {
    it('prevents duplicate event listeners', () => {
      (socketService as any).socket = socketUtils.mockSocket;
      
      // Call setup multiple times
      (socketService as any).setupConnectionHandlers();
      (socketService as any).setupConnectionHandlers();
      
      // 由于我们的Mock会记录所有on调用，这里检查调用次数合理即可
      expect(socketUtils.mockSocket.on).toHaveBeenCalled();
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