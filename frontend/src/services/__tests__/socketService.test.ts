import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { io } from 'socket.io-client';
import socketService from '../socketService';
import { SOCKET_EVENTS, ConnectionStatus } from '../../types/socket';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn()
}));

// Mock环境变量
vi.mock('../../config/env', () => ({
  BACKEND_URL: 'http://localhost:3000'
}));

describe('SocketService', () => {
  let mockSocket: any;
  const mockToken = 'test-jwt-token';

  beforeEach(() => {
    // 创建mock socket实例
    mockSocket = {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      join: vi.fn(),
      leave: vi.fn()
    };

    (io as Mock).mockReturnValue(mockSocket);
  });

  afterEach(() => {
    vi.clearAllMocks();
    socketService.disconnect();
  });

  describe('连接管理', () => {
    it('应该能够成功连接到服务器', async () => {
      mockSocket.connected = true;

      // 模拟连接成功
      mockSocket.connect.mockImplementation(() => {
        // 模拟连接事件
        const connectHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === SOCKET_EVENTS.CONNECT
        )?.[1];
        if (connectHandler) connectHandler();
      });

      const result = await socketService.connect(mockToken);

      expect(io).toHaveBeenCalledWith('http://localhost:3000', expect.objectContaining({
        autoConnect: false,
        auth: { token: mockToken }
      }));
      expect(mockSocket.connect).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('应该处理连接失败', async () => {
      const mockError = new Error('Connection failed');
      
      mockSocket.connect.mockImplementation(() => {
        const errorHandler = mockSocket.once.mock.calls.find(
          (call: any) => call[0] === SOCKET_EVENTS.CONNECT_ERROR
        )?.[1];
        if (errorHandler) errorHandler(mockError);
      });

      const result = await socketService.connect(mockToken);

      expect(result).toBe(false);
    });

    it('应该能够断开连接', () => {
      socketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(socketService.connected).toBe(false);
    });
  });

  describe('房间操作', () => {
    beforeEach(async () => {
      mockSocket.connected = true;
      mockSocket.connect.mockImplementation(() => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === SOCKET_EVENTS.CONNECT
        )?.[1];
        if (connectHandler) connectHandler();
      });
      await socketService.connect(mockToken);
    });

    it('应该能够加入房间', async () => {
      const roomId = 'test-room-id';
      const password = 'test-password';
      const mockResponse = {
        success: true,
        data: { roomState: { id: roomId, players: [] } }
      };

      mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.ROOM_JOIN) {
          callback(mockResponse);
        }
      });

      const result = await socketService.joinRoom(roomId, password);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.ROOM_JOIN,
        { roomId, password },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
      expect(socketService.roomId).toBe(roomId);
    });

    it('应该能够离开房间', async () => {
      const roomId = 'test-room-id';
      const mockResponse = { success: true };

      mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.ROOM_LEAVE) {
          callback(mockResponse);
        }
      });

      const result = await socketService.leaveRoom(roomId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
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
        data: { roomId: 'new-room-id', roomState: { id: 'new-room-id', players: [] } }
      };

      mockSocket.emit.mockImplementation((event: string, callback: Function) => {
        if (event === SOCKET_EVENTS.ROOM_QUICK_START) {
          callback(mockResponse);
        }
      });

      const result = await socketService.quickStart();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.ROOM_QUICK_START,
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
      expect(socketService.roomId).toBe('new-room-id');
    });
  });

  describe('游戏操作', () => {
    beforeEach(async () => {
      mockSocket.connected = true;
      mockSocket.connect.mockImplementation(() => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === SOCKET_EVENTS.CONNECT
        )?.[1];
        if (connectHandler) connectHandler();
      });
      await socketService.connect(mockToken);
      
      // 模拟加入房间
      (socketService as any).currentRoomId = 'test-room';
    });

    it('应该能够执行游戏行动', async () => {
      const action = {
        type: 'raise' as const,
        amount: 100,
        timestamp: new Date()
      };
      const mockResponse = { success: true };

      mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.GAME_ACTION) {
          callback(mockResponse);
        }
      });

      const result = await socketService.makeGameAction('test-room', action);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.GAME_ACTION,
        { roomId: 'test-room', action },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
    });

    it('应该能够设置准备状态', async () => {
      const mockResponse = { success: true };

      mockSocket.emit.mockImplementation((event: string, data: any, callback: Function) => {
        if (event === SOCKET_EVENTS.GAME_READY) {
          callback(mockResponse);
        }
      });

      const result = await socketService.setReady('test-room');

      expect(mockSocket.emit).toHaveBeenCalledWith(
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
      
      // 模拟触发事件
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
      
      // 模拟触发错误
      (socketService as any).emitError(error);
      
      expect(mockErrorListener).toHaveBeenCalledWith(error);

      socketService.offError(mockErrorListener);
      
      // 再次触发错误，监听器不应该被调用
      (socketService as any).emitError(error);
      
      expect(mockErrorListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('网络质量监控', () => {
    beforeEach(async () => {
      mockSocket.connected = true;
      mockSocket.connect.mockImplementation(() => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call: any) => call[0] === SOCKET_EVENTS.CONNECT
        )?.[1];
        if (connectHandler) connectHandler();
      });
      await socketService.connect(mockToken);
    });

    it('应该发送ping并更新网络质量', (done) => {
      const startTime = Date.now();
      
      mockSocket.emit.mockImplementation((event: string, callback: Function) => {
        if (event === SOCKET_EVENTS.PING) {
          // 模拟网络延迟
          setTimeout(() => {
            callback(startTime);
          }, 50);
        }
      });

      socketService.on('network_quality_update', (quality) => {
        expect(quality.ping).toBeGreaterThan(0);
        expect(quality.status).toBe('excellent');
        done();
      });

      // 手动触发ping（在实际应用中是定时器触发）
      (socketService as any).startPingMonitoring();
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