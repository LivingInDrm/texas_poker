import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import ReconnectionIndicator from '../../src/components/ReconnectionIndicator';
import { ConnectionStatus } from '../../src/types/socket';

describe('ReconnectionIndicator', () => {
  beforeEach(() => {
    // Setup for each test if needed
  });

  describe('when connection status is stable', () => {
    it('renders nothing when status is connected', () => {
      const { container } = render(
        <ReconnectionIndicator connectionStatus="connected" />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when status is disconnected', () => {
      const { container } = render(
        <ReconnectionIndicator connectionStatus="disconnected" />
      );
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when connection status requires user attention', () => {
    it('renders connecting indicator correctly', () => {
      render(<ReconnectionIndicator connectionStatus="connecting" />);
      
      expect(screen.getByText('正在连接到服务器...')).toBeInTheDocument();
      
      // Check for spinning icon (SVG)
      const container = screen.getByText('正在连接到服务器...').closest('div');
      const svg = container?.querySelector('svg');
      expect(svg).toHaveClass('animate-spin');
      
      // Check background color
      const indicator = screen.getByText('正在连接到服务器...').closest('div');
      expect(indicator).toHaveClass('bg-blue-500');
    });

    it('renders reconnecting indicator correctly', () => {
      render(<ReconnectionIndicator connectionStatus="reconnecting" />);
      
      expect(screen.getByText('连接断开，正在重新连接...')).toBeInTheDocument();
      
      // Check for pulsing icon (SVG)
      const container = screen.getByText('连接断开，正在重新连接...').closest('div');
      const svg = container?.querySelector('svg');
      expect(svg).toHaveClass('animate-pulse');
      
      // Check background color
      const indicator = screen.getByText('连接断开，正在重新连接...').closest('div');
      expect(indicator).toHaveClass('bg-yellow-500');
    });

    it('renders error indicator correctly', () => {
      render(<ReconnectionIndicator connectionStatus="error" />);
      
      expect(screen.getByText('连接失败，请检查网络')).toBeInTheDocument();
      
      // Check for error icon (no animation)
      const container = screen.getByText('连接失败，请检查网络').closest('div');
      const svg = container?.querySelector('svg');
      expect(svg).not.toHaveClass('animate-spin');
      expect(svg).not.toHaveClass('animate-pulse');
      
      // Check background color
      const indicator = screen.getByText('连接失败，请检查网络').closest('div');
      expect(indicator).toHaveClass('bg-red-500');
    });

    it('handles unknown connection status gracefully', () => {
      const { container } = render(
        <ReconnectionIndicator connectionStatus={'unknown' as ConnectionStatus} />
      );
      
      // Should render nothing for unknown status
      expect(container.firstChild).toBeNull();
    });
  });

  describe('styling and layout', () => {
    it('applies custom className when provided', () => {
      const customClass = 'custom-test-class';
      
      render(
        <ReconnectionIndicator 
          connectionStatus="connecting" 
          className={customClass}
        />
      );
      
      const container = screen.getByText('正在连接到服务器...').closest('div')?.parentElement;
      expect(container).toHaveClass(customClass);
    });

    it('has correct positioning and z-index', () => {
      render(<ReconnectionIndicator connectionStatus="connecting" />);
      
      const container = screen.getByText('正在连接到服务器...').closest('div')?.parentElement;
      expect(container).toHaveClass('fixed', 'top-4', 'right-4', 'z-50');
    });

    it('has correct text and icon colors for each status', () => {
      const { rerender } = render(<ReconnectionIndicator connectionStatus="connecting" />);
      
      // Connecting - blue
      let indicator = screen.getByText('正在连接到服务器...').closest('div');
      expect(indicator).toHaveClass('text-white');
      
      // Reconnecting - yellow
      rerender(<ReconnectionIndicator connectionStatus="reconnecting" />);
      indicator = screen.getByText('连接断开，正在重新连接...').closest('div');
      expect(indicator).toHaveClass('text-white');
      
      // Error - red
      rerender(<ReconnectionIndicator connectionStatus="error" />);
      indicator = screen.getByText('连接失败，请检查网络').closest('div');
      expect(indicator).toHaveClass('text-white');
    });

    it('maintains consistent layout structure', () => {
      render(<ReconnectionIndicator connectionStatus="connecting" />);
      
      const message = screen.getByText('正在连接到服务器...');
      const messageContainer = message.closest('div');
      const svg = messageContainer?.querySelector('svg');
      
      // Check for flex layout
      expect(messageContainer).toHaveClass('flex', 'items-center', 'space-x-2');
      
      // Check for minimum width
      expect(messageContainer).toHaveClass('min-w-[200px]');
      
      // Check for padding and rounded corners
      expect(messageContainer).toHaveClass('px-4', 'py-2', 'rounded-lg');
    });

    it('renders different SVG icons for different statuses', () => {
      const { rerender } = render(<ReconnectionIndicator connectionStatus="connecting" />);
      
      // Get SVG element for connecting status
      let container = screen.getByText('正在连接到服务器...').closest('div');
      let svg = container?.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('animate-spin');
      
      // Rerender with error status
      rerender(<ReconnectionIndicator connectionStatus="error" />);
      container = screen.getByText('连接失败，请检查网络').closest('div');
      svg = container?.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).not.toHaveClass('animate-spin');
      
      // Icons should have consistent sizing
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('has proper shadow and styling', () => {
      render(<ReconnectionIndicator connectionStatus="connecting" />);
      
      const indicator = screen.getByText('正在连接到服务器...').closest('div');
      expect(indicator).toHaveClass('shadow-lg');
    });

    it('has correct font weight and size for text', () => {
      render(<ReconnectionIndicator connectionStatus="connecting" />);
      
      const text = screen.getByText('正在连接到服务器...');
      expect(text).toHaveClass('text-sm', 'font-medium');
    });
  });
});