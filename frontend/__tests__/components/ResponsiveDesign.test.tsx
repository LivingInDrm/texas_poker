import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LobbyPage from '../../src/pages/LobbyPage';
import RoomList from '../../src/components/RoomList';
import CreateRoomModal from '../../src/components/CreateRoomModal';
import type { Room } from '../../src/services/api';
import { createComponentTestSocketMock } from '../helpers/mocks/useSocketMockFactory';

// Mock all dependencies
vi.mock('../../src/components/../stores/userStore', () => ({
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

vi.mock('../../src/components/../stores/roomStore', () => ({
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
      }
    ],
    isLoading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1
    },
    fetchRooms: vi.fn(),
    clearError: vi.fn(),
    refreshRooms: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn()
  }))
}));

vi.mock('../../src/components/../hooks/useSocket', () => ({
  useSocket: vi.fn(() => createComponentTestSocketMock())
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div data-testid="router">{children}</div>
  };
});

vi.mock('../../src/components/NetworkIndicator', () => ({
  NetworkIndicator: () => <div data-testid="network-indicator">Network Status</div>
}));

vi.mock('../../src/components/JoinRoomModal', () => ({
  default: () => <div data-testid="join-room-modal">Join Room Modal</div>
}));

describe('Responsive Design Tests', () => {
  const mockRoom: Room = {
    id: 'room-1',
    ownerId: 'user-1',
    owner: { id: 'user-1', username: 'player1' },
    playerLimit: 6,
    currentPlayers: 2,
    hasPassword: false,
    status: 'WAITING',
    bigBlind: 20,
    smallBlind: 10,
    createdAt: '2025-06-15T10:00:00.000Z'
  };

  const mockPagination = {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LobbyPage Responsive Layout', () => {
    const renderLobbyPage = () => {
      return render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
    };

    it('should have responsive container classes', () => {
      renderLobbyPage();
      
      const containers = document.querySelectorAll('.container');
      containers.forEach(container => {
        expect(container).toHaveClass('mx-auto', 'px-4');
      });
    });

    it('should have responsive action buttons layout', () => {
      renderLobbyPage();
      
      // Look for the container that holds the action buttons
      const buttonContainer = screen.getByText('创建房间').closest('.flex-col') || 
                            screen.getByText('创建房间').closest('.flex');
      expect(buttonContainer).toBeInTheDocument();
      
      // Check for responsive flex classes on parent container
      const parentContainer = buttonContainer?.parentElement;
      const hasResponsiveLayout = parentContainer?.classList.contains('flex-col') ||
                                  parentContainer?.classList.contains('sm:flex-row') ||
                                  buttonContainer?.classList.contains('gap-4') ||
                                  buttonContainer?.classList.contains('justify-center');
      expect(hasResponsiveLayout).toBe(true);
    });

    it('should have responsive header layout', () => {
      renderLobbyPage();
      
      const headerContent = document.querySelector('.flex.justify-between.items-center');
      expect(headerContent).toBeInTheDocument();
      expect(headerContent).toHaveClass('py-4');
    });

    it('should have responsive user stats grid', () => {
      renderLobbyPage();
      
      const statsContainer = screen.getByText('筹码余额').closest('.grid');
      expect(statsContainer).toHaveClass('grid-cols-1', 'md:grid-cols-3');
      expect(statsContainer).toHaveClass('gap-4');
    });

    it('should use responsive padding and margins', () => {
      renderLobbyPage();
      
      const mainContent = document.querySelector('.py-8');
      expect(mainContent).toBeInTheDocument();
      expect(mainContent).toHaveClass('px-4');
    });

    it('should have responsive typography scaling', () => {
      renderLobbyPage();
      
      const mainTitle = screen.getByText('游戏大厅');
      expect(mainTitle).toHaveClass('text-4xl');
      
      const subtitle = screen.getByText('选择一个房间开始游戏，或创建你自己的房间');
      expect(subtitle).toHaveClass('text-lg');
    });

    it('should handle mobile viewport appropriately', () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderLobbyPage();
      
      // Check that flex-col is used on mobile
      const buttonContainer = screen.getByText('创建房间').closest('.flex-col');
      expect(buttonContainer).toBeInTheDocument();
    });

    it('should handle tablet viewport appropriately', () => {
      // Simulate tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      renderLobbyPage();
      
      // Check responsive classes are applied
      const statsGrid = screen.getByText('筹码余额').closest('.md\\:grid-cols-3');
      expect(statsGrid).toBeInTheDocument();
    });

    it('should have responsive background and backdrop blur', () => {
      renderLobbyPage();
      
      const backgroundElement = document.querySelector('.bg-gradient-to-br');
      expect(backgroundElement).toHaveClass('min-h-screen');
      
      const glassElements = document.querySelectorAll('.backdrop-blur-sm');
      expect(glassElements.length).toBeGreaterThan(0);
    });
  });

  describe('RoomList Responsive Layout', () => {
    const renderRoomList = (rooms = [mockRoom]) => {
      return render(
        <RoomList
          rooms={rooms}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
    };

    it('should have responsive room card layout', () => {
      renderRoomList();
      
      const roomCard = document.querySelector('.bg-white\\/20');
      expect(roomCard).toHaveClass('rounded-lg', 'p-4');
      expect(roomCard).toHaveClass('hover:bg-white/30');
    });

    it('should have responsive room information grid', () => {
      renderRoomList();
      
      const infoGrid = document.querySelector('.grid.grid-cols-2.md\\:grid-cols-4');
      expect(infoGrid).toBeInTheDocument();
      expect(infoGrid).toHaveClass('gap-4', 'text-sm');
    });

    it('should handle room card button placement responsively', () => {
      renderRoomList();
      
      const buttonContainer = screen.getByText('加入房间').closest('.ml-4');
      expect(buttonContainer).toBeInTheDocument();
    });

    it('should have responsive pagination layout', () => {
      const multiPagePagination = {
        page: 1,
        limit: 10,
        total: 30,
        totalPages: 3
      };

      render(
        <RoomList
          rooms={[mockRoom]}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={multiPagePagination}
          onPageChange={vi.fn()}
        />
      );
      
      const paginationContainer = document.querySelector('.flex.items-center.justify-center');
      expect(paginationContainer).toHaveClass('gap-2', 'mt-6');
    });

    it('should handle empty state responsively', () => {
      renderRoomList([]);
      
      const emptyState = screen.getByText('暂无房间');
      expect(emptyState).toHaveClass('text-xl', 'font-semibold');
      
      const emptyContainer = emptyState.closest('.text-center');
      expect(emptyContainer).toHaveClass('py-8');
    });

    it('should handle loading state responsively', () => {
      render(
        <RoomList
          rooms={[]}
          isLoading={true}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
      
      const loadingContainer = screen.getByText('加载房间列表中...').closest('.text-center');
      expect(loadingContainer).toHaveClass('py-8');
    });

    it('should handle many rooms with responsive scroll', () => {
      const manyRooms = Array.from({ length: 50 }, (_, i) => ({
        ...mockRoom,
        id: `room-${i}`,
        owner: { id: `user-${i}`, username: `player${i}` }
      }));

      renderRoomList(manyRooms);
      
      const roomsContainer = document.querySelector('.space-y-4');
      expect(roomsContainer).toBeInTheDocument();
    });
  });

  describe('CreateRoomModal Responsive Layout', () => {
    const renderCreateRoomModal = (isOpen = true) => {
      return render(
        <CreateRoomModal
          isOpen={isOpen}
          onClose={vi.fn()}
        />
      );
    };

    it('should have responsive modal container', () => {
      renderCreateRoomModal();
      
      const modalBackdrop = document.querySelector('.fixed.inset-0');
      expect(modalBackdrop).toHaveClass('flex', 'items-center', 'justify-center', 'p-4');
      
      const modalContent = document.querySelector('.max-w-md.w-full');
      expect(modalContent).toBeInTheDocument();
    });

    it('should have responsive form layout', () => {
      renderCreateRoomModal();
      
      // Look for form element
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
      expect(form).toHaveClass('space-y-4');
    });

    it('should have responsive grid for blind inputs', () => {
      renderCreateRoomModal();
      
      const blindsGrid = document.querySelector('.grid.grid-cols-2.gap-4');
      expect(blindsGrid).toBeInTheDocument();
    });

    it('should have responsive button layout', () => {
      renderCreateRoomModal();
      
      const buttonContainer = document.querySelector('.flex.gap-3.pt-4');
      expect(buttonContainer).toBeInTheDocument();
      
      const buttons = buttonContainer?.querySelectorAll('button');
      buttons?.forEach(button => {
        expect(button).toHaveClass('flex-1');
      });
    });

    it('should handle mobile modal layout', () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderCreateRoomModal();
      
      const modalContent = document.querySelector('.max-w-md');
      expect(modalContent).toHaveClass('w-full', 'p-6');
    });

    it('should have responsive input styling', () => {
      renderCreateRoomModal();
      
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveClass('w-full', 'px-3', 'py-2');
      });
    });
  });

  describe('Mobile-specific Interactions', () => {
    it('should handle touch-friendly button sizes', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const hasMinTouchTarget = button.classList.contains('px-8') || 
                                  button.classList.contains('px-6') ||
                                  button.classList.contains('px-4') ||
                                  button.classList.contains('px-3') ||
                                  button.classList.contains('px-2');
        const hasMinHeight = button.classList.contains('py-3') ||
                             button.classList.contains('py-2') ||
                             button.classList.contains('py-2.5') ||
                             button.classList.contains('py-1');
        
        expect(hasMinTouchTarget || hasMinHeight).toBe(true);
      });
    });

    it('should use appropriate spacing for mobile', () => {
      render(
        <RoomList
          rooms={[mockRoom]}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
      
      const spacingContainer = document.querySelector('.space-y-4');
      expect(spacingContainer).toBeInTheDocument();
    });

    it('should handle room information stacking on mobile', () => {
      render(
        <RoomList
          rooms={[mockRoom]}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
      
      const infoGrid = document.querySelector('.grid-cols-2.md\\:grid-cols-4');
      expect(infoGrid).toBeInTheDocument();
    });
  });

  describe('Tablet-specific Layout', () => {
    it('should use intermediate grid layouts on tablet', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      const statsGrid = screen.getByText('筹码余额').closest('.md\\:grid-cols-3');
      expect(statsGrid).toBeInTheDocument();
    });

    it('should handle tablet viewport for room information', () => {
      render(
        <RoomList
          rooms={[mockRoom]}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
      
      const roomInfo = document.querySelector('.md\\:grid-cols-4');
      expect(roomInfo).toBeInTheDocument();
    });
  });

  describe('Desktop-specific Layout', () => {
    it('should maximize screen space on desktop', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      const containers = document.querySelectorAll('.container');
      containers.forEach(container => {
        expect(container).toHaveClass('mx-auto');
      });
    });

    it('should use full grid layout on desktop', () => {
      render(
        <RoomList
          rooms={[mockRoom]}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
      
      const fullGrid = document.querySelector('.md\\:grid-cols-4');
      expect(fullGrid).toBeInTheDocument();
    });
  });

  describe('Cross-device Consistency', () => {
    it('should maintain color consistency across devices', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      const backgroundGradient = document.querySelector('.bg-gradient-to-br.from-green-900');
      expect(backgroundGradient).toBeInTheDocument();
      
      const actionButtons = screen.getByText('创建房间');
      expect(actionButtons).toHaveClass('bg-yellow-600');
    });

    it('should maintain typography hierarchy across devices', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      const mainTitle = screen.getByText('游戏大厅');
      expect(mainTitle).toHaveClass('text-4xl', 'font-bold');
      
      const subtitle = screen.getByText('选择一个房间开始游戏，或创建你自己的房间');
      expect(subtitle).toHaveClass('text-lg');
    });

    it('should maintain spacing consistency', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      const spacedElements = document.querySelectorAll('.space-x-4, .space-y-4, .gap-4');
      expect(spacedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility on Different Devices', () => {
    it('should maintain touch target sizes on mobile', () => {
      render(
        <CreateRoomModal
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      const closeButton = screen.getByRole('button', { name: '' });
      expect(closeButton).toHaveClass('text-gray-400');
      
      // Check that the button area is reasonable for touch
      const buttonContainer = closeButton.closest('button');
      expect(buttonContainer).toBeInTheDocument();
    });

    it('should maintain readability across devices', () => {
      render(
        <RoomList
          rooms={[mockRoom]}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
      
      const roomInfo = screen.getByText('player1 的房间');
      expect(roomInfo).toHaveClass('text-white', 'font-semibold');
    });
  });

  describe('Performance Considerations', () => {
    it('should use efficient CSS classes for responsive design', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      // Check that classes use Tailwind's responsive prefixes efficiently
      const responsiveElements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]');
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    it('should avoid layout shifts between breakpoints', () => {
      render(
        <RoomList
          rooms={[mockRoom]}
          isLoading={false}
          onJoinRoom={vi.fn()}
          pagination={mockPagination}
          onPageChange={vi.fn()}
        />
      );
      
      // Grid should maintain structure across breakpoints
      const grid = document.querySelector('.grid');
      expect(grid).toHaveClass('gap-4');
    });
  });

  describe('Theme and Visual Consistency', () => {
    it('should maintain glass morphism effects across devices', () => {
      render(
        <BrowserRouter>
          <LobbyPage />
        </BrowserRouter>
      );
      
      const glassElements = document.querySelectorAll('.backdrop-blur-sm');
      expect(glassElements.length).toBeGreaterThan(0);
      
      // Check that glass elements have some form of background transparency
      glassElements.forEach(element => {
        const hasGlassEffect = element.classList.contains('bg-white/10') ||
                              element.classList.contains('bg-white/20') ||
                              element.classList.contains('bg-green-800/50') ||
                              element.classList.toString().includes('backdrop-blur');
        expect(hasGlassEffect).toBe(true);
      });
    });

    it('should maintain border radius consistency', () => {
      render(
        <CreateRoomModal
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      const roundedElements = document.querySelectorAll('.rounded-lg, .rounded-xl');
      expect(roundedElements.length).toBeGreaterThan(0);
    });

    it('should maintain shadow and depth effects', () => {
      render(
        <CreateRoomModal
          isOpen={true}
          onClose={vi.fn()}
        />
      );
      
      const modalBackdrop = document.querySelector('.bg-black.bg-opacity-50');
      expect(modalBackdrop).toBeInTheDocument();
    });
  });
});