import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import GameTable from '../GameTable';
import { GamePhase, PlayerStatus, Suit, Rank } from '../../types/game';

// Mock the component dependencies
vi.mock('../PlayerSeat', () => ({
  default: ({ player }: any) => <div data-testid={`player-seat-${player.id}`}>{player.name}</div>
}));

vi.mock('../PokerCards', () => ({
  PokerCards: ({ cards }: any) => <div data-testid="poker-cards">Cards: {cards.length}</div>
}));

vi.mock('../PotDisplay', () => ({
  default: ({ pots }: any) => <div data-testid="pot-display">Pots: {pots.length}</div>
}));

describe('GameTable', () => {
  const mockGameSnapshot = {
    gameId: 'test-room',
    phase: GamePhase.FLOP,
    players: [
      {
        id: 'player1',
        name: 'Alice',
        chips: 1500,
        status: PlayerStatus.ACTIVE,
        cards: [
          { suit: Suit.SPADES, rank: Rank.ACE },
          { suit: Suit.HEARTS, rank: Rank.KING }
        ],
        currentBet: 50,
        totalBet: 70,
        hasActed: true,
        isReady: true,
        timeoutAt: Date.now() + 30000
      },
      {
        id: 'player2',
        name: 'Bob',
        chips: 2000,
        status: PlayerStatus.ACTIVE,
        cards: [
          { suit: Suit.CLUBS, rank: Rank.QUEEN },
          { suit: Suit.DIAMONDS, rank: Rank.JACK }
        ],
        currentBet: 50,
        totalBet: 50,
        hasActed: false,
        isReady: true
      }
    ],
    communityCards: [
      { suit: Suit.SPADES, rank: Rank.TEN },
      { suit: Suit.HEARTS, rank: Rank.NINE },
      { suit: Suit.CLUBS, rank: Rank.EIGHT }
    ],
    pots: [
      {
        id: 'pot-1',
        amount: 140,
        type: 'main' as const,
        eligiblePlayers: ['player1', 'player2']
      }
    ],
    currentPlayerId: 'player1',
    actionHistory: [],
    isHandInProgress: true,
    positions: [
      {
        playerId: 'player1',
        seatIndex: 0,
        isDealer: true,
        isSmallBlind: false,
        isBigBlind: false
      },
      {
        playerId: 'player2',
        seatIndex: 1,
        isDealer: false,
        isSmallBlind: true,
        isBigBlind: false
      }
    ]
  };

  test('renders game table with basic elements', () => {
    render(<GameTable gameSnapshot={mockGameSnapshot} currentUserId="player1" />);
    
    // Should render player seats
    expect(screen.getByTestId('player-seat-player1')).toBeInTheDocument();
    expect(screen.getByTestId('player-seat-player2')).toBeInTheDocument();
    
    // Should render pot display
    expect(screen.getByTestId('pot-display')).toBeInTheDocument();
    
    // Should show game phase
    expect(screen.getByText('翻牌')).toBeInTheDocument();
  });

  test('shows community cards in flop phase', () => {
    render(<GameTable gameSnapshot={mockGameSnapshot} currentUserId="player1" />);
    
    expect(screen.getByText('公共牌')).toBeInTheDocument();
    expect(screen.getByTestId('poker-cards')).toBeInTheDocument();
  });

  test('shows current player turn message', () => {
    render(<GameTable gameSnapshot={mockGameSnapshot} currentUserId="player1" />);
    
    expect(screen.getByText('轮到你行动了！')).toBeInTheDocument();
  });

  test('shows waiting for other player message', () => {
    render(<GameTable gameSnapshot={mockGameSnapshot} currentUserId="player2" />);
    
    expect(screen.getByText('等待 Alice 行动...')).toBeInTheDocument();
  });

  test('shows waiting for game to start in waiting phase', () => {
    const waitingSnapshot = {
      ...mockGameSnapshot,
      phase: GamePhase.WAITING,
      isHandInProgress: false
    };

    render(<GameTable gameSnapshot={waitingSnapshot} currentUserId="player1" />);
    
    expect(screen.getByText('等待玩家准备...')).toBeInTheDocument();
    expect(screen.getByText('已准备: 2 / 2')).toBeInTheDocument();
  });

  test('shows game information panel', () => {
    render(<GameTable gameSnapshot={mockGameSnapshot} currentUserId="player1" />);
    
    expect(screen.getByText('房间: test-room')).toBeInTheDocument();
    expect(screen.getByText('玩家: 2/9')).toBeInTheDocument();
  });

  test('handles different game phases correctly', () => {
    // Test pre-flop (no community cards)
    const preflopSnapshot = {
      ...mockGameSnapshot,
      phase: GamePhase.PRE_FLOP,
      communityCards: []
    };

    const { rerender } = render(<GameTable gameSnapshot={preflopSnapshot} currentUserId="player1" />);
    expect(screen.getByText('翻牌前')).toBeInTheDocument();
    expect(screen.queryByText('公共牌')).not.toBeInTheDocument();

    // Test turn (4 community cards)
    const turnSnapshot = {
      ...mockGameSnapshot,
      phase: GamePhase.TURN,
      communityCards: [...mockGameSnapshot.communityCards, { suit: Suit.HEARTS, rank: Rank.SEVEN }]
    };

    rerender(<GameTable gameSnapshot={turnSnapshot} currentUserId="player1" />);
    expect(screen.getByText('转牌')).toBeInTheDocument();

    // Test river (5 community cards)
    const riverSnapshot = {
      ...mockGameSnapshot,
      phase: GamePhase.RIVER,
      communityCards: [
        ...turnSnapshot.communityCards,
        { suit: Suit.DIAMONDS, rank: Rank.SIX }
      ]
    };

    rerender(<GameTable gameSnapshot={riverSnapshot} currentUserId="player1" />);
    expect(screen.getByText('河牌')).toBeInTheDocument();
  });

  test('handles action history display', () => {
    const snapshotWithHistory = {
      ...mockGameSnapshot,
      actionHistory: [
        {
          playerId: 'player1',
          action: 'raise' as any,
          amount: 50,
          timestamp: Date.now() - 5000,
          phase: GamePhase.PRE_FLOP
        }
      ]
    };

    render(<GameTable gameSnapshot={snapshotWithHistory} currentUserId="player1" />);
    
    expect(screen.getByText('最近行动')).toBeInTheDocument();
    expect(screen.getByText('Alice: raise $50')).toBeInTheDocument();
  });

  test('calls onPlayerAction when provided', () => {
    const mockOnPlayerAction = vi.fn();
    
    render(
      <GameTable 
        gameSnapshot={mockGameSnapshot} 
        currentUserId="player1" 
        onPlayerAction={mockOnPlayerAction}
      />
    );
    
    // This component doesn't have action buttons in this implementation
    // The test verifies the prop is accepted without errors
    expect(screen.getByTestId('player-seat-player1')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(
      <GameTable 
        gameSnapshot={mockGameSnapshot} 
        currentUserId="player1" 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('handles empty players array gracefully', () => {
    const emptySnapshot = {
      ...mockGameSnapshot,
      players: [],
      positions: []
    };

    render(<GameTable gameSnapshot={emptySnapshot} currentUserId="player1" />);
    
    // Should not crash and should still show basic structure
    expect(screen.getByText('翻牌')).toBeInTheDocument();
  });
});