/**
 * 房间准备系统前端测试
 * 测试 GamePage 中的房间准备状态和游戏开始功能
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../src/stores/gameStore';
import { useUserStore } from '../../src/stores/userStore';
import { useSocket } from '../../src/hooks/useSocket';
import GamePage from '../../src/pages/GamePage';

// Mock dependencies
vi.mock('../../src/hooks/useSocket');
vi.mock('../../src/stores/gameStore');
vi.mock('../../src/stores/userStore');

// Mock React Router params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ roomId: 'test-room-1' }),
    useNavigate: () => vi.fn(),
  };
});

const mockUseSocket = useSocket as vi.MockedFunction<typeof useSocket>;
const mockUseGameStore = useGameStore as vi.MockedFunction<typeof useGameStore>;
const mockUseUserStore = useUserStore as vi.MockedFunction<typeof useUserStore>;

describe('房间准备系统前端测试', () => {
  let mockSocketMethods: any;
  let mockGameStore: any;
  let mockUserStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // 设置Socket mock方法
    mockSocketMethods = {
      connected: true,
      connectionStatus: 'connected' as const,
      networkQuality: { ping: 50, status: 'excellent' as const },
      connect: vi.fn().mockResolvedValue(true),
      joinRoom: vi.fn().mockResolvedValue({ success: true }),
      leaveRoom: vi.fn().mockResolvedValue({ success: true }),
      makeGameAction: vi.fn().mockResolvedValue({ success: true }),
      setReady: vi.fn().mockResolvedValue({ success: true }),
      startGame: vi.fn().mockResolvedValue({ success: true }),
      restartGame: vi.fn().mockResolvedValue({ success: true }),
    };

    mockUseSocket.mockReturnValue(mockSocketMethods);

    // 设置用户Store
    mockUserStore = {
      user: {
        id: 'player-1',
        username: 'TestPlayer',
        chips: 5000,
      },
    };

    mockUseUserStore.mockReturnValue(mockUserStore);

    // 设置游戏Store
    mockGameStore = {
      currentRoom: {
        id: 'test-room-1',
        ownerId: 'owner-1',
        players: [
          {
            id: 'owner-1',
            username: 'Owner',
            chips: 5000,
            isReady: true,
            position: 0,
            isConnected: true,
          },
          {
            id: 'player-1',
            username: 'TestPlayer',
            chips: 5000,
            isReady: false,
            position: 1,
            isConnected: true,
          },
          {
            id: 'player-2',
            username: 'Player2',
            chips: 5000,
            isReady: false,
            position: 2,
            isConnected: true,
          },
        ],
        status: 'WAITING' as const,
        maxPlayers: 6,
        currentPlayerCount: 3,
        hasPassword: false,
        bigBlind: 20,
        smallBlind: 10,
        gameStarted: false,
      },
      gameState: null,
      isInGame: false,
      getCurrentPlayer: vi.fn().mockReturnValue(null),
      getMyPlayer: vi.fn().mockReturnValue(null),
      canPlayerAct: vi.fn().mockReturnValue(false),
    };

    mockUseGameStore.mockReturnValue(mockGameStore);
  });

  const renderGamePage = () => {
    return render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>
    );
  };

  describe('普通玩家准备状态测试', () => {
    test('应该显示准备按钮给普通玩家', async () => {
      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText('准备游戏')).toBeInTheDocument();
      });
    });

    test('应该允许普通玩家切换准备状态', async () => {
      renderGamePage();

      await waitFor(() => {
        const readyButton = screen.getByText('准备游戏');
        expect(readyButton).toBeInTheDocument();
        
        fireEvent.click(readyButton);
        
        expect(mockSocketMethods.setReady).toHaveBeenCalled();
      });
    });

    test('应该显示正确的准备状态文本', async () => {
      // 设置玩家已准备
      mockGameStore.currentRoom.players[1].isReady = true;
      
      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText('取消准备')).toBeInTheDocument();
      });
    });
  });

  describe('房主游戏开始测试', () => {
    beforeEach(() => {
      // 设置当前用户为房主
      mockUserStore.user.id = 'owner-1';
    });

    test('应该显示开始游戏按钮给房主', async () => {
      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText(/开始游戏|等待玩家准备/)).toBeInTheDocument();
      });
    });

    test('当条件不满足时开始游戏按钮应该被禁用', async () => {
      renderGamePage();

      await waitFor(() => {
        const startButton = screen.getByText('等待玩家准备');
        expect(startButton).toBeDisabled();
      });
    });

    test('当所有条件满足时开始游戏按钮应该可点击', async () => {
      // 设置所有非房主玩家都已准备
      mockGameStore.currentRoom.players = mockGameStore.currentRoom.players.map((p: any) => 
        p.id === 'owner-1' ? p : { ...p, isReady: true }
      );

      renderGamePage();

      await waitFor(() => {
        const startButton = screen.getByText('🚀 开始游戏');
        expect(startButton).not.toBeDisabled();
        
        fireEvent.click(startButton);
        
        expect(mockSocketMethods.startGame).toHaveBeenCalled();
      });
    });

    test('房主不应该看到准备按钮', async () => {
      renderGamePage();

      await waitFor(() => {
        expect(screen.queryByText('准备游戏')).not.toBeInTheDocument();
        expect(screen.queryByText('取消准备')).not.toBeInTheDocument();
      });
    });
  });

  describe('房间状态显示测试', () => {
    test('应该正确显示玩家准备状态', async () => {
      renderGamePage();

      await waitFor(() => {
        // 检查房主状态
        expect(screen.getByText('Owner 👑')).toBeInTheDocument();
        expect(screen.getByText('房主')).toBeInTheDocument();
        
        // 检查准备状态指示器 - 只有非房主玩家显示准备状态
        expect(screen.getAllByText('⏳ 等待中')).toHaveLength(2); // 两个未准备的玩家
      });
    });

    test('应该显示游戏开始条件提示', async () => {
      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText('等待房主开始游戏')).toBeInTheDocument();
      });
    });

    test('当玩家数量不足时应该显示相应提示', async () => {
      // 设置只有房主和一个玩家
      mockGameStore.currentRoom.players = mockGameStore.currentRoom.players.slice(0, 2);
      mockGameStore.currentRoom.currentPlayerCount = 2;

      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText('需要至少2名玩家才能开始游戏')).toBeInTheDocument();
      });
    });

    test('当所有条件满足时应该显示可以开始游戏', async () => {
      // 设置当前用户为房主，所有其他玩家都已准备
      mockUserStore.user.id = 'owner-1';
      mockGameStore.currentRoom.players = mockGameStore.currentRoom.players.map((p: any) => 
        p.id === 'owner-1' ? p : { ...p, isReady: true }
      );

      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText('所有条件已满足，可以开始游戏！')).toBeInTheDocument();
      });
    });
  });

  describe('权限控制测试', () => {
    test('非房主用户不应该看到开始游戏按钮', async () => {
      // 确保当前用户不是房主
      mockUserStore.user.id = 'player-1';
      
      renderGamePage();

      await waitFor(() => {
        expect(screen.queryByText(/开始游戏/)).not.toBeInTheDocument();
        expect(screen.getByText('准备游戏')).toBeInTheDocument();
      });
    });

    test('房主不应该看到准备按钮', async () => {
      // 设置当前用户为房主
      mockUserStore.user.id = 'owner-1';
      
      renderGamePage();

      await waitFor(() => {
        expect(screen.queryByText('准备游戏')).not.toBeInTheDocument();
        expect(screen.queryByText('取消准备')).not.toBeInTheDocument();
        expect(screen.getByText(/开始游戏|等待玩家准备/)).toBeInTheDocument();
      });
    });
  });

  describe('错误处理测试', () => {
    test('应该处理准备状态设置失败', async () => {
      mockSocketMethods.setReady.mockResolvedValue({ 
        success: false, 
        error: '设置准备状态失败' 
      });

      renderGamePage();

      await waitFor(() => {
        const readyButton = screen.getByText('准备游戏');
        fireEvent.click(readyButton);
      });

      // 这里可以添加对错误消息显示的测试
      // 需要GamePage实现错误状态显示
    });

    test('应该处理游戏开始失败', async () => {
      mockUserStore.user.id = 'owner-1';
      mockGameStore.currentRoom.players = mockGameStore.currentRoom.players.map((p: any) => 
        p.id === 'owner-1' ? p : { ...p, isReady: true }
      );

      mockSocketMethods.startGame.mockResolvedValue({ 
        success: false, 
        error: '开始游戏失败' 
      });

      renderGamePage();

      await waitFor(() => {
        const startButton = screen.getByText('🚀 开始游戏');
        fireEvent.click(startButton);
      });

      // 这里可以添加对错误消息显示的测试
    });
  });

  describe('房间信息显示测试', () => {
    test('应该显示房间基本信息', async () => {
      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText('房间: test-room-1')).toBeInTheDocument();
        expect(screen.getByText('玩家: 3/6')).toBeInTheDocument();
        expect(screen.getByText('状态: 等待中')).toBeInTheDocument();
        expect(screen.getByText('盲注: 10/20')).toBeInTheDocument();
      });
    });

    test('应该显示所有玩家信息', async () => {
      renderGamePage();

      await waitFor(() => {
        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.getByText('TestPlayer')).toBeInTheDocument();
        expect(screen.getByText('Player2')).toBeInTheDocument();
      });
    });
  });
});