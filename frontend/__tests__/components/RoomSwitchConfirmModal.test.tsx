import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoomSwitchConfirmModal from '../../src/components/RoomSwitchConfirmModal';

// Mock the modal portal
vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (element: React.ReactNode) => element,
}));

describe('RoomSwitchConfirmModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    currentRoomId: 'room-123',
    targetRoomId: 'room-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    expect(screen.getByText('切换房间确认')).toBeInTheDocument();
    expect(screen.getByText('当前房间:')).toBeInTheDocument();
    expect(screen.getByText('room-123')).toBeInTheDocument();
    expect(screen.getByText('目标房间:')).toBeInTheDocument();
    expect(screen.getByText('room-456')).toBeInTheDocument();
    expect(screen.getByText('继续')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('切换房间确认')).not.toBeInTheDocument();
  });

  it('displays room details when provided', () => {
    const propsWithDetails = {
      ...defaultProps,
      currentRoomDetails: {
        playerCount: 3,
        isGameStarted: true,
      },
    };

    render(<RoomSwitchConfirmModal {...propsWithDetails} />);
    
    expect(screen.getByText('当前房间玩家数:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('游戏进行中')).toBeInTheDocument();
  });

  it('displays different text for ongoing vs waiting game', () => {
    const propsWithWaiting = {
      ...defaultProps,
      currentRoomDetails: {
        playerCount: 2,
        isGameStarted: false,
      },
    };

    render(<RoomSwitchConfirmModal {...propsWithWaiting} />);
    
    expect(screen.getByText('当前房间玩家数:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('等待游戏开始')).toBeInTheDocument();
  });

  it('shows warning message for ongoing game', () => {
    const propsWithOngoingGame = {
      ...defaultProps,
      currentRoomDetails: {
        playerCount: 4,
        isGameStarted: true,
      },
    };

    render(<RoomSwitchConfirmModal {...propsWithOngoingGame} />);
    
    expect(screen.getByText('⚠️ 注意：您当前在游戏中，离开将导致自动弃牌')).toBeInTheDocument();
  });

  it('calls onConfirm when continue button is clicked', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    const continueButton = screen.getByText('继续');
    fireEvent.click(continueButton);
    
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the modal', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking on modal content', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    const modalContent = screen.getByTestId('modal-content');
    fireEvent.click(modalContent);
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('handles ESC key press', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('properly handles room IDs with long names', () => {
    const propsWithLongIds = {
      ...defaultProps,
      currentRoomId: 'this-is-a-very-long-room-id-that-might-overflow',
      targetRoomId: 'another-very-long-room-id-for-testing',
    };

    render(<RoomSwitchConfirmModal {...propsWithLongIds} />);
    
    expect(screen.getByText('当前房间: this-is-a-very-long-room-id-that-might-overflow')).toBeInTheDocument();
    expect(screen.getByText('目标房间: another-very-long-room-id-for-testing')).toBeInTheDocument();
  });

  it('displays correct button styles', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    const continueButton = screen.getByText('继续');
    const cancelButton = screen.getByText('取消');
    
    expect(continueButton).toHaveClass('bg-green-600');
    expect(cancelButton).toHaveClass('bg-gray-600');
  });

  it('has proper accessibility attributes', () => {
    render(<RoomSwitchConfirmModal {...defaultProps} />);
    
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    
    const title = screen.getByText('切换房间确认');
    expect(title).toBeInTheDocument();
  });
});