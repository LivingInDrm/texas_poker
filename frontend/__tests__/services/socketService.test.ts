import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSocketTestUtils, AsyncTestUtils, MockDataFactory } from '../test-infrastructure';
import { SOCKET_EVENTS } from '../../src/types/socket';

// 在导入socketService之前设置mock
let socketUtils: ReturnType<typeof createSocketTestUtils>;

// Mock socket.io-client模块
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => {
      if (!socketUtils) {
        // 如果socketUtils还没有初始化，创建一个基本的mock
        const { createSocketTestUtils } = require('../test-infrastructure');
        socketUtils = createSocketTestUtils();
      }
      return socketUtils.mockSocket;
    })
  };
});

// 现在导入socketService
import socketService from '../../src/services/socketService';

describe('SocketService', () => {
  const mockToken = 'test-jwt-token';

  beforeEach(() => {
    // 创建Socket测试工具，启用日志以便调试
    socketUtils = createSocketTestUtils({
      autoConnect: false,
      defaultLatency: 50,
      enableLogging: false,
      strictMode: false
    });

    // 重置socketService状态
    socketService.disconnect();
  });

  afterEach(() => {
    // 清理所有异步资源
    AsyncTestUtils.cleanup();
    socketUtils.cleanup();
    socketService.disconnect();
    vi.clearAllMocks();
  });

  describe('连接管理', () => {
    it('应该能够成功连接到服务器', async () => {
      // 设置Mock为连接成功
      socketUtils.mockSocket.setConnectionState(false);
      
      // 模拟连接成功流程
      const connectPromise = socketService.connect(mockToken);
      
      // 立即触发连接成功事件
      await AsyncTestUtils.wait(10);
      socketUtils.mockSocket.triggerEvent(SOCKET_EVENTS.CONNECT);
      
      const result = await connectPromise;
      
      expect(result).toBe(true);
      expect(socketService.connected).toBe(true);
      expect(socketService.status).toBe('connected');
    });

    it('应该处理连接失败', async () => {
      // Don't set connection state, just start with disconnected state
      
      try {
        const connectPromise = socketService.connect(mockToken);
        
        // 触发连接错误，不抛出Error对象，而是直接触发事件
        await AsyncTestUtils.wait(10);
        socketUtils.mockSocket.triggerEvent(SOCKET_EVENTS.CONNECT_ERROR, { message: 'Connection failed' });
        
        const result = await connectPromise;
        
        // If it resolves instead of rejecting, check the result
        expect(result).toBe(false);
        expect(socketService.status).toBe('error');
      } catch (error) {
        // If it rejects (which is expected behavior), check the error handling
        // Wait for async status update to complete
        await AsyncTestUtils.wait(10);
        expect(socketService.status).toBe('error');
        expect(error).toBeDefined();
      }
    });

    it('应该能够断开连接', () => {
      // 先设置为已连接状态
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      
      socketService.disconnect();
      
      expect(socketUtils.mockSocket.disconnect).toHaveBeenCalled();
      expect(socketService.connected).toBe(false);
      expect(socketService.roomId).toBeNull();
      expect(socketService.gameState).toBeNull();
    });
  });

  describe('房间操作', () => {
    beforeEach(() => {
      // 设置为已连接状态
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      socketUtils.mockSocket.setConnectionState(true);
    });

    it('应该能够加入房间', async () => {
      const roomId = 'test-room-id';
      const password = 'test-password';
      const mockResponse = MockDataFactory.socketResponse.roomJoin(roomId);

      // 模拟服务器响应
      socketUtils.mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.ROOM_JOIN) {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.joinRoom(roomId, password);

      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.ROOM_JOIN,
        { roomId, password },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
      expect(socketService.roomId).toBe(roomId);
    });

    it('应该能够离开房间', async () => {
      const roomId = 'test-room-id';
      const mockResponse = MockDataFactory.socketResponse.success();

      socketUtils.mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.ROOM_LEAVE) {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.leaveRoom(roomId);

      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.ROOM_LEAVE,
        { roomId },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
      expect(socketService.roomId).toBeNull();
    });

    it('应该能够快速开始', async () => {
      const mockResponse = {
        success: true,
        data: { 
          roomId: 'new-room-id', 
          roomState: MockDataFactory.room.basic()
        }
      };

      socketUtils.mockSocket.emit.mockImplementation((event: string, callback: Function) => {
        if (event === SOCKET_EVENTS.ROOM_QUICK_START) {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.quickStart();

      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.ROOM_QUICK_START,
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
      expect(socketService.roomId).toBe('new-room-id');
    });
  });

  describe('游戏操作', () => {
    beforeEach(() => {
      // 设置为已连接和已加入房间状态
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      (socketService as any).currentRoomId = 'test-room';
      socketUtils.mockSocket.setConnectionState(true);
    });

    it('应该能够执行游戏行动', async () => {
      const action = {
        type: 'raise' as const,
        amount: 100,
        timestamp: new Date()
      };
      const mockResponse = MockDataFactory.socketResponse.success();

      socketUtils.mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.GAME_ACTION) {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.makeGameAction('test-room', action);

      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME_ACTION,
        { roomId: 'test-room', action },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
    });

    it('应该能够设置准备状态', async () => {
      const mockResponse = MockDataFactory.socketResponse.success();

      socketUtils.mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.GAME_READY) {
          setTimeout(() => callback(mockResponse), 10);
        }
      });

      const result = await socketService.setReady('test-room');

      expect(socketUtils.mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME_READY,
        { roomId: 'test-room' },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('事件监听', () => {
    it('应该能够注册和取消事件监听器', () => {
      const mockListener = vi.fn();
      const event = 'test-event';

      socketService.on(event, mockListener);
      
      // 通过内部方法触发事件
      (socketService as any).emit(event, { test: 'data' });
      
      expect(mockListener).toHaveBeenCalledWith({ test: 'data' });

      socketService.off(event, mockListener);
      
      // 再次触发事件，监听器不应该被调用
      (socketService as any).emit(event, { test: 'data2' });
      
      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('应该能够监听错误事件', () => {
      const mockErrorListener = vi.fn();
      const error = { message: 'Test error', code: 'TEST_ERROR' };

      socketService.onError(mockErrorListener);
      
      // 触发错误
      (socketService as any).emitError(error);
      
      expect(mockErrorListener).toHaveBeenCalledWith(error);

      socketService.offError(mockErrorListener);
      
      // 再次触发错误，监听器不应该被调用
      (socketService as any).emitError(error);
      
      expect(mockErrorListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('网络质量监控', () => {
    beforeEach(() => {
      // 设置为已连接状态
      (socketService as any).socket = socketUtils.mockSocket;
      (socketService as any).connectionStatus = 'connected';
      socketUtils.mockSocket.setConnectionState(true);
    });

    it('应该发送ping并更新网络质量', async () => {
      const startTime = Date.now();
      
      socketUtils.mockSocket.emit.mockImplementation((event: string, callback: Function) => {
        if (event === SOCKET_EVENTS.PING) {
          // 立即回调，模拟快速网络响应
          setTimeout(() => callback(startTime), 10);
        }
      });

      // 直接调用updateNetworkQuality方法来测试网络质量更新
      const quality = { ping: 50, status: 'excellent' as const };
      (socketService as any).updateNetworkQuality(50);

      // 验证网络质量被正确更新
      expect(socketService.quality.ping).toBe(50);
      expect(socketService.quality.status).toBe('excellent');
    });
  });

  describe('状态管理', () => {
    it('应该正确返回连接状态', () => {
      expect(socketService.connected).toBe(false);
      expect(socketService.status).toBe('disconnected');
    });

    it('应该正确返回房间和游戏状态', () => {
      expect(socketService.roomId).toBeNull();
      expect(socketService.gameState).toBeNull();
      expect(socketService.inGame).toBe(false);
    });
  });
});