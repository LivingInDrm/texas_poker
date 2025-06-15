import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ResultModal } from '../ResultModal';
import { GameResult, GamePlayer, Suit, Rank, PlayerStatus } from '../../types/game';

const mockGameResult: GameResult = {
  winners: [
    {
      playerId: 'player1',
      hand: {
        type: 'pair',
        name: '一对K',
        cards: [
          { suit: Suit.SPADES, rank: Rank.KING },
          { suit: Suit.HEARTS, rank: Rank.KING },
          { suit: Suit.CLUBS, rank: Rank.ACE },
          { suit: Suit.DIAMONDS, rank: Rank.QUEEN },
          { suit: Suit.SPADES, rank: Rank.JACK }
        ],
        rank: 2
      },
      winAmount: 200,
      potIds: ['main']
    }
  ],
  pots: [
    {
      id: 'main',
      amount: 200,
      winnerIds: ['player1']
    }
  ],
  actions: [],
  duration: 120000
};

const mockPlayers: GamePlayer[] = [
  {
    id: 'player1',
    name: 'Alice',
    chips: 1500,
    status: PlayerStatus.ACTIVE,
    cards: [
      { suit: Suit.SPADES, rank: Rank.KING },
      { suit: Suit.HEARTS, rank: Rank.KING }
    ],
    currentBet: 0,
    totalBet: 50,
    hasActed: true,
    isReady: true
  },
  {
    id: 'player2',
    name: 'Bob',
    chips: 800,
    status: PlayerStatus.FOLDED,
    cards: [],
    currentBet: 0,
    totalBet: 25,
    hasActed: true,
    isReady: true
  }
];

describe('ResultModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    gameResult: mockGameResult,
    players: mockPlayers,
    onNextGame: vi.fn(),
    onBackToLobby: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(<ResultModal {...mockProps} />);
    
    expect(screen.getByText('游戏结算')).toBeInTheDocument();
    expect(screen.getByText('获胜者')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<ResultModal {...mockProps} isOpen={false} />);
    
    expect(screen.queryByText('游戏结算')).not.toBeInTheDocument();
  });

  it('should not render when gameResult is null', () => {
    render(<ResultModal {...mockProps} gameResult={null} />);
    
    expect(screen.queryByText('游戏结算')).not.toBeInTheDocument();
  });

  it('should display winner information correctly', () => {
    render(<ResultModal {...mockProps} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('冠军')).toBeInTheDocument();
    expect(screen.getByText('+200')).toBeInTheDocument();
    expect(screen.getByText('一对')).toBeInTheDocument();
  });

  it('should display all players summary', () => {
    render(<ResultModal {...mockProps} />);
    
    expect(screen.getByText('所有玩家')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('已弃牌')).toBeInTheDocument();
  });

  it('should display pot distribution', () => {
    render(<ResultModal {...mockProps} />);
    
    expect(screen.getByText('奖池分配')).toBeInTheDocument();
    expect(screen.getByText('主池')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<ResultModal {...mockProps} />);
    
    const closeButton = screen.getByLabelText(/close/i) || screen.getByRole('button', { name: /×/i });
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onNextGame when next game button is clicked', () => {
    render(<ResultModal {...mockProps} />);
    
    const nextGameButton = screen.getByText('再来一局');
    fireEvent.click(nextGameButton);
    
    expect(mockProps.onNextGame).toHaveBeenCalledTimes(1);
  });

  it('should call onBackToLobby when back to lobby button is clicked', () => {
    render(<ResultModal {...mockProps} />);
    
    const backButton = screen.getByText('返回大厅');
    fireEvent.click(backButton);
    
    expect(mockProps.onBackToLobby).toHaveBeenCalledTimes(1);
  });

  it('should format hand types correctly', () => {
    const customGameResult: GameResult = {
      ...mockGameResult,
      winners: [
        {
          ...mockGameResult.winners[0],
          hand: {
            type: 'straight_flush',
            name: '同花顺',
            cards: [],
            rank: 8
          }
        }
      ]
    };

    render(<ResultModal {...mockProps} gameResult={customGameResult} />);
    
    expect(screen.getByText('同花顺')).toBeInTheDocument();
  });

  it('should display chip changes correctly', () => {
    render(<ResultModal {...mockProps} />);
    
    // Winner should show positive change
    const aliceSection = screen.getByText('Alice').closest('div');
    expect(aliceSection).toBeInTheDocument();
    
    // Loser should show no change (folded)
    const bobSection = screen.getByText('Bob').closest('div');
    expect(bobSection).toBeInTheDocument();
  });

  it('should handle multiple winners', () => {
    const multiWinnerResult: GameResult = {
      ...mockGameResult,
      winners: [
        {
          playerId: 'player1',
          hand: mockGameResult.winners[0].hand,
          winAmount: 100,
          potIds: ['main']
        },
        {
          playerId: 'player2',
          hand: {
            type: 'pair',
            name: '一对Q',
            cards: [],
            rank: 2
          },
          winAmount: 100,
          potIds: ['side']
        }
      ],
      pots: [
        { id: 'main', amount: 100, winnerIds: ['player1'] },
        { id: 'side', amount: 100, winnerIds: ['player2'] }
      ]
    };

    render(<ResultModal {...mockProps} gameResult={multiWinnerResult} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getAllByText('+100')).toHaveLength(2);
  });

  it('should handle empty pots array', () => {
    const noPotResult: GameResult = {
      ...mockGameResult,
      pots: []
    };

    render(<ResultModal {...mockProps} gameResult={noPotResult} />);
    
    expect(screen.queryByText('奖池分配')).not.toBeInTheDocument();
  });

  it('should handle players with no cards', () => {
    const playersWithoutCards: GamePlayer[] = [
      {
        ...mockPlayers[0],
        cards: []
      },
      ...mockPlayers.slice(1)
    ];

    render(<ResultModal {...mockProps} players={playersWithoutCards} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // Should still display player info even without cards
  });
});