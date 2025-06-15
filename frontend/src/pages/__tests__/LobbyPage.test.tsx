import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LobbyPage from '../LobbyPage';

// Mock the stores and hooks
vi.mock('../../stores/userStore', () => ({
  useUserStore: vi.fn(() => ({
    user: {
      id: 'user-123',
      username: 'testuser',
      chips: 5000,
      avatar: 'https://example.com/avatar.jpg'
    },
    logout: vi.fn()
  }))
}));

vi.mock('../../stores/roomStore', () => ({
  useRoomStore: vi.fn(() => ({
    rooms: [
      {
        id: 'room-1',
        ownerId: 'user-456',
        owner: { id: 'user-456', username: 'owner1' },
        playerLimit: 6,
        currentPlayers: 2,
        hasPassword: false,
        status: 'WAITING',
        bigBlind: 20,
        smallBlind: 10,
        createdAt: '2025-06-15T10:00:00.000Z'
      },
      {
        id: 'room-2',
        ownerId: 'user-789',
        owner: { id: 'user-789', username: 'owner2' },
        playerLimit: 4,
        currentPlayers: 4,
        hasPassword: true,
        status: 'PLAYING',
        bigBlind: 40,
        smallBlind: 20,
        createdAt: '2025-06-15T11:00:00.000Z'
      }
    ],
    isLoading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1
    },
    fetchRooms: vi.fn(),
    clearError: vi.fn(),
    refreshRooms: vi.fn()
  }))
}));

vi.mock('../../hooks/useSocket', () => ({
  useSocket: vi.fn(() => ({
    connected: true,
    connectionStatus: 'connected',
    networkQuality: 'good',
    connect: vi.fn().mockResolvedValue(undefined),
    quickStart: vi.fn(),
    joinRoom: vi.fn()
  }))
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div data-testid="router">{children}</div>
  };
});

// Mock components
vi.mock('../../components/NetworkIndicator', () => ({
  NetworkIndicator: ({ connectionStatus, networkQuality }: any) => (
    <div data-testid="network-indicator">
      Status: {connectionStatus}, Quality: {networkQuality}
    </div>
  )
}));

vi.mock('../../components/RoomList', () => ({
  default: ({ rooms, isLoading, onJoinRoom, pagination, onPageChange }: any) => (
    <div data-testid="room-list">
      <div data-testid="room-count">{rooms.length} rooms</div>
      {isLoading && <div data-testid="loading">Loading...</div>}
      {rooms.map((room: any) => (
        <div key={room.id} data-testid={`room-${room.id}`}>
          <span>{room.owner.username} 的房间</span>
          <button onClick={() => onJoinRoom(room.id, room.hasPassword)}>
            加入房间
          </button>
        </div>
      ))}
      <div data-testid="pagination">
        Page {pagination.page} of {pagination.totalPages}
        <button onClick={() => onPageChange(pagination.page + 1)}>Next</button>
      </div>
    </div>
  )
}));

vi.mock('../../components/CreateRoomModal', () => ({
  default: ({ isOpen, onClose }: any) => (
    isOpen ? (
      <div data-testid="create-room-modal">
        <h2>创建房间</h2>
        <button onClick={onClose}>关闭</button>
      </div>
    ) : null
  )
}));

vi.mock('../../components/JoinRoomModal', () => ({
  default: ({ isOpen, onClose, roomId, onJoinRoom }: any) => (
    isOpen ? (
      <div data-testid="join-room-modal">
        <h2>加入房间 {roomId}</h2>
        <button onClick={onClose}>关闭</button>
        {onJoinRoom && (
          <button onClick={() => onJoinRoom(roomId, 'password')}>
            Socket加入
          </button>
        )}
      </div>
    ) : null
  )
}));

describe('LobbyPage', () => {
  const renderLobbyPage = () => {
    return render(
      <BrowserRouter>
        <LobbyPage />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render lobby page with header and main content', () => {
      renderLobbyPage();
      
      expect(screen.getByText('🃏 德州扑克')).toBeInTheDocument();
      expect(screen.getByText('游戏大厅')).toBeInTheDocument();
      expect(screen.getByText('选择一个房间开始游戏，或创建你自己的房间')).toBeInTheDocument();
    });

    it('should display user information in header', () => {
      renderLobbyPage();
      
      expect(screen.getByText('欢迎, testuser')).toBeInTheDocument();
      expect(screen.getByText('筹码: 5000')).toBeInTheDocument();
    });

    it('should display network indicator', () => {
      renderLobbyPage();
      
      expect(screen.getByTestId('network-indicator')).toBeInTheDocument();
      expect(screen.getByText('Status: connected, Quality: good')).toBeInTheDocument();
    });

    it('should display room list with correct data', () => {
      renderLobbyPage();
      
      expect(screen.getByTestId('room-list')).toBeInTheDocument();
      expect(screen.getByText('2 rooms')).toBeInTheDocument();
      expect(screen.getByText('总计 2 个房间')).toBeInTheDocument();
    });

    it('should display user stats section', () => {
      renderLobbyPage();
      
      expect(screen.getByText('5,000')).toBeInTheDocument();
      expect(screen.getByText('筹码余额')).toBeInTheDocument();
      expect(screen.getByText('已玩游戏')).toBeInTheDocument();
      expect(screen.getByText('胜率')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should have create room button', () => {
      renderLobbyPage();
      
      const createButton = screen.getByRole('button', { name: /创建房间/ });
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveClass('bg-yellow-600');
    });

    it('should have quick start button', () => {
      renderLobbyPage();
      
      const quickStartButton = screen.getByRole('button', { name: /快速开始/ });
      expect(quickStartButton).toBeInTheDocument();
      expect(quickStartButton).toHaveClass('bg-blue-600');
    });

    it('should have refresh button', () => {
      renderLobbyPage();
      
      const refreshButton = screen.getByRole('button', { name: /刷新/ });
      expect(refreshButton).toBeInTheDocument();
      expect(refreshButton).toHaveClass('bg-green-600');
    });

    it('should have logout button', () => {
      renderLobbyPage();
      
      const logoutButton = screen.getByRole('button', { name: /退出登录/ });
      expect(logoutButton).toBeInTheDocument();
      expect(logoutButton).toHaveClass('bg-red-600');
    });
  });

  describe('Modal Interactions', () => {
    it('should open create room modal when create button is clicked', () => {
      renderLobbyPage();
      
      const createButton = screen.getByRole('button', { name: /创建房间/ });
      fireEvent.click(createButton);
      
      expect(screen.getByTestId('create-room-modal')).toBeInTheDocument();
    });

    it('should close create room modal when close is called', () => {
      renderLobbyPage();
      
      const createButton = screen.getByRole('button', { name: /创建房间/ });
      fireEvent.click(createButton);
      
      const closeButton = screen.getByText('关闭');
      fireEvent.click(closeButton);
      
      expect(screen.queryByTestId('create-room-modal')).not.toBeInTheDocument();
    });

    it('should open join room modal when room is clicked', () => {
      renderLobbyPage();
      
      const joinButton = screen.getAllByText('加入房间')[0];
      fireEvent.click(joinButton);
      
      expect(screen.getByTestId('join-room-modal')).toBeInTheDocument();
      expect(screen.getByText('加入房间 room-1')).toBeInTheDocument();
    });
  });

  describe('Quick Start Functionality', () => {
    it('should call quickStart when connected and button is clicked', async () => {
      const mockQuickStart = vi.fn().mockResolvedValue({
        success: true,
        data: { roomId: 'room-123' }
      });

      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: true,
        connectionStatus: 'connected',
        networkQuality: 'good',
        connect: vi.fn(),
        quickStart: mockQuickStart,
        joinRoom: vi.fn()
      });

      renderLobbyPage();
      
      const quickStartButton = screen.getByRole('button', { name: /快速开始/ });
      fireEvent.click(quickStartButton);
      
      expect(mockQuickStart).toHaveBeenCalled();
    });

    it('should show loading state during quick start', async () => {
      const mockQuickStart = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves

      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: true,
        connectionStatus: 'connected',
        networkQuality: 'good',
        connect: vi.fn(),
        quickStart: mockQuickStart,
        joinRoom: vi.fn()
      });

      renderLobbyPage();
      
      const quickStartButton = screen.getByRole('button', { name: /快速开始/ });
      fireEvent.click(quickStartButton);
      
      expect(screen.getByText('匹配中...')).toBeInTheDocument();
      expect(quickStartButton).toBeDisabled();
    });

    it('should navigate to game room on successful quick start', async () => {
      const mockQuickStart = vi.fn().mockResolvedValue({
        success: true,
        data: { roomId: 'room-123' }
      });

      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: true,
        connectionStatus: 'connected',
        networkQuality: 'good',
        connect: vi.fn(),
        quickStart: mockQuickStart,
        joinRoom: vi.fn()
      });

      renderLobbyPage();
      
      const quickStartButton = screen.getByRole('button', { name: /快速开始/ });
      fireEvent.click(quickStartButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/game/room-123');
      });
    });

    it('should use fallback quick start when not connected', async () => {
      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: false,
        connectionStatus: 'disconnected',
        networkQuality: 'poor',
        connect: vi.fn().mockResolvedValue(undefined),
        quickStart: vi.fn(),
        joinRoom: vi.fn()
      });

      renderLobbyPage();
      
      const quickStartButton = screen.getByRole('button', { name: /快速开始/ });
      fireEvent.click(quickStartButton);
      
      // Should open join room modal because there's an available room in mock data
      expect(screen.getByTestId('join-room-modal')).toBeInTheDocument();
    });
  });

  describe('Socket Integration', () => {
    it('should show connection warning when not connected', async () => {
      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: false,
        connectionStatus: 'disconnected',
        networkQuality: 'poor',
        connect: vi.fn().mockResolvedValue(undefined),
        quickStart: vi.fn(),
        joinRoom: vi.fn()
      });

      renderLobbyPage();
      
      expect(screen.getByText('未连接到实时服务器，部分功能可能受限')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '重连' })).toBeInTheDocument();
    });

    it('should handle socket join room functionality', async () => {
      const mockJoinRoom = vi.fn().mockResolvedValue({
        success: true
      });

      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: true,
        connectionStatus: 'connected',
        networkQuality: 'good',
        connect: vi.fn(),
        quickStart: vi.fn(),
        joinRoom: mockJoinRoom
      });

      renderLobbyPage();
      
      // Open join room modal
      const joinButton = screen.getAllByText('加入房间')[0];
      fireEvent.click(joinButton);
      
      // Click socket join button in modal
      const socketJoinButton = screen.getByText('Socket加入');
      fireEvent.click(socketJoinButton);
      
      expect(mockJoinRoom).toHaveBeenCalledWith('room-1', 'password');
    });
  });

  describe('Error Handling', () => {
    it('should display error messages from room store', async () => {
      const { useRoomStore } = await import('../../stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        rooms: [],
        isLoading: false,
        error: '网络错误',
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        fetchRooms: vi.fn(),
        clearError: vi.fn(),
        refreshRooms: vi.fn()
      });

      renderLobbyPage();
      
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });

    it('should allow clearing error messages', async () => {
      const mockClearError = vi.fn();
      const { useRoomStore } = await import('../../stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        rooms: [],
        isLoading: false,
        error: '网络错误',
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        fetchRooms: vi.fn(),
        clearError: mockClearError,
        refreshRooms: vi.fn()
      });

      renderLobbyPage();
      
      const closeErrorButton = screen.getByRole('button', { name: '' });
      fireEvent.click(closeErrorButton);
      
      expect(mockClearError).toHaveBeenCalled();
    });

    it('should handle socket errors', async () => {
      const mockQuickStart = vi.fn().mockRejectedValue(new Error('Socket error'));

      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: true,
        connectionStatus: 'connected',
        networkQuality: 'good',
        connect: vi.fn(),
        quickStart: mockQuickStart,
        joinRoom: vi.fn()
      });

      renderLobbyPage();
      
      const quickStartButton = screen.getByRole('button', { name: /快速开始/ });
      fireEvent.click(quickStartButton);
      
      await waitFor(() => {
        expect(screen.getByText('Socket error')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive grid classes', () => {
      renderLobbyPage();
      
      // Check for responsive button container
      const buttonSection = document.querySelector('.flex.flex-col.sm\\:flex-row');
      expect(buttonSection).toBeInTheDocument();
      
      // Check for responsive stats grid
      const statsGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
      expect(statsGrid).toBeInTheDocument();
    });

    it('should handle mobile navigation patterns', () => {
      renderLobbyPage();
      
      // Check that buttons container has responsive classes
      const buttonsContainer = document.querySelector('.flex.flex-col.sm\\:flex-row.gap-4.justify-center');
      expect(buttonsContainer).toBeInTheDocument();
    });
  });

  describe('Lifecycle and Effects', () => {
    it('should fetch rooms on mount', async () => {
      const mockFetchRooms = vi.fn();
      const { useRoomStore } = await import('../../stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        rooms: [],
        isLoading: false,
        error: null,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        fetchRooms: mockFetchRooms,
        clearError: vi.fn(),
        refreshRooms: vi.fn()
      });

      renderLobbyPage();
      
      expect(mockFetchRooms).toHaveBeenCalled();
    });

    it('should auto-refresh rooms every 10 seconds', async () => {
      const mockRefreshRooms = vi.fn();
      const { useRoomStore } = await import('../../stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        rooms: [],
        isLoading: false,
        error: null,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        fetchRooms: vi.fn(),
        clearError: vi.fn(),
        refreshRooms: mockRefreshRooms
      });

      vi.useFakeTimers();
      renderLobbyPage();
      
      // Advance time by 10 seconds
      vi.advanceTimersByTime(10000);
      
      expect(mockRefreshRooms).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should attempt socket connection when user is present but not connected', async () => {
      const mockConnect = vi.fn();
      const { useSocket } = await import('../../hooks/useSocket');
      (useSocket as any).mockReturnValue({
        connected: false,
        connectionStatus: 'disconnected',
        networkQuality: 'poor',
        connect: mockConnect.mockResolvedValue(undefined),
        quickStart: vi.fn(),
        joinRoom: vi.fn()
      });

      renderLobbyPage();
      
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('User Actions', () => {
    it('should handle logout action', async () => {
      const mockLogout = vi.fn();
      const { useUserStore } = await import('../../stores/userStore');
      (useUserStore as any).mockReturnValue({
        user: {
          id: 'user-123',
          username: 'testuser',
          chips: 5000
        },
        logout: mockLogout
      });

      renderLobbyPage();
      
      const logoutButton = screen.getByRole('button', { name: /退出登录/ });
      fireEvent.click(logoutButton);
      
      expect(mockLogout).toHaveBeenCalled();
    });

    it('should handle refresh rooms action', async () => {
      const mockRefreshRooms = vi.fn();
      const { useRoomStore } = await import('../../stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        rooms: [],
        isLoading: false,
        error: null,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        fetchRooms: vi.fn(),
        clearError: vi.fn(),
        refreshRooms: mockRefreshRooms
      });

      renderLobbyPage();
      
      const refreshButton = screen.getByRole('button', { name: /刷新/ });
      fireEvent.click(refreshButton);
      
      expect(mockRefreshRooms).toHaveBeenCalled();
    });

    it('should handle pagination changes', async () => {
      const mockFetchRooms = vi.fn();
      const { useRoomStore } = await import('../../stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        rooms: [{ id: 'room-1', owner: { username: 'test' } }],
        isLoading: false,
        error: null,
        pagination: { page: 1, limit: 10, total: 20, totalPages: 2 },
        fetchRooms: mockFetchRooms,
        clearError: vi.fn(),
        refreshRooms: vi.fn()
      });

      renderLobbyPage();
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(mockFetchRooms).toHaveBeenCalledWith(2);
    });
  });
});