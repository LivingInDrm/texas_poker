import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoomList from '../RoomList';
import type { Room } from '../../services/api';

describe('RoomList', () => {
  const mockRooms: Room[] = [
    {
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
    },
    {
      id: 'room-2',
      ownerId: 'user-2',
      owner: { id: 'user-2', username: 'player2' },
      playerLimit: 4,
      currentPlayers: 4,
      hasPassword: true,
      status: 'PLAYING',
      bigBlind: 40,
      smallBlind: 20,
      createdAt: '2025-06-15T11:30:00.000Z'
    },
    {
      id: 'room-3',
      ownerId: 'user-3',
      owner: { id: 'user-3', username: 'player3' },
      playerLimit: 8,
      currentPlayers: 1,
      hasPassword: false,
      status: 'ENDED',
      bigBlind: 100,
      smallBlind: 50,
      createdAt: '2025-06-15T09:15:00.000Z'
    }
  ];

  const mockPagination = {
    page: 1,
    limit: 10,
    total: 3,
    totalPages: 1
  };

  const defaultProps = {
    rooms: mockRooms,
    isLoading: false,
    onJoinRoom: vi.fn(),
    pagination: mockPagination,
    onPageChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Room Display', () => {
    it('should render all rooms correctly', () => {
      render(<RoomList {...defaultProps} />);

      expect(screen.getByText('player1 的房间')).toBeInTheDocument();
      expect(screen.getByText('player2 的房间')).toBeInTheDocument();
      expect(screen.getByText('player3 的房间')).toBeInTheDocument();
    });

    it('should display room basic information', () => {
      render(<RoomList {...defaultProps} />);

      // Player count
      expect(screen.getByText('2/6')).toBeInTheDocument();
      expect(screen.getByText('4/4')).toBeInTheDocument();
      expect(screen.getByText('1/8')).toBeInTheDocument();

      // Blinds
      expect(screen.getByText('10/20')).toBeInTheDocument();
      expect(screen.getByText('20/40')).toBeInTheDocument();
      expect(screen.getByText('50/100')).toBeInTheDocument();
    });

    it('should display room status with correct colors', () => {
      render(<RoomList {...defaultProps} />);

      const waitingStatus = screen.getAllByText('等待中')[0];
      const playingStatus = screen.getAllByText('游戏中')[0];
      const endedStatus = screen.getAllByText('已结束')[0];

      expect(waitingStatus).toHaveClass('bg-green-100', 'text-green-800');
      expect(playingStatus).toHaveClass('bg-blue-100', 'text-blue-800');
      expect(endedStatus).toHaveClass('bg-gray-100', 'text-gray-800');
    });

    it('should display password indicator for password-protected rooms', () => {
      render(<RoomList {...defaultProps} />);

      // Look for the SVG password lock icon
      const passwordIcons = document.querySelectorAll('svg.w-4.h-4.text-yellow-400');
      // Room-2 has password, so there should be 1 password icon
      expect(passwordIcons).toHaveLength(1);
    });

    it('should format creation time correctly', () => {
      render(<RoomList {...defaultProps} />);

      // Check if time is formatted in Chinese locale (actual format shows 18:00 due to timezone)
      expect(screen.getByText('06/15 18:00')).toBeInTheDocument();
      expect(screen.getByText('06/15 19:30')).toBeInTheDocument();
      expect(screen.getByText('06/15 17:15')).toBeInTheDocument();
    });

    it('should display room ID (last 8 characters)', () => {
      render(<RoomList {...defaultProps} />);

      // For IDs shorter than 8 characters, the full ID is shown
      expect(screen.getByText('room-1')).toBeInTheDocument();
      expect(screen.getByText('room-2')).toBeInTheDocument();
      expect(screen.getByText('room-3')).toBeInTheDocument();
    });
  });

  describe('Join Room Functionality', () => {
    it('should enable join button for available rooms', () => {
      render(<RoomList {...defaultProps} />);

      const joinButtons = screen.getAllByText('加入房间');
      expect(joinButtons).toHaveLength(1); // Only room-1 should be joinable

      const firstJoinButton = joinButtons[0];
      expect(firstJoinButton).not.toBeDisabled();
      expect(firstJoinButton).toHaveClass('bg-blue-600');
    });

    it('should disable join button for full rooms', () => {
      render(<RoomList {...defaultProps} />);

      const fullRoomButton = screen.getByText('房间已满');
      expect(fullRoomButton).toBeDisabled();
      expect(fullRoomButton).toHaveClass('bg-gray-400');
    });

    it('should disable join button for non-waiting rooms', () => {
      render(<RoomList {...defaultProps} />);

      // Look for the button that shows "游戏中" as its text content (not a status badge)
      const playingRoomButton = screen.getByRole('button', { name: '游戏中' });
      expect(playingRoomButton).toBeDisabled();
      expect(playingRoomButton).toHaveClass('bg-gray-400');
    });

    it('should call onJoinRoom when join button is clicked', () => {
      const mockOnJoinRoom = vi.fn();
      render(<RoomList {...defaultProps} onJoinRoom={mockOnJoinRoom} />);

      const joinButton = screen.getByText('加入房间');
      fireEvent.click(joinButton);

      expect(mockOnJoinRoom).toHaveBeenCalledWith('room-1', false);
    });

    it('should call onJoinRoom with password flag for password rooms', () => {
      // Create a waiting room with password for testing
      const roomsWithPasswordWaiting = [
        {
          ...mockRooms[1],
          status: 'WAITING' as const,
          currentPlayers: 2
        }
      ];

      const mockOnJoinRoom = vi.fn();
      render(
        <RoomList 
          {...defaultProps} 
          rooms={roomsWithPasswordWaiting}
          onJoinRoom={mockOnJoinRoom} 
        />
      );

      const joinButton = screen.getByText('加入房间');
      fireEvent.click(joinButton);

      expect(mockOnJoinRoom).toHaveBeenCalledWith('room-2', true);
    });
  });

  describe('Pagination', () => {
    it('should render pagination when multiple pages exist', () => {
      const multiPagePagination = {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };

      render(<RoomList {...defaultProps} pagination={multiPagePagination} />);

      expect(screen.getByText('上一页')).toBeInTheDocument();
      expect(screen.getByText('下一页')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should not render pagination when only one page exists', () => {
      render(<RoomList {...defaultProps} />);

      expect(screen.queryByText('上一页')).not.toBeInTheDocument();
      expect(screen.queryByText('下一页')).not.toBeInTheDocument();
    });

    it('should highlight current page', () => {
      const multiPagePagination = {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };

      render(<RoomList {...defaultProps} pagination={multiPagePagination} />);

      const currentPageButton = screen.getByRole('button', { name: '2' });
      expect(currentPageButton).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should disable previous button on first page', () => {
      const firstPagePagination = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3
      };

      render(<RoomList {...defaultProps} pagination={firstPagePagination} />);

      const prevButton = screen.getByText('上一页');
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      const lastPagePagination = {
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3
      };

      render(<RoomList {...defaultProps} pagination={lastPagePagination} />);

      const nextButton = screen.getByText('下一页');
      expect(nextButton).toBeDisabled();
    });

    it('should call onPageChange when pagination buttons are clicked', () => {
      const mockOnPageChange = vi.fn();
      const multiPagePagination = {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3
      };

      render(
        <RoomList 
          {...defaultProps} 
          pagination={multiPagePagination}
          onPageChange={mockOnPageChange} 
        />
      );

      // Click previous page
      fireEvent.click(screen.getByText('上一页'));
      expect(mockOnPageChange).toHaveBeenCalledWith(1);

      // Click next page
      fireEvent.click(screen.getByText('下一页'));
      expect(mockOnPageChange).toHaveBeenCalledWith(3);

      // Click specific page
      fireEvent.click(screen.getByRole('button', { name: '1' }));
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner when loading and no rooms', () => {
      render(<RoomList {...defaultProps} rooms={[]} isLoading={true} />);

      expect(screen.getByText('加载房间列表中...')).toBeInTheDocument();
      // Check for loading spinner div with animate-spin class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading overlay when loading with existing rooms', () => {
      render(<RoomList {...defaultProps} isLoading={true} />);

      expect(screen.getByText('更新中...')).toBeInTheDocument();
      // Should still show existing rooms
      expect(screen.getByText('player1 的房间')).toBeInTheDocument();
    });

    it('should show empty state when no rooms and not loading', () => {
      render(<RoomList {...defaultProps} rooms={[]} isLoading={false} />);

      expect(screen.getByText('🃏')).toBeInTheDocument();
      expect(screen.getByText('暂无房间')).toBeInTheDocument();
      expect(screen.getByText('目前没有可用的房间，要不要创建一个新房间？')).toBeInTheDocument();
    });
  });

  describe('Room Card Interactions', () => {
    it('should have hover effects on room cards', () => {
      render(<RoomList {...defaultProps} />);

      const roomCards = document.querySelectorAll('.bg-white\\/20');

      roomCards.forEach(card => {
        expect(card).toHaveClass('hover:bg-white/30');
      });
    });

    it('should display room information in grid layout', () => {
      render(<RoomList {...defaultProps} />);

      // Check grid layout classes exist
      const infoGrids = document.querySelectorAll('.grid.grid-cols-2.md\\:grid-cols-4');
      expect(infoGrids).toHaveLength(3); // One for each room
    });
  });

  describe('Responsive Design', () => {
    it('should use responsive grid classes', () => {
      render(<RoomList {...defaultProps} />);

      const infoSection = screen.getByText('2/6').closest('.grid');
      expect(infoSection).toHaveClass('grid-cols-2', 'md:grid-cols-4');
    });

    it('should stack room information appropriately on mobile', () => {
      render(<RoomList {...defaultProps} />);

      // Verify responsive text sizes and layouts
      const roomTitles = screen.getAllByText(/的房间/);
      roomTitles.forEach(title => {
        expect(title.closest('.flex-1')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rooms with missing owner data gracefully', () => {
      const roomsWithMissingData = [
        {
          ...mockRooms[0],
          owner: { id: 'user-1', username: '' }
        }
      ];

      render(<RoomList {...defaultProps} rooms={roomsWithMissingData} />);

      // Look for the text content that includes the empty username
      const elements = screen.getAllByText((content, element) => {
        return element?.textContent === ' 的房间';
      });
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should handle very long usernames', () => {
      const roomsWithLongUsernames = [
        {
          ...mockRooms[0],
          owner: { 
            id: 'user-1', 
            username: 'VeryLongUsernameThatshouldBeHandledGracefully' 
          }
        }
      ];

      render(<RoomList {...defaultProps} rooms={roomsWithLongUsernames} />);

      expect(screen.getByText('VeryLongUsernameThatshouldBeHandledGracefully 的房间')).toBeInTheDocument();
    });

    it('should handle extreme pagination numbers', () => {
      const extremePagination = {
        page: 999,
        limit: 10,
        total: 9999,
        totalPages: 1000
      };

      render(<RoomList {...defaultProps} pagination={extremePagination} />);

      // Should render without errors
      expect(screen.getByText('上一页')).toBeInTheDocument();
      expect(screen.getByText('下一页')).toBeInTheDocument();
    });

    it('should handle zero players in room', () => {
      const roomsWithZeroPlayers = [
        {
          ...mockRooms[0],
          currentPlayers: 0
        }
      ];

      render(<RoomList {...defaultProps} rooms={roomsWithZeroPlayers} />);

      expect(screen.getByText('0/6')).toBeInTheDocument();
    });

    it('should handle rooms at exact capacity', () => {
      const roomsAtCapacity = [
        {
          ...mockRooms[0],
          currentPlayers: 6,
          playerLimit: 6
        }
      ];

      render(<RoomList {...defaultProps} rooms={roomsAtCapacity} />);

      expect(screen.getByText('6/6')).toBeInTheDocument();
      expect(screen.getByText('房间已满')).toBeInTheDocument();
    });
  });

  describe('Status Text and Colors', () => {
    it('should return correct status text for all statuses', () => {
      render(<RoomList {...defaultProps} />);

      expect(screen.getAllByText('等待中')[0]).toBeInTheDocument();
      expect(screen.getAllByText('游戏中')[0]).toBeInTheDocument();
      expect(screen.getAllByText('已结束')[0]).toBeInTheDocument();
    });

    it('should handle unknown status gracefully', () => {
      const roomsWithUnknownStatus = [
        {
          ...mockRooms[0],
          status: 'UNKNOWN' as any
        }
      ];

      render(<RoomList {...defaultProps} rooms={roomsWithUnknownStatus} />);

      expect(screen.getByText('未知')).toBeInTheDocument();
    });

    it('should apply correct color classes for all statuses', () => {
      render(<RoomList {...defaultProps} />);

      const waitingBadges = screen.getAllByText('等待中');
      const playingBadges = screen.getAllByText('游戏中');
      const endedBadges = screen.getAllByText('已结束');

      // Find the status badge (not button text)
      const waitingBadge = waitingBadges.find(el => el.classList.contains('bg-green-100'));
      const playingBadge = playingBadges.find(el => el.classList.contains('bg-blue-100'));
      const endedBadge = endedBadges.find(el => el.classList.contains('bg-gray-100'));

      expect(waitingBadge).toHaveClass('bg-green-100', 'text-green-800');
      expect(playingBadge).toHaveClass('bg-blue-100', 'text-blue-800');
      expect(endedBadge).toHaveClass('bg-gray-100', 'text-gray-800');
    });
  });

  describe('Performance', () => {
    it('should render large number of rooms efficiently', () => {
      const manyRooms = Array.from({ length: 100 }, (_, i) => ({
        ...mockRooms[0],
        id: `room-${i}`,
        owner: { id: `user-${i}`, username: `player${i}` }
      }));

      const startTime = performance.now();
      render(<RoomList {...defaultProps} rooms={manyRooms} />);
      const endTime = performance.now();

      // Should render within reasonable time (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});