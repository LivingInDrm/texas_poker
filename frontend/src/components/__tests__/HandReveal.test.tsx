import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { HandReveal, AllHandsReveal, HandComparison } from '../HandReveal';
import { Card, HandRank, Suit, Rank } from '../../types/game';

// Mock timers
vi.useFakeTimers();

const mockCards: Card[] = [
  { suit: Suit.SPADES, rank: Rank.ACE },
  { suit: Suit.HEARTS, rank: Rank.KING }
];

const mockHand: HandRank = {
  type: 'pair',
  name: '一对A',
  cards: [
    { suit: Suit.SPADES, rank: Rank.ACE },
    { suit: Suit.HEARTS, rank: Rank.ACE },
    { suit: Suit.CLUBS, rank: Rank.KING },
    { suit: Suit.DIAMONDS, rank: Rank.QUEEN },
    { suit: Suit.SPADES, rank: Rank.JACK }
  ],
  rank: 2
};

describe('HandReveal', () => {
  const mockProps = {
    playerId: 'player1',
    cards: mockCards,
    hand: mockHand,
    isWinner: false,
    isVisible: true,
    onRevealComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should not render when not visible', () => {
    render(<HandReveal {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('一对')).not.toBeInTheDocument();
  });

  it('should render hand information when cards are revealed', () => {
    render(<HandReveal {...mockProps} />);
    
    // Fast-forward through card reveal animation
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('一对')).toBeInTheDocument();
    expect(screen.getByText('一对相同点数的牌')).toBeInTheDocument();
  });

  it('should show winner indicator for winning hand', () => {
    render(<HandReveal {...mockProps} isWinner={true} />);
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('最佳牌型')).toBeInTheDocument();
  });

  it('should call onRevealComplete after animation', () => {
    render(<HandReveal {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    
    expect(mockProps.onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it('should handle different hand types', () => {
    const straightFlushHand: HandRank = {
      type: 'straight_flush',
      name: '同花顺',
      cards: [],
      rank: 8
    };

    render(<HandReveal {...mockProps} hand={straightFlushHand} />);
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('同花顺')).toBeInTheDocument();
    expect(screen.getByText('同花色的连续五张牌')).toBeInTheDocument();
  });

  it('should handle no hand provided', () => {
    render(<HandReveal {...mockProps} hand={null} />);
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.queryByText('一对')).not.toBeInTheDocument();
  });

  it('should handle empty cards array', () => {
    render(<HandReveal {...mockProps} cards={[]} />);
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(mockProps.onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it('should use animation delay', () => {
    const delay = 500;
    render(<HandReveal {...mockProps} animationDelay={delay} />);
    
    // Before delay
    act(() => {
      vi.advanceTimersByTime(400);
    });
    
    expect(screen.queryByText('一对')).not.toBeInTheDocument();
    
    // After delay
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    expect(screen.getByText('一对')).toBeInTheDocument();
  });
});

describe('AllHandsReveal', () => {
  const mockPlayers = [
    {
      id: 'player1',
      name: 'Alice',
      cards: mockCards,
      hand: mockHand,
      isWinner: true,
      status: 'active'
    },
    {
      id: 'player2',
      name: 'Bob',
      cards: mockCards,
      hand: null,
      isWinner: false,
      status: 'active'
    },
    {
      id: 'player3',
      name: 'Charlie',
      cards: [],
      hand: null,
      isWinner: false,
      status: 'folded'
    }
  ];

  const mockProps = {
    players: mockPlayers,
    isVisible: true,
    onRevealComplete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should render player names', () => {
    render(<AllHandsReveal {...mockProps} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument(); // folded player
  });

  it('should show winner indicator', () => {
    render(<AllHandsReveal {...mockProps} />);
    
    expect(screen.getByText('获胜者')).toBeInTheDocument();
  });

  it('should filter out folded players', () => {
    render(<AllHandsReveal {...mockProps} />);
    
    // Charlie is folded, should not be shown
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    
    // But Alice and Bob should be shown
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should filter out players with no cards', () => {
    const playersWithEmptyCards = mockPlayers.map(p => 
      p.id === 'player2' ? { ...p, cards: [] } : p
    );

    render(<AllHandsReveal {...mockProps} players={playersWithEmptyCards} />);
    
    // Bob has no cards, should not be shown
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    
    // Alice should still be shown
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should call onRevealComplete after all players revealed', () => {
    render(<AllHandsReveal {...mockProps} />);
    
    // Fast-forward through all reveals
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(mockProps.onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it('should not render when not visible', () => {
    render(<AllHandsReveal {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('should handle empty players array', () => {
    render(<AllHandsReveal {...mockProps} players={[]} />);
    
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });
});

describe('HandComparison', () => {
  const mockHands = [
    {
      playerId: 'player1',
      playerName: 'Alice',
      hand: {
        type: 'pair',
        name: '一对A',
        cards: [],
        rank: 3
      },
      isWinner: true
    },
    {
      playerId: 'player2',
      playerName: 'Bob',
      hand: {
        type: 'high_card',
        name: '高牌K',
        cards: [],
        rank: 1
      },
      isWinner: false
    }
  ];

  const mockProps = {
    hands: mockHands,
    isVisible: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should render hand comparison title', () => {
    render(<HandComparison {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    expect(screen.getByText('牌型对比')).toBeInTheDocument();
  });

  it('should display player names and hands', () => {
    render(<HandComparison {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('一对A')).toBeInTheDocument();
    expect(screen.getByText('高牌K')).toBeInTheDocument();
  });

  it('should show winner first in sorted order', () => {
    render(<HandComparison {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    const playerElements = screen.getAllByText(/Alice|Bob/);
    // Alice (winner) should appear first
    expect(playerElements[0]).toHaveTextContent('Alice');
  });

  it('should display hand ranks', () => {
    render(<HandComparison {...mockProps} />);
    
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    expect(screen.getByText('等级: 3')).toBeInTheDocument();
    expect(screen.getByText('等级: 1')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<HandComparison {...mockProps} isVisible={false} />);
    
    expect(screen.queryByText('牌型对比')).not.toBeInTheDocument();
  });

  it('should handle empty hands array', () => {
    render(<HandComparison {...mockProps} hands={[]} />);
    
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    expect(screen.getByText('牌型对比')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('should sort hands by winner status and rank', () => {
    const mixedHands = [
      {
        playerId: 'player3',
        playerName: 'Charlie',
        hand: { type: 'two_pair', name: '两对', cards: [], rank: 2 },
        isWinner: false
      },
      {
        playerId: 'player1',
        playerName: 'Alice',
        hand: { type: 'three_of_a_kind', name: '三条', cards: [], rank: 4 },
        isWinner: true
      },
      {
        playerId: 'player2',
        playerName: 'Bob',
        hand: { type: 'pair', name: '一对', cards: [], rank: 3 },
        isWinner: false
      }
    ];

    render(<HandComparison {...mockProps} hands={mixedHands} />);
    
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    const numbers = screen.getAllByText(/[1-3]/);
    // Alice (winner) should be ranked #1
    expect(numbers[0]).toHaveTextContent('1');
  });
});