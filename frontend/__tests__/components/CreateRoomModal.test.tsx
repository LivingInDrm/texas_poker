import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateRoomModal from '../../src/components/CreateRoomModal';

// Mock the room store
const mockCreateRoom = vi.fn();

vi.mock('../../src/stores/roomStore', () => ({
  useRoomStore: vi.fn()
}));

describe('CreateRoomModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset to default mock implementation
    const { useRoomStore } = await import('../../src/stores/roomStore');
    (useRoomStore as any).mockReturnValue({
      createRoom: mockCreateRoom,
      isLoading: false
    });
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<CreateRoomModal isOpen={false} onClose={vi.fn()} />);
      
      expect(screen.queryByText('创建房间')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      expect(screen.getByRole('heading', { name: '创建房间' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '创建房间' })).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      expect(screen.getByText('玩家数量')).toBeInTheDocument();
      expect(screen.getByText('小盲注')).toBeInTheDocument();
      expect(screen.getByText('大盲注')).toBeInTheDocument();
      expect(screen.getByText('房间密码 (可选)')).toBeInTheDocument();
      
      // Check for form controls
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // Player limit select
      expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // Small blind input
      expect(screen.getByDisplayValue('20')).toBeInTheDocument(); // Big blind input
      expect(screen.getByPlaceholderText('留空表示无密码')).toBeInTheDocument(); // Password input
    });

    it('should render room settings preview', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      expect(screen.getByText('房间设置预览')).toBeInTheDocument();
      expect(screen.getByText('• 最多 6 名玩家')).toBeInTheDocument();
      expect(screen.getByText('• 盲注: 10/20')).toBeInTheDocument();
      expect(screen.getByText('• 无密码')).toBeInTheDocument();
    });

    it('should have default form values', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const playerLimitSelect = screen.getByDisplayValue('6 人');
      const smallBlindInput = screen.getByDisplayValue('10');
      const bigBlindInput = screen.getByDisplayValue('20');
      const passwordInput = screen.getByPlaceholderText('留空表示无密码');

      expect(playerLimitSelect).toBeInTheDocument();
      expect(smallBlindInput).toBeInTheDocument();
      expect(bigBlindInput).toBeInTheDocument();
      expect(passwordInput).toHaveValue('');
    });
  });

  describe('Form Interactions', () => {
    it('should update player limit when changed', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const playerLimitSelect = screen.getByRole('combobox');
      fireEvent.change(playerLimitSelect, { target: { value: '4' } });
      
      expect(screen.getByText('• 最多 4 名玩家')).toBeInTheDocument();
    });

    it('should render all player limit options (2-9)', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const playerLimitSelect = screen.getByRole('combobox');
      const options = playerLimitSelect.querySelectorAll('option');
      
      expect(options).toHaveLength(8); // 2-9 players
      expect(options[0]).toHaveTextContent('2 人');
      expect(options[7]).toHaveTextContent('9 人');
    });

    it('should update blind values when changed', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const smallBlindInput = screen.getByDisplayValue('10');
      const bigBlindInput = screen.getByDisplayValue('20');
      
      fireEvent.change(smallBlindInput, { target: { value: '25' } });
      fireEvent.change(bigBlindInput, { target: { value: '50' } });
      
      expect(screen.getByText('• 盲注: 25/50')).toBeInTheDocument();
    });

    it('should update password status in preview', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const passwordInput = screen.getByPlaceholderText('留空表示无密码');
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      
      expect(screen.getByText('• 需要密码')).toBeInTheDocument();
    });

    it('should handle invalid number inputs gracefully', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const smallBlindInput = screen.getByDisplayValue('10');
      const bigBlindInput = screen.getByDisplayValue('20');
      
      fireEvent.change(smallBlindInput, { target: { value: '' } });
      fireEvent.change(bigBlindInput, { target: { value: 'invalid' } });
      
      // Should fall back to default values
      expect(screen.getByText('• 盲注: 10/20')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should only allow valid player limit values in select', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const playerLimitSelect = screen.getByRole('combobox');
      const options = playerLimitSelect.querySelectorAll('option');
      
      // Should have options for 2-9 players
      expect(options).toHaveLength(8); // 2, 3, 4, 5, 6, 7, 8, 9
      expect(options[0]).toHaveValue('2');
      expect(options[7]).toHaveValue('9');
    });

    it('should have default player limit of 6', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const playerLimitSelect = screen.getByRole('combobox');
      expect(playerLimitSelect).toHaveValue('6');
    });

    it('should validate blind amounts (big blind <= small blind)', async () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const smallBlindInput = screen.getAllByRole('spinbutton')[0];
      const bigBlindInput = screen.getAllByRole('spinbutton')[1];
      const form = document.querySelector('form');
      
      fireEvent.change(smallBlindInput, { target: { value: '50' } });
      fireEvent.change(bigBlindInput, { target: { value: '25' } });
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.getByText('大盲注必须大于小盲注')).toBeInTheDocument();
      });
    });

    it('should validate blind amounts (equal values)', async () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const smallBlindInput = screen.getAllByRole('spinbutton')[0];
      const bigBlindInput = screen.getAllByRole('spinbutton')[1];
      const form = document.querySelector('form');
      
      fireEvent.change(smallBlindInput, { target: { value: '25' } });
      fireEvent.change(bigBlindInput, { target: { value: '25' } });
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.getByText('大盲注必须大于小盲注')).toBeInTheDocument();
      });
    });

    it('should clear error messages when form is modified', async () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const smallBlindInput = screen.getAllByRole('spinbutton')[0];
      const bigBlindInput = screen.getAllByRole('spinbutton')[1];
      const form = document.querySelector('form');
      
      // Create an error
      fireEvent.change(smallBlindInput, { target: { value: '50' } });
      fireEvent.change(bigBlindInput, { target: { value: '25' } });
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.getByText('大盲注必须大于小盲注')).toBeInTheDocument();
      });
      
      // Fix the error
      fireEvent.change(bigBlindInput, { target: { value: '100' } });
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.queryByText('大盲注必须大于小盲注')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call createRoom with correct data on valid submission', async () => {
      mockCreateRoom.mockResolvedValue({ id: 'room-123' });
      
      render(<CreateRoomModal {...defaultProps} />);
      
      const playerLimitSelect = screen.getByRole('combobox');
      const smallBlindInput = screen.getAllByRole('spinbutton')[0];
      const bigBlindInput = screen.getAllByRole('spinbutton')[1];
      const passwordInput = screen.getByPlaceholderText('留空表示无密码');
      const submitButton = screen.getByRole('button', { name: '创建房间' });
      
      fireEvent.change(playerLimitSelect, { target: { value: '4' } });
      fireEvent.change(smallBlindInput, { target: { value: '25' } });
      fireEvent.change(bigBlindInput, { target: { value: '50' } });
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockCreateRoom).toHaveBeenCalledWith({
          playerLimit: 4,
          smallBlind: 25,
          bigBlind: 50,
          password: 'secret123'
        });
      });
    });

    it('should not send empty password', async () => {
      mockCreateRoom.mockResolvedValue({ id: 'room-123' });
      
      render(<CreateRoomModal {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: '创建房间' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockCreateRoom).toHaveBeenCalledWith({
          playerLimit: 6,
          smallBlind: 10,
          bigBlind: 20,
          password: undefined
        });
      });
    });

    it('should reset form and close modal on successful submission', async () => {
      const mockOnClose = vi.fn();
      mockCreateRoom.mockResolvedValue({ id: 'room-123' });
      
      render(<CreateRoomModal {...defaultProps} onClose={mockOnClose} />);
      
      const passwordInput = screen.getByPlaceholderText('留空表示无密码');
      const submitButton = screen.getByRole('button', { name: '创建房间' });
      
      fireEvent.change(passwordInput, { target: { value: 'test123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      
      // Form should be reset
      expect(passwordInput).toHaveValue('');
    });

    it('should handle submission errors gracefully', async () => {
      mockCreateRoom.mockRejectedValue(new Error('Network error'));
      
      render(<CreateRoomModal {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: '创建房间' });
      fireEvent.click(submitButton);
      
      // Should not crash and continue to work
      await waitFor(() => {
        expect(mockCreateRoom).toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when creating room', async () => {
      const { useRoomStore } = await import('../../src/stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        createRoom: mockCreateRoom,
        isLoading: true
      });
      
      render(<CreateRoomModal {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: '创建中...' });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when loading', async () => {
      const { useRoomStore } = await import('../../src/stores/roomStore');
      (useRoomStore as any).mockReturnValue({
        createRoom: mockCreateRoom,
        isLoading: true
      });
      
      render(<CreateRoomModal {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: '创建中...' });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('Modal Controls', () => {
    it('should have close button in header', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when header close button is clicked', () => {
      const mockOnClose = vi.fn();
      render(<CreateRoomModal {...defaultProps} onClose={mockOnClose} />);
      
      const closeButton = screen.getByRole('button', { name: '' });
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have cancel button', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: '取消' });
      expect(cancelButton).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', () => {
      const mockOnClose = vi.fn();
      render(<CreateRoomModal {...defaultProps} onClose={mockOnClose} />);
      
      const cancelButton = screen.getByRole('button', { name: '取消' });
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset form when modal is closed', () => {
      const mockOnClose = vi.fn();
      render(<CreateRoomModal {...defaultProps} onClose={mockOnClose} />);
      
      const passwordInput = screen.getByPlaceholderText('留空表示无密码');
      fireEvent.change(passwordInput, { target: { value: 'test123' } });
      
      const cancelButton = screen.getByRole('button', { name: '取消' });
      fireEvent.click(cancelButton);
      
      expect(passwordInput).toHaveValue('');
    });
  });

  describe('Input Constraints', () => {
    it('should have correct input constraints for blind amounts', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const smallBlindInput = screen.getAllByRole('spinbutton')[0];
      const bigBlindInput = screen.getAllByRole('spinbutton')[1];
      
      expect(smallBlindInput).toHaveAttribute('type', 'number');
      expect(smallBlindInput).toHaveAttribute('min', '1');
      expect(smallBlindInput).toHaveAttribute('max', '1000');
      
      expect(bigBlindInput).toHaveAttribute('type', 'number');
      expect(bigBlindInput).toHaveAttribute('min', '2');
      expect(bigBlindInput).toHaveAttribute('max', '2000');
    });

    it('should have password input as text type', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const passwordInput = screen.getByPlaceholderText('留空表示无密码');
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(passwordInput).toHaveAttribute('placeholder', '留空表示无密码');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getAllByRole('spinbutton')[0]).toBeInTheDocument();
      expect(screen.getAllByRole('spinbutton')[1]).toBeInTheDocument();
      expect(screen.getByPlaceholderText('留空表示无密码')).toBeInTheDocument();
    });

    it('should have proper form structure', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      expect(document.querySelector('form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '创建房间' })).toHaveAttribute('type', 'submit');
      expect(screen.getByRole('button', { name: '取消' })).toHaveAttribute('type', 'button');
    });

    it('should have modal title and structure', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      expect(screen.getByRole('heading', { name: '创建房间' })).toBeInTheDocument();
    });
  });

  describe('UI Styling', () => {
    it('should have proper modal backdrop', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const backdrop = screen.getByRole('heading', { name: '创建房间' }).closest('.fixed');
      expect(backdrop).toHaveClass('inset-0', 'bg-black', 'bg-opacity-50');
    });

    it('should have proper button styling', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: '创建房间' });
      const cancelButton = screen.getByRole('button', { name: '取消' });
      
      expect(submitButton).toHaveClass('bg-blue-600', 'text-white');
      expect(cancelButton).toHaveClass('border-gray-300', 'text-gray-700');
    });

    it('should have proper form input styling', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveClass(
          'w-full',
          'px-3',
          'py-2',
          'border',
          'border-gray-300',
          'rounded-lg'
        );
      });
    });
  });

  describe('Preview Updates', () => {
    it('should update preview in real-time', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const playerLimitSelect = screen.getByRole('combobox');
      const smallBlindInput = screen.getAllByRole('spinbutton')[0];
      const bigBlindInput = screen.getAllByRole('spinbutton')[1];
      const passwordInput = screen.getByPlaceholderText('留空表示无密码');
      
      // Change values
      fireEvent.change(playerLimitSelect, { target: { value: '8' } });
      fireEvent.change(smallBlindInput, { target: { value: '100' } });
      fireEvent.change(bigBlindInput, { target: { value: '200' } });
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
      
      // Check preview updates
      expect(screen.getByText('• 最多 8 名玩家')).toBeInTheDocument();
      expect(screen.getByText('• 盲注: 100/200')).toBeInTheDocument();
      expect(screen.getByText('• 需要密码')).toBeInTheDocument();
    });

    it('should handle rapid input changes', () => {
      render(<CreateRoomModal {...defaultProps} />);
      
      const smallBlindInput = screen.getAllByRole('spinbutton')[0];
      
      // Rapid changes
      fireEvent.change(smallBlindInput, { target: { value: '50' } });
      fireEvent.change(smallBlindInput, { target: { value: '75' } });
      fireEvent.change(smallBlindInput, { target: { value: '100' } });
      
      expect(screen.getByText('• 盲注: 100/20')).toBeInTheDocument();
    });
  });
});