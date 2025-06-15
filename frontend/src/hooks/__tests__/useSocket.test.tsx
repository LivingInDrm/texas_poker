import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSocket } from '../useSocket';
import socketService from '../../services/socketService';
import { useUserStore } from '../../stores/userStore';
import { useGameStore } from '../../stores/gameStore';

// Mock依赖
vi.mock('../../services/socketService', () => ({
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

vi.mock('../../stores/userStore', () => ({
  useUserStore: vi.fn()
}));

vi.mock('../../stores/gameStore', () => ({
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
  });

  describe('初始化', () => {
    it('应该返回正确的初始状态', () => {
      const { result } = renderHook(() => useSocket());

      expect(result.current.connected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.gameState).toBeNull();
      expect(result.current.inGame).toBe(false);
    });

    it('有token时应该自动连接', async () => {
      (socketService.connect as any).mockResolvedValue(true);

      await act(async () => {
        renderHook(() => useSocket());
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
        renderHook(() => useSocket());
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(socketService.connect).not.toHaveBeenCalled();
    });
  });

  describe('连接管理', () => {
    it('connect方法应该调用socketService.connect', async () => {
      (socketService.connect as any).mockResolvedValue(true);
      const { result } = renderHook(() => useSocket());

      await act(async () => {
        const success = await result.current.connect();
        expect(success).toBe(true);
      });

      expect(socketService.connect).toHaveBeenCalledWith(mockToken);
    });

    it('disconnect方法应该调用socketService.disconnect', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.disconnect();
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
      const { result } = renderHook(() => useSocket());

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
      const { result } = renderHook(() => useSocket());

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
      const { result } = renderHook(() => useSocket());

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
      const { result } = renderHook(() => useSocket());

      await act(async () => {
        const response = await result.current.makeGameAction(mockAction);
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.makeGameAction).toHaveBeenCalledWith('test-room', mockAction);
    });

    it('setReady应该调用socketService.setReady', async () => {
      const mockResponse = { success: true };
      (socketService.setReady as any).mockResolvedValue(mockResponse);
      const { result } = renderHook(() => useSocket());

      await act(async () => {
        const response = await result.current.setReady();
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.setReady).toHaveBeenCalledWith('test-room');
    });

    it('restartGame应该调用socketService.restartGame', async () => {
      const mockResponse = { success: true };
      (socketService.restartGame as any).mockResolvedValue(mockResponse);
      const { result } = renderHook(() => useSocket());

      await act(async () => {
        const response = await result.current.restartGame();
        expect(response).toEqual(mockResponse);
      });

      expect(socketService.restartGame).toHaveBeenCalledWith('test-room');
    });

    it('没有房间ID时游戏操作应该抛出错误', async () => {
      (socketService as any).roomId = null;
      const { result } = renderHook(() => useSocket());

      await expect(async () => {
        await result.current.makeGameAction({
          type: 'fold',
          timestamp: new Date()
        });
      }).rejects.toThrow('Not in a room');
    });
  });

  describe('事件监听', () => {
    it('应该设置Socket事件监听器', () => {
      renderHook(() => useSocket());

      // 验证监听器被设置
      expect(socketService.on).toHaveBeenCalledWith('connection_status_change', expect.any(Function));
      expect(socketService.on).toHaveBeenCalledWith('network_quality_update', expect.any(Function));
      expect(socketService.onError).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('自动连接和断开', () => {
    it('用户登出时应该自动断开连接', () => {
      const { rerender } = renderHook(() => useSocket());

      // 模拟用户登出
      (useUserStore as any).mockReturnValue({
        ...mockUserStore,
        user: null,
        token: null,
        isAuthenticated: false
      });
      
      // 模拟连接状态
      (socketService as any).connected = true;

      rerender();

      expect(socketService.disconnect).toHaveBeenCalled();
    });
  });
});