import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { WinnerHighlight, ChipAnimation, WinnerAnimationSequence } from '../../src/components/WinnerHighlight';

// Mock timers
vi.useFakeTimers();

describe('WinnerHighlight', () => {
  const mockProps = {
    winnerId: 'player1',
    winAmount: 500,
    isVisible: true,
    duration: 3000,
    onAnimationComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should render when visible', () => {
    render(<WinnerHighlight {...mockProps} />);
    
    expect(screen.getByText('获胜者')).toBeInTheDocument();
    expect(screen.getByText('+500')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<WinnerHighlight {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('获胜者')).not.toBeInTheDocument();
  });

  it('should call onAnimationComplete after duration', () => {
    render(<WinnerHighlight {...mockProps} />);
    
    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(3500); // duration + fade time
    });
    
    expect(mockProps.onAnimationComplete).toHaveBeenCalledTimes(1);
  });

  it('should use custom duration', () => {
    const customDuration = 5000;
    render(<WinnerHighlight {...mockProps} duration={customDuration} />);
    
    // Fast-forward to just before completion
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    
    expect(mockProps.onAnimationComplete).not.toHaveBeenCalled();
    
    // Complete the animation
    act(() => {
      vi.advanceTimersByTime(501);
    });
    
    expect(mockProps.onAnimationComplete).toHaveBeenCalledTimes(1);
  });

  it('should reset animation when visibility changes', () => {
    const { rerender } = render(<WinnerHighlight {...mockProps} />);
    
    // Make invisible
    rerender(<WinnerHighlight {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('获胜者')).not.toBeInTheDocument();
    
    // Make visible again
    rerender(<WinnerHighlight {...mockProps} isVisible={true} />);
    
    expect(screen.getByText('获胜者')).toBeInTheDocument();
  });
});

describe('ChipAnimation', () => {
  const mockProps = {
    fromPosition: { x: 100, y: 100 },
    toPosition: { x: 300, y: 200 },
    amount: 250,
    isVisible: true,
    onAnimationComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should render when visible', () => {
    render(<ChipAnimation {...mockProps} />);
    
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<ChipAnimation {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('250')).not.toBeInTheDocument();
  });

  it('should call onAnimationComplete after animation', () => {
    render(<ChipAnimation {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    
    expect(mockProps.onAnimationComplete).toHaveBeenCalledTimes(1);
  });

  it('should render multiple chip elements', () => {
    render(<ChipAnimation {...mockProps} />);
    
    // Should render 5 chip elements (based on component implementation)
    const chipElements = screen.getAllByText('250');
    expect(chipElements.length).toBeGreaterThan(0);
  });
});

describe('WinnerAnimationSequence', () => {
  const mockProps = {
    winners: [
      {
        playerId: 'player1',
        seatPosition: { x: 200, y: 150 },
        winAmount: 300
      },
      {
        playerId: 'player2',
        seatPosition: { x: 400, y: 250 },
        winAmount: 200
      }
    ],
    potPosition: { x: 300, y: 200 },
    isVisible: true,
    onSequenceComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should not render when not visible', () => {
    render(<WinnerAnimationSequence {...mockProps} isVisible={false} />);
    
    // Shouldn't render any winner highlights
    expect(screen.queryByText('获胜者')).not.toBeInTheDocument();
  });

  it('should start with first winner when visible', () => {
    render(<WinnerAnimationSequence {...mockProps} />);
    
    // Should show winner highlight
    expect(screen.getByText('获胜者')).toBeInTheDocument();
  });

  it('should progress through all winners', () => {
    render(<WinnerAnimationSequence {...mockProps} />);
    
    // First winner should be visible
    expect(screen.getByText('获胜者')).toBeInTheDocument();
    
    // Fast-forward through first winner
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    
    // Should still show winner (second winner now)
    expect(screen.getByText('获胜者')).toBeInTheDocument();
  });

  it('should call onSequenceComplete after all winners', () => {
    render(<WinnerAnimationSequence {...mockProps} />);
    
    // Fast-forward through first winner (3.5 seconds)
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    
    // Fast-forward through second winner (another 3.5 seconds)
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    
    // Give a small buffer for the effect to run and call onSequenceComplete
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(mockProps.onSequenceComplete).toHaveBeenCalledTimes(1);
  });

  it('should handle empty winners array', () => {
    render(<WinnerAnimationSequence {...mockProps} winners={[]} />);
    
    expect(screen.queryByText('获胜者')).not.toBeInTheDocument();
    
    // Should call completion immediately
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    expect(mockProps.onSequenceComplete).toHaveBeenCalledTimes(1);
  });

  it('should handle single winner', () => {
    const singleWinner = [mockProps.winners[0]];
    render(<WinnerAnimationSequence {...mockProps} winners={singleWinner} />);
    
    expect(screen.getByText('获胜者')).toBeInTheDocument();
    
    // Fast-forward through single winner
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    
    expect(mockProps.onSequenceComplete).toHaveBeenCalledTimes(1);
  });

  it('should reset when visibility changes', () => {
    const { rerender } = render(<WinnerAnimationSequence {...mockProps} />);
    
    // Make invisible
    rerender(<WinnerAnimationSequence {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('获胜者')).not.toBeInTheDocument();
    
    // Make visible again - should restart from first winner
    rerender(<WinnerAnimationSequence {...mockProps} isVisible={true} />);
    
    expect(screen.getByText('获胜者')).toBeInTheDocument();
  });
});