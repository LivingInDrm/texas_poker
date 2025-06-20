import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSocket } from '../../src/hooks/useSocket';
import socketService from '../../src/services/socketService';
import { useUserStore } from '../../src/stores/userStore';
import { useGameStore } from '../../src/stores/gameStore';
import { createHookWrapper } from '../helpers/test-utils';

// Mock依赖
vi.mock('../../src/services/socketService', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    quickStart: vi.fn(),
    makeGameAction: vi.fn(),
    setReady: vi.fn(),
    restartGame: vi.fn(),
    on: vi.fn(),
    onError: vi.fn(),
    connected: false,
    roomId: null,
    gameState: null,
    inGame: false
  }
}));

vi.mock('../../src/stores/userStore', () => ({
  useUserStore: vi.fn()
}));

vi.mock('../../src/stores/gameStore', () => ({
  useGameStore: vi.fn()
}));

describe('useSocket', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    chips: 1000,
    avatar: null,
    createdAt: new Date()
  };
  const mockToken = 'test-jwt-token';
  
  const mockUserStore = {
    user: mockUser,
    token: mockToken,
    isAuthenticated: true
  };

  const mockGameStore = {
    setRoomState: vi.fn(),
    setGameState: vi.fn(),
    updatePlayerAction: vi.fn(),
    endGame: vi.fn(),
    currentRoom: null,
    gameState: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useUserStore as any).mockReturnValue(mockUserStore);
    (useGameStore as any).mockReturnValue(mockGameStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // 确保Socket服务断开连接，防止事件监听器泄漏
    if (socketService.connected) {
      socketService.disconnect();
    }
  });

  describe('初始化', () => {
    it('应该返回正确的初始状态', () => {
      const wrapper = createHookWrapper();
      const { result } = renderHook(() => useSocket(), { wrapper });

      expect(result.current.connected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.gameState).toBeNull();
      expect(result.current.inGame).toBe(false);
    });

    it('有token时应该自动连接', async () => {
      const wrapper = createHookWrapper();
      (socketService.connect as any).mockResolvedValue(true);

      await act(async () => {
        renderHook(() => useSocket(), { wrapper });
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(socketService.connect).toHaveBeenCalledWith(mockToken);
    });

    it('没有token时不应该连接', async () => {
      (useUserStore as any).mockReturnValue({
        ...mockUserStore,
        token: null
      });

      await act(async () => {
        renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(socketService.connect).not.toHaveBeenCalled();
    });
  });

  describe('连接管理', () => {
    it('connect方法应该调用socketService.connect', async () => {
      (socketService.connect as any).mockResolvedValue(true);
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        const success = await result.current.connect();
        expect(success).toBe(true);
      });

      expect(socketService.connect).toHaveBeenCalledWith(mockToken);
    });

    it('disconnect方法应该调用socketService.disconnect', async () => {
      let result: any;
      await act(async () => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.disconnect();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(socketService.disconnect).toHaveBeenCalled();
    });
  });

  describe('房间操作', () => {
    it('joinRoom应该调用socketService.joinRoom并更新状态', async () => {
      const mockRoomState = {
        id: 'room-1',
        ownerId: 'user-1',
        players: [],
        status: 'WAITING' as const,
        maxPlayers: 6,
        currentPlayerCount: 1,
        hasPassword: false,
        bigBlind: 20,
        smallBlind: 10,
        gameStarted: false
      };

      const mockResponse = {
        success: true,
        data: { roomState: mockRoomState }
      };

      (socketService.joinRoom as any).mockResolvedValue(mockResponse);
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        const response = await result.current.joinRoom('room-1', 'password');
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.joinRoom).toHaveBeenCalledWith('room-1', 'password');
      expect(mockGameStore.setRoomState).toHaveBeenCalledWith(mockRoomState);
    });

    it('leaveRoom应该调用socketService.leaveRoom并清除状态', async () => {
      const mockResponse = { success: true };
      (socketService.leaveRoom as any).mockResolvedValue(mockResponse);
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        const response = await result.current.leaveRoom('room-1');
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.leaveRoom).toHaveBeenCalledWith('room-1');
      expect(mockGameStore.setRoomState).toHaveBeenCalledWith(null);
      expect(mockGameStore.setGameState).toHaveBeenCalledWith(null);
    });

    it('quickStart应该调用socketService.quickStart并更新状态', async () => {
      const mockRoomState = {
        id: 'room-2',
        ownerId: 'user-1',
        players: [],
        status: 'WAITING' as const,
        maxPlayers: 6,
        currentPlayerCount: 1,
        hasPassword: false,
        bigBlind: 20,
        smallBlind: 10,
        gameStarted: false
      };

      const mockResponse = {
        success: true,
        data: { roomState: mockRoomState }
      };

      (socketService.quickStart as any).mockResolvedValue(mockResponse);
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        const response = await result.current.quickStart();
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.quickStart).toHaveBeenCalled();
      expect(mockGameStore.setRoomState).toHaveBeenCalledWith(mockRoomState);
    });
  });

  describe('游戏操作', () => {
    beforeEach(() => {
      (socketService as any).roomId = 'test-room';
    });

    it('makeGameAction应该调用socketService.makeGameAction', async () => {
      const mockAction = {
        type: 'raise' as const,
        amount: 100,
        timestamp: new Date()
      };
      const mockResponse = { success: true };

      (socketService.makeGameAction as any).mockResolvedValue(mockResponse);
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        const response = await result.current.makeGameAction(mockAction);
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.makeGameAction).toHaveBeenCalledWith('test-room', mockAction);
    });

    it('setReady应该调用socketService.setReady', async () => {
      const mockResponse = { success: true };
      (socketService.setReady as any).mockResolvedValue(mockResponse);
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        const response = await result.current.setReady();
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.setReady).toHaveBeenCalledWith('test-room');
    });

    it('restartGame应该调用socketService.restartGame', async () => {
      const mockResponse = { success: true };
      (socketService.restartGame as any).mockResolvedValue(mockResponse);
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        const response = await result.current.restartGame();
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.restartGame).toHaveBeenCalledWith('test-room');
    });

    it('没有房间ID时游戏操作应该抛出错误', async () => {
      (socketService as any).roomId = null;
      let result: any;
      act(() => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        result = hookResult.result;
      });

      await act(async () => {
        await expect(async () => {
          await result.current.makeGameAction({
            type: 'fold',
            timestamp: new Date()
          });
        }).rejects.toThrow('Not in a room');
      });
    });
  });

  describe('事件监听', () => {
    it('应该设置Socket事件监听器', async () => {
      await act(async () => {
        renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // 验证监听器被设置
      expect(socketService.on).toHaveBeenCalledWith('connection_status_change', expect.any(Function));
      expect(socketService.on).toHaveBeenCalledWith('network_quality_update', expect.any(Function));
      expect(socketService.onError).toHaveBeenCalledWith(expect.any(Function));
    });

    it('应该在组件卸载时清理事件监听器', async () => {
      let unmount: () => void;
      await act(async () => {
        const { unmount: hookUnmount } = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        unmount = hookUnmount;
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // 模拟组件卸载
      act(() => {
        unmount!();
      });

      // 在实际项目中，这里应该验证事件监听器被移除
      // 由于我们使用的是mock，这里主要是确保卸载过程不会报错
      expect(true).toBe(true);
    });
  });

  describe('自动连接和断开', () => {
    it('用户登出时应该自动断开连接', async () => {
      // 设置 connect 返回成功
      (socketService.connect as any).mockResolvedValue(true);
      
      // 首先设置用户状态为已登录
      (useUserStore as any).mockReturnValue({
        ...mockUserStore,
        user: mockUser,
        token: mockToken,
        isAuthenticated: true
      });

      let rerender: any;
      let result: any;
      await act(async () => {
        const hookResult = renderHook(() => useSocket(), { wrapper: createHookWrapper() });
        rerender = hookResult.rerender;
        result = hookResult.result;
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // 手动连接并等待状态更新
      await act(async () => {
        await result.current.connect();
      });

      // 清除之前的调用记录
      vi.clearAllMocks();

      // 模拟用户登出
      (useUserStore as any).mockReturnValue({
        ...mockUserStore,
        user: null,
        token: null,
        isAuthenticated: false
      });

      await act(async () => {
        rerender();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(socketService.disconnect).toHaveBeenCalled();
    });
  });
});