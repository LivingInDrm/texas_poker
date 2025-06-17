import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JoinRoomModal from '../../src/components/JoinRoomModal';
import type { Room } from '../../src/services/api';

// Mock the room store
const mockJoinRoom = vi.fn();
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
    status: 'WAITING',
    bigBlind: 40,
    smallBlind: 20,
    createdAt: '2025-06-15T11:00:00.000Z'
  },
  {
    id: 'room-3',
    ownerId: 'user-3',
    owner: { id: 'user-3', username: 'player3' },
    playerLimit: 8,
    currentPlayers: 1,
    hasPassword: false,
    status: 'PLAYING',
    bigBlind: 100,
    smallBlind: 50,
    createdAt: '2025-06-15T09:15:00.000Z'
  }
];

vi.mock('../../src/stores/roomStore', () => ({
  useRoomStore: vi.fn()
}));

describe('JoinRoomModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    roomId: 'room-1',
    onJoinRoom: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset to default mock implementation
    const { useRoomStore } = await import('../../src/stores/roomStore');
    (useRoomStore as any).mockReturnValue({
      rooms: mockRooms,
      joinRoom: mockJoinRoom,
      isLoading: false
    });
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<JoinRoomModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('加入房间')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<JoinRoomModal {...defaultProps} />);
      
      expect(screen.getByRole('heading', { name: '加入房间' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '加入房间' })).toBeInTheDocument();
    });

    it('should display room information for found room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      expect(screen.getByText('player1 的房间')).toBeInTheDocument();
      expect(screen.getByText('2/6')).toBeInTheDocument();
      expect(screen.getByText('10/20')).toBeInTheDocument();
      expect(screen.getByText('等待中')).toBeInTheDocument();
      expect(screen.getByText('无密码')).toBeInTheDocument();
    });

    it('should display room not found message for non-existent room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="non-existent" />);
      
      expect(screen.getByText('房间不存在')).toBeInTheDocument();
      expect(screen.getByText('请检查房间ID是否正确')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    });

    it('should show password field for password-protected rooms', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      expect(screen.getByText('房间密码')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('请输入房间密码')).toBeInTheDocument();
      expect(screen.getByText('需要密码')).toBeInTheDocument();
    });

    it('should not show password field for non-password rooms', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      expect(screen.queryByLabelText('房间密码')).not.toBeInTheDocument();
      expect(screen.getByText('无密码')).toBeInTheDocument();
    });
  });

  describe('Room Status Display', () => {
    it('should display waiting status with green color', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      const statusText = screen.getByText('等待中');
      expect(statusText).toHaveClass('text-green-600');
    });

    it('should display playing status with blue color', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-3" />);
      
      const statusText = screen.getByText('游戏中');
      expect(statusText).toHaveClass('text-blue-600');
    });

    it('should handle ended status with gray color', async () => {
      // Create a room with ENDED status
      const endedRoom = { ...mockRooms[0], status: 'ENDED' as const };
      const roomsWithEnded = [...mockRooms, endedRoom];
      
      const { useRoomStore } = await import('../../src/stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: roomsWithEnded,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      render(<JoinRoomModal {...defaultProps} roomId={endedRoom.id} />);
      
      const statusText = screen.getByText('已结束');
      expect(statusText).toHaveClass('text-gray-600');
    });
  });

  describe('Form Interactions', () => {
    it('should update password field value', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      
      expect(passwordInput).toHaveValue('secret123');
    });

    it('should clear password field when modal opens', () => {
      const { rerender } = render(<JoinRoomModal {...defaultProps} isOpen={false} roomId="room-2" />);
      
      rerender(<JoinRoomModal {...defaultProps} isOpen={true} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      expect(passwordInput).toHaveValue('');
    });

    it('should clear error when modal opens', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      // Create an error by submitting without password
      const form = document.querySelector('form');
      fireEvent.submit(form);
      
      expect(screen.getByText('请输入房间密码')).toBeInTheDocument();
      
      // Mock modal closing and reopening
      const { rerender } = render(<JoinRoomModal {...defaultProps} isOpen={false} roomId="room-2" />);
      rerender(<JoinRoomModal {...defaultProps} isOpen={true} roomId="room-2" />);
      
      expect(screen.queryByText('请输入房间密码')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate password for password-protected rooms', async () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const form = document.querySelector('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.getByText('请输入房间密码')).toBeInTheDocument();
      });
    });

    it('should validate empty password (whitespace only)', async () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      const form = document.querySelector('form');
      
      fireEvent.change(passwordInput, { target: { value: '   ' } });
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.getByText('请输入房间密码')).toBeInTheDocument();
      });
    });

    it('should not validate password for non-password rooms', async () => {
      mockJoinRoom.mockResolvedValue({ room: mockRooms[0] });
      
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      const form = document.querySelector('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockJoinRoom).toHaveBeenCalledWith({
          roomId: 'room-1',
          password: undefined
        });
      });
    });

    it('should show error for non-existent room', async () => {
      render(<JoinRoomModal {...defaultProps} roomId="non-existent" />);
      
      expect(screen.getByText('房间不存在')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call joinRoom with correct data for password room', async () => {
      mockJoinRoom.mockResolvedValue({ room: mockRooms[1] });
      
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      const submitButton = screen.getByRole('button', { name: '加入房间' });
      
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockJoinRoom).toHaveBeenCalledWith({
          roomId: 'room-2',
          password: 'secret123'
        });
      });
    });

    it('should call joinRoom without password for non-password room', async () => {
      mockJoinRoom.mockResolvedValue({ room: mockRooms[0] });
      
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      const submitButton = screen.getByRole('button', { name: '加入房间' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockJoinRoom).toHaveBeenCalledWith({
          roomId: 'room-1',
          password: undefined
        });
      });
    });

    it('should reset form and close modal on successful join', async () => {
      const mockOnClose = vi.fn();
      mockJoinRoom.mockResolvedValue({ room: mockRooms[1] });
      
      render(<JoinRoomModal {...defaultProps} onClose={mockOnClose} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      const submitButton = screen.getByRole('button', { name: '加入房间' });
      
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      
      expect(passwordInput).toHaveValue('');
    });

    it('should trim password before submission', async () => {
      mockJoinRoom.mockResolvedValue({ room: mockRooms[1] });
      
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      const submitButton = screen.getByRole('button', { name: '加入房间' });
      
      fireEvent.change(passwordInput, { target: { value: '  secret123  ' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockJoinRoom).toHaveBeenCalledWith({
          roomId: 'room-2',
          password: 'secret123'
        });
      });
    });

    it('should handle submission errors gracefully', async () => {
      mockJoinRoom.mockRejectedValue(new Error('Wrong password'));
      
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      const submitButton = screen.getByRole('button', { name: '加入房间' });
      
      fireEvent.change(passwordInput, { target: { value: 'wrong' } });
      fireEvent.click(submitButton);
      
      // Should not crash and continue to work
      await waitFor(() => {
        expect(mockJoinRoom).toHaveBeenCalled();
      });
    });
  });

  describe('Warning Messages', () => {
    it('should show warning for full room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      expect(screen.getByText('⚠️ 房间已满，无法加入')).toBeInTheDocument();
    });

    it('should show warning for non-waiting room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-3" />);
      
      expect(screen.getByText('⚠️ 房间当前不接受新玩家')).toBeInTheDocument();
    });

    it('should not show warnings for joinable room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      expect(screen.queryByText(/⚠️/)).not.toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable join button for full room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const joinButton = screen.getByRole('button', { name: '加入房间' });
      expect(joinButton).toBeDisabled();
    });

    it('should disable join button for non-waiting room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-3" />);
      
      const joinButton = screen.getByRole('button', { name: '加入房间' });
      expect(joinButton).toBeDisabled();
    });

    it('should enable join button for available room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      const joinButton = screen.getByRole('button', { name: '加入房间' });
      expect(joinButton).not.toBeDisabled();
    });

    it('should show loading state when joining', async () => {
      const { useRoomStore } = await import('../../src/stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: mockRooms,
        joinRoom: mockJoinRoom,
        isLoading: true
      });
      
      render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      const joinButton = screen.getByRole('button', { name: '加入中...' });
      expect(joinButton).toBeDisabled();
    });
  });

  describe('Modal Controls', () => {
    it('should have close button in header', () => {
      render(<JoinRoomModal {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: '' }); // X button
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when header close button is clicked', () => {
      const mockOnClose = vi.fn();
      render(<JoinRoomModal {...defaultProps} onClose={mockOnClose} />);
      
      const closeButton = screen.getByRole('button', { name: '' });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have cancel button', () => {
      render(<JoinRoomModal {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: '取消' });
      expect(cancelButton).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', () => {
      const mockOnClose = vi.fn();
      render(<JoinRoomModal {...defaultProps} onClose={mockOnClose} />);
      
      const cancelButton = screen.getByRole('button', { name: '取消' });
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when modal is closed via cancel', () => {
      const mockOnClose = vi.fn();
      render(<JoinRoomModal {...defaultProps} onClose={mockOnClose} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      fireEvent.change(passwordInput, { target: { value: 'test123' } });
      
      const cancelButton = screen.getByRole('button', { name: '取消' });
      fireEvent.click(cancelButton);
      
      expect(passwordInput).toHaveValue('');
    });
  });

  describe('Room Not Found Flow', () => {
    it('should render room not found UI for non-existent room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="non-existent" />);
      
      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText('房间不存在')).toBeInTheDocument();
      expect(screen.getByText('请检查房间ID是否正确')).toBeInTheDocument();
    });

    it('should only show close button for non-existent room', () => {
      render(<JoinRoomModal {...defaultProps} roomId="non-existent" />);
      
      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '加入房间' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    });

    it('should call onClose when close button is clicked in not found state', () => {
      const mockOnClose = vi.fn();
      render(<JoinRoomModal {...defaultProps} onClose={mockOnClose} roomId="non-existent" />);
      
      const closeButton = screen.getByRole('button', { name: '关闭' });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      expect(screen.getByPlaceholderText('请输入房间密码')).toBeInTheDocument();
    });

    it('should have proper form structure', () => {
      render(<JoinRoomModal {...defaultProps} />);
      
      expect(document.querySelector('form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '加入房间' })).toHaveAttribute('type', 'submit');
      expect(screen.getByRole('button', { name: '取消' })).toHaveAttribute('type', 'button');
    });

    it('should have modal title', () => {
      render(<JoinRoomModal {...defaultProps} />);
      
      expect(screen.getByRole('heading', { name: '加入房间' })).toBeInTheDocument();
    });

    it('should auto-focus password input when present', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      expect(passwordInput).toHaveAttribute('autoFocus');
    });
  });

  describe('Integration with Socket', () => {
    it('should call onJoinRoom prop when provided (Socket integration)', async () => {
      const mockOnJoinRoom = vi.fn().mockResolvedValue({ success: true });
      
      render(<JoinRoomModal {...defaultProps} roomId="room-2" onJoinRoom={mockOnJoinRoom} />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      const submitButton = screen.getByRole('button', { name: '加入房间' });
      
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnJoinRoom).toHaveBeenCalledWith('room-2', 'secret123');
      });
    });

    it('should prefer socket join over store join when both available', async () => {
      const mockOnJoinRoom = vi.fn().mockResolvedValue({ success: true });
      mockJoinRoom.mockResolvedValue({ room: mockRooms[0] });
      
      render(<JoinRoomModal {...defaultProps} roomId="room-1" onJoinRoom={mockOnJoinRoom} />);
      
      const submitButton = screen.getByRole('button', { name: '加入房间' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnJoinRoom).toHaveBeenCalled();
        expect(mockJoinRoom).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle room data changes while modal is open', async () => {
      const { rerender } = render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      expect(screen.getByText('player1 的房间')).toBeInTheDocument();
      
      // Change room data
      const updatedRooms = mockRooms.map(room => 
        room.id === 'room-1' 
          ? { ...room, owner: { ...room.owner, username: 'updated_player' } }
          : room
      );
      
      const { useRoomStore } = await import('../../src/stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: updatedRooms,
        joinRoom: mockJoinRoom,
        isLoading: false
      });
      
      rerender(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      expect(screen.getByText('updated_player 的房间')).toBeInTheDocument();
    });

    it('should handle room disappearing while modal is open', async () => {
      const { rerender } = render(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      expect(screen.getByText('player1 的房间')).toBeInTheDocument();
      
      // Remove room
      const { useRoomStore } = await import('../../src/stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: mockRooms.filter(room => room.id !== 'room-1'),
        joinRoom: mockJoinRoom,
        isLoading: false
      });
      
      rerender(<JoinRoomModal {...defaultProps} roomId="room-1" />);
      
      expect(screen.getByText('房间不存在')).toBeInTheDocument();
    });

    it('should handle extremely long passwords', () => {
      render(<JoinRoomModal {...defaultProps} roomId="room-2" />);
      
      const passwordInput = screen.getByPlaceholderText('请输入房间密码');
      const longPassword = 'a'.repeat(1000);
      
      fireEvent.change(passwordInput, { target: { value: longPassword } });
      
      expect(passwordInput).toHaveValue(longPassword);
    });
  });
});