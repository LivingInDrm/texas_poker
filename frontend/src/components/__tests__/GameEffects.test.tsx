import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { 
  SoundControl, 
  GameSoundEffects, 
  ConfettiEffect, 
  FlashEffect, 
  PulseEffect, 
  ShakeEffect,
  ParticleTrail,
  CelebrationEffects 
} from '../GameEffects';

// Mock Web Audio API
const mockAudioContext = {
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    frequency: { setValueAtTime: vi.fn() },
    type: 'sine',
    start: vi.fn(),
    stop: vi.fn()
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    }
  })),
  destination: {},
  currentTime: 0,
  close: vi.fn()
};

global.AudioContext = vi.fn(() => mockAudioContext) as any;
global.webkitAudioContext = vi.fn(() => mockAudioContext) as any;

// Mock timers
vi.useFakeTimers();

describe('SoundControl', () => {
  const mockProps = {
    soundEnabled: true,
    onToggleSound: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render sound on state correctly', () => {
    render(<SoundControl {...mockProps} />);
    
    expect(screen.getByText('音效开')).toBeInTheDocument();
    expect(screen.getByTitle('关闭音效')).toBeInTheDocument();
  });

  it('should render sound off state correctly', () => {
    render(<SoundControl {...mockProps} soundEnabled={false} />);
    
    expect(screen.getByText('音效关')).toBeInTheDocument();
    expect(screen.getByTitle('开启音效')).toBeInTheDocument();
  });

  it('should call onToggleSound when clicked', () => {
    render(<SoundControl {...mockProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockProps.onToggleSound).toHaveBeenCalledTimes(1);
  });
});

describe('GameSoundEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create audio context when enabled', () => {
    render(<GameSoundEffects enabled={true} />);
    
    expect(global.AudioContext).toHaveBeenCalledTimes(1);
  });

  it('should not create audio context when disabled', () => {
    render(<GameSoundEffects enabled={false} />);
    
    expect(global.AudioContext).not.toHaveBeenCalled();
  });

  it('should close audio context on unmount', () => {
    const { unmount } = render(<GameSoundEffects enabled={true} />);
    
    unmount();
    
    expect(mockAudioContext.close).toHaveBeenCalledTimes(1);
  });
});

describe('ConfettiEffect', () => {
  const mockProps = {
    isVisible: true,
    duration: 3000,
    onComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should not render when not visible', () => {
    render(<ConfettiEffect {...mockProps} isVisible={false} />);
    
    expect(screen.queryByRole('generic')).toBeNull();
  });

  it('should render particles when visible', () => {
    render(<ConfettiEffect {...mockProps} />);
    
    // Should create particle elements (check for container)
    const container = screen.getByRole('generic');
    expect(container).toBeInTheDocument();
  });

  it('should call onComplete after duration', () => {
    render(<ConfettiEffect {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    
    expect(mockProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('should use custom duration', () => {
    const customDuration = 5000;
    render(<ConfettiEffect {...mockProps} duration={customDuration} />);
    
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    
    expect(mockProps.onComplete).not.toHaveBeenCalled();
    
    act(() => {
      vi.advanceTimersByTime(1);
    });
    
    expect(mockProps.onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('FlashEffect', () => {
  const mockProps = {
    isVisible: true,
    color: 'white',
    duration: 300
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should not render when not visible', () => {
    render(<FlashEffect {...mockProps} isVisible={false} />);
    
    expect(screen.queryByRole('generic')).toBeNull();
  });

  it('should render with correct color', () => {
    render(<FlashEffect {...mockProps} color="red" />);
    
    const flashElement = screen.getByRole('generic');
    expect(flashElement).toHaveStyle({ backgroundColor: 'red' });
  });

  it('should disappear after duration', () => {
    render(<FlashEffect {...mockProps} />);
    
    const flashElement = screen.getByRole('generic');
    expect(flashElement).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(screen.queryByRole('generic')).toBeNull();
  });
});

describe('PulseEffect', () => {
  const mockProps = {
    children: <div>Test Content</div>,
    isActive: true,
    color: 'blue',
    intensity: 'medium' as const
  };

  it('should render children', () => {
    render(<PulseEffect {...mockProps} />);
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply active classes when active', () => {
    render(<PulseEffect {...mockProps} />);
    
    const container = screen.getByText('Test Content').parentElement;
    expect(container).toHaveClass('animate-pulse', 'scale-105');
  });

  it('should not apply active classes when inactive', () => {
    render(<PulseEffect {...mockProps} isActive={false} />);
    
    const container = screen.getByText('Test Content').parentElement;
    expect(container).not.toHaveClass('animate-pulse', 'scale-105');
  });

  it('should apply different intensity classes', () => {
    const { rerender } = render(<PulseEffect {...mockProps} intensity="high" />);
    
    let container = screen.getByText('Test Content').parentElement;
    expect(container).toHaveClass('animate-bounce', 'scale-110');
    
    rerender(<PulseEffect {...mockProps} intensity="low" />);
    
    container = screen.getByText('Test Content').parentElement;
    expect(container).toHaveClass('animate-pulse');
    expect(container).not.toHaveClass('scale-105');
  });
});

describe('ShakeEffect', () => {
  const mockProps = {
    children: <div>Test Content</div>,
    isActive: true,
    intensity: 'medium' as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should render children', () => {
    render(<ShakeEffect {...mockProps} />);
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply shake animation when active', () => {
    render(<ShakeEffect {...mockProps} />);
    
    const container = screen.getByText('Test Content').parentElement;
    expect(container).toHaveClass('animate-bounce');
  });

  it('should stop shaking after timeout', () => {
    render(<ShakeEffect {...mockProps} />);
    
    let container = screen.getByText('Test Content').parentElement;
    expect(container).toHaveClass('animate-bounce');
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    container = screen.getByText('Test Content').parentElement;
    expect(container).not.toHaveClass('animate-bounce');
  });
});

describe('ParticleTrail', () => {
  const mockProps = {
    startPosition: { x: 100, y: 100 },
    endPosition: { x: 300, y: 200 },
    isVisible: true,
    particleCount: 5,
    color: '#FFD700',
    onComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should not render when not visible', () => {
    render(<ParticleTrail {...mockProps} isVisible={false} />);
    
    expect(screen.queryByRole('generic')).toBeNull();
  });

  it('should render particles when visible', () => {
    render(<ParticleTrail {...mockProps} />);
    
    const container = screen.getByRole('generic');
    expect(container).toBeInTheDocument();
  });

  it('should call onComplete after animation', () => {
    render(<ParticleTrail {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(1250); // 1000 + 5 * 50
    });
    
    expect(mockProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('should use custom particle count', () => {
    render(<ParticleTrail {...mockProps} particleCount={3} />);
    
    act(() => {
      vi.advanceTimersByTime(1150); // 1000 + 3 * 50
    });
    
    expect(mockProps.onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('CelebrationEffects', () => {
  const mockProps = {
    isWinner: true,
    winAmount: 500,
    isVisible: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  it('should render celebration for winner', () => {
    render(<CelebrationEffects {...mockProps} />);
    
    expect(screen.getByText('🎉 恭喜获胜! 🎉')).toBeInTheDocument();
    expect(screen.getByText('+500 筹码')).toBeInTheDocument();
  });

  it('should not render for non-winner', () => {
    render(<CelebrationEffects {...mockProps} isWinner={false} />);
    
    expect(screen.queryByText('🎉 恭喜获胜! 🎉')).not.toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<CelebrationEffects {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('🎉 恭喜获胜! 🎉')).not.toBeInTheDocument();
  });

  it('should render without win amount', () => {
    render(<CelebrationEffects {...mockProps} winAmount={undefined} />);
    
    expect(screen.getByText('🎉 恭喜获胜! 🎉')).toBeInTheDocument();
    expect(screen.queryByText('+500 筹码')).not.toBeInTheDocument();
  });
});