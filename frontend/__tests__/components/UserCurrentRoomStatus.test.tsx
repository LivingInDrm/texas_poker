import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserCurrentRoomStatus from '../../src/components/UserCurrentRoomStatus';

// Mock the useSocket hook
const mockGetCurrentRoomStatus = vi.fn();
const mockLeaveCurrentRoom = vi.fn();

vi.mock('../../src/components/../hooks/useSocket', () => ({
  useSocket: () => ({
    getCurrentRoomStatus: mockGetCurrentRoomStatus,
    leaveCurrentRoom: mockLeaveCurrentRoom,
  }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('UserCurrentRoomStatus', () => {
  const mockOnLeaveRoom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when currentRoomId is null', () => {
    const { container } = render(
      <UserCurrentRoomStatus 
        currentRoomId={null} 
        onLeaveRoom={mockOnLeaveRoom}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders current room info when currentRoomId is provided', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-123',
      roomDetails: {
        playerCount: 3,
        isGameStarted: false,
        roomState: { status: 'waiting' }
      }
    });

    render(
      <UserCurrentRoomStatus 
        currentRoomId="room-123" 
        onLeaveRoom={mockOnLeaveRoom}
      />
    );

    expect(screen.getByText('当前房间')).toBeInTheDocument();
    expect(screen.getByText('room-123')).toBeInTheDocument();
    
    // Wait for room details to load
    await waitFor(() => {
      expect(screen.getByText('玩家数: 3')).toBeInTheDocument();
      expect(screen.getByText('等待开始')).toBeInTheDocument();
    });
  });

  it('displays game started status when game is in progress', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-456',
      roomDetails: {
        playerCount: 4,
        isGameStarted: true,
        roomState: { status: 'playing' }
      }
    });

    render(
      <UserCurrentRoomStatus 
        currentRoomId="room-456" 
        onLeaveRoom={mockOnLeaveRoom}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('游戏中')).toBeInTheDocument();
      expect(screen.getByText('玩家数: 4')).toBeInTheDocument();
    });
  });

  it('calls onLeaveRoom when leave button is clicked', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-123',
      roomDetails: {
        playerCount: 3,
        isGameStarted: false,
        roomState: { status: 'waiting' }
      }
    });

    await act(async () => {
      render(
        <UserCurrentRoomStatus 
          currentRoomId="room-123" 
          onLeaveRoom={mockOnLeaveRoom}
        />
      );
    });

    const leaveButton = screen.getByText('离开');
    
    await act(async () => {
      fireEvent.click(leaveButton);
    });

    expect(mockOnLeaveRoom).toHaveBeenCalledTimes(1);
  });

  it('calls useSocket leaveCurrentRoom when onLeaveRoom is not provided', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-123',
      roomDetails: {
        playerCount: 3,
        isGameStarted: false,
        roomState: { status: 'waiting' }
      }
    });

    mockLeaveCurrentRoom.mockResolvedValue({ success: true });

    render(
      <UserCurrentRoomStatus 
        currentRoomId="room-123" 
      />
    );

    const leaveButton = screen.getByText('离开');
    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(mockLeaveCurrentRoom).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates to room when view button is clicked', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-789',
      roomDetails: {
        playerCount: 2,
        isGameStarted: false,
        roomState: { status: 'waiting' }
      }
    });

    await act(async () => {
      render(
        <UserCurrentRoomStatus 
          currentRoomId="room-789" 
          onLeaveRoom={mockOnLeaveRoom}
        />
      );
    });

    const viewButton = screen.getByText('查看');
    
    await act(async () => {
      fireEvent.click(viewButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/game/room-789');
  });

  it('handles error when getCurrentRoomStatus fails', async () => {
    mockGetCurrentRoomStatus.mockRejectedValue(new Error('Failed to get room status'));

    render(
      <UserCurrentRoomStatus 
        currentRoomId="room-error" 
        onLeaveRoom={mockOnLeaveRoom}
      />
    );

    // Should still show the room ID even if details fail to load
    expect(screen.getByText('room-error')).toBeInTheDocument();
    
    // Should not show room details
    await waitFor(() => {
      expect(screen.queryByText('玩家数:')).not.toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockGetCurrentRoomStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <UserCurrentRoomStatus 
        currentRoomId="room-loading" 
        onLeaveRoom={mockOnLeaveRoom}
      />
    );

    expect(screen.getByText('当前房间')).toBeInTheDocument();
    expect(screen.getByText('room-loading')).toBeInTheDocument();
    // Details should not be visible yet
    expect(screen.queryByText('玩家数:')).not.toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    
    render(
      <UserCurrentRoomStatus 
        currentRoomId="room-123" 
        onLeaveRoom={mockOnLeaveRoom}
        className={customClass}
      />
    );

    const container = screen.getByTestId('user-current-room-status');
    expect(container).toHaveClass(customClass);
  });

  it('has proper accessibility attributes', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-123',
      roomDetails: {
        playerCount: 3,
        isGameStarted: false,
        roomState: { status: 'waiting' }
      }
    });

    await act(async () => {
      render(
        <UserCurrentRoomStatus 
          currentRoomId="room-123" 
          onLeaveRoom={mockOnLeaveRoom}
        />
      );
    });

    const leaveButton = screen.getByText('离开');
    const viewButton = screen.getByText('查看');

    expect(leaveButton).toHaveAttribute('type', 'button');
    expect(viewButton).toHaveAttribute('type', 'button');
  });

  it('refreshes room status when currentRoomId changes', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-123',
      roomDetails: {
        playerCount: 3,
        isGameStarted: false,
        roomState: { status: 'waiting' }
      }
    });

    let rerender: any;
    await act(async () => {
      const result = render(
        <UserCurrentRoomStatus 
          currentRoomId="room-123" 
          onLeaveRoom={mockOnLeaveRoom}
        />
      );
      rerender = result.rerender;
    });

    expect(mockGetCurrentRoomStatus).toHaveBeenCalledTimes(1);

    // Change room ID
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-456',
      roomDetails: {
        playerCount: 4,
        isGameStarted: true,
        roomState: { status: 'playing' }
      }
    });

    await act(async () => {
      rerender(
        <UserCurrentRoomStatus 
          currentRoomId="room-456" 
          onLeaveRoom={mockOnLeaveRoom}
        />
      );
    });

    expect(mockGetCurrentRoomStatus).toHaveBeenCalledTimes(2);
  });

  it('handles leave room failure gracefully', async () => {
    mockGetCurrentRoomStatus.mockResolvedValue({
      roomId: 'room-123',
      roomDetails: {
        playerCount: 3,
        isGameStarted: false,
        roomState: { status: 'waiting' }
      }
    });

    mockLeaveCurrentRoom.mockRejectedValue(new Error('Failed to leave room'));

    render(
      <UserCurrentRoomStatus 
        currentRoomId="room-123" 
      />
    );

    const leaveButton = screen.getByText('离开');
    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(mockLeaveCurrentRoom).toHaveBeenCalledTimes(1);
    });

    // Should still show the component even if leave fails
    expect(screen.getByText('当前房间')).toBeInTheDocument();
  });
});