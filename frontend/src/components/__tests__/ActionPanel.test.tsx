import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ActionPanel from '../ActionPanel';
import { GameSnapshot, GamePhase, PlayerStatus, PlayerAction, Suit, Rank } from '../../types/game';

// Mock GameSnapshot for testing
const createMockGameSnapshot = (overrides: Partial<GameSnapshot> = {}): GameSnapshot => ({
  gameId: 'test-game',
  phase: GamePhase.FLOP,
  players: [
    {
      id: 'player1',
      name: 'Alice',
      chips: 1000,
      status: PlayerStatus.ACTIVE,
      cards: [
        { suit: Suit.SPADES, rank: Rank.ACE },
        { suit: Suit.HEARTS, rank: Rank.KING }
      ],
      currentBet: 50,
      totalBet: 50,
      hasActed: false,
      isReady: true
    },
    {
      id: 'player2',
      name: 'Bob',
      chips: 800,
      status: PlayerStatus.ACTIVE,
      cards: [
        { suit: Suit.CLUBS, rank: Rank.QUEEN },
        { suit: Suit.DIAMONDS, rank: Rank.JACK }
      ],
      currentBet: 100,
      totalBet: 100,
      hasActed: true,
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
      id: 'pot1',
      amount: 150,
      type: 'main',
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
      isDealer: false,
      isSmallBlind: true,
      isBigBlind: false
    },
    {
      playerId: 'player2',
      seatIndex: 1,
      isDealer: true,
      isSmallBlind: false,
      isBigBlind: false
    }
  ],
  ...overrides
});

describe('ActionPanel', () => {
  const mockOnPlayerAction = vi.fn();

  beforeEach(() => {
    mockOnPlayerAction.mockClear();
  });

  it('should render correctly when it is current player turn', () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    expect(screen.getByText('轮到你行动了！')).toBeInTheDocument();
    expect(screen.getByText('筹码:')).toBeInTheDocument();
    expect(screen.getByText('$1,000')).toBeInTheDocument();
    expect(screen.getByText('本轮下注:')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
  });

  it('should show available actions for current player', () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    // Should show fold, call, raise, all-in buttons
    expect(screen.getByText('弃牌')).toBeInTheDocument();
    expect(screen.getByText('跟注 $50')).toBeInTheDocument(); // Need to call 50 to match Bob's 100
    expect(screen.getByText(/加注/)).toBeInTheDocument();
    expect(screen.getByText(/全下/)).toBeInTheDocument();
  });

  it('should show check option when no bet to call', () => {
    const gameSnapshot = createMockGameSnapshot({
      players: [
        {
          id: 'player1',
          name: 'Alice',
          chips: 1000,
          status: PlayerStatus.ACTIVE,
          cards: [
            { suit: Suit.SPADES, rank: Rank.ACE },
            { suit: Suit.HEARTS, rank: Rank.KING }
          ],
          currentBet: 0,
          totalBet: 0,
          hasActed: false,
          isReady: true
        },
        {
          id: 'player2',
          name: 'Bob',
          chips: 800,
          status: PlayerStatus.ACTIVE,
          cards: [
            { suit: Suit.CLUBS, rank: Rank.QUEEN },
            { suit: Suit.DIAMONDS, rank: Rank.JACK }
          ],
          currentBet: 0,
          totalBet: 0,
          hasActed: true,
          isReady: true
        }
      ]
    });
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    expect(screen.getByText('过牌')).toBeInTheDocument();
  });

  it('should handle fold action', async () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const foldButton = screen.getByText('弃牌');
    fireEvent.click(foldButton);

    // Should show confirmation
    expect(screen.getByText('确认弃牌')).toBeInTheDocument();

    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnPlayerAction).toHaveBeenCalledWith(PlayerAction.FOLD, 0);
    });
  });

  it('should handle call action', async () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const callButton = screen.getByText('跟注 $50');
    fireEvent.click(callButton);

    // Should show confirmation
    expect(screen.getByText('确认跟注')).toBeInTheDocument();
    expect(screen.getByText('跟注 $50')).toBeInTheDocument();

    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnPlayerAction).toHaveBeenCalledWith(PlayerAction.CALL, 0);
    });
  });

  it('should handle raise action with amount selection', async () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const raiseButton = screen.getByText(/加注/);
    fireEvent.click(raiseButton);

    // Should show raise amount controls
    expect(screen.getByText('加注金额')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(70); // Min raise should be 70 (50 call + 20 big blind)

    // Change raise amount using the number input
    const amountInput = screen.getByRole('spinbutton');
    fireEvent.change(amountInput, { target: { value: '200' } });

    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnPlayerAction).toHaveBeenCalledWith(PlayerAction.RAISE, 200);
    });
  });

  it('should handle all-in action', async () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const allInButton = screen.getByText(/全下/);
    fireEvent.click(allInButton);

    // Should show confirmation
    expect(screen.getByText('确认全下')).toBeInTheDocument();

    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnPlayerAction).toHaveBeenCalledWith(PlayerAction.ALL_IN, 0);
    });
  });

  it('should show waiting message when not current player turn', () => {
    const gameSnapshot = createMockGameSnapshot({
      currentPlayerId: 'player2'
    });
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    expect(screen.getByText('等待 Bob 行动...')).toBeInTheDocument();
  });

  it('should not render when game is not active', () => {
    const gameSnapshot = createMockGameSnapshot({
      phase: GamePhase.WAITING
    });
    
    const { container } = render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should cancel action confirmation', () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const foldButton = screen.getByText('弃牌');
    fireEvent.click(foldButton);

    // Should show confirmation
    expect(screen.getByText('确认弃牌')).toBeInTheDocument();

    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);

    // Should hide confirmation
    expect(screen.queryByText('确认弃牌')).not.toBeInTheDocument();
    expect(mockOnPlayerAction).not.toHaveBeenCalled();
  });

  it('should use raise slider correctly', () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const raiseButton = screen.getByText(/加注/);
    fireEvent.click(raiseButton);

    // Should show slider
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();

    // Change slider value
    fireEvent.change(slider, { target: { value: '500' } });

    // Should update the input
    expect(screen.getByRole('spinbutton')).toHaveValue(500);
  });

  it('should use quick raise buttons', () => {
    const gameSnapshot = createMockGameSnapshot();
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const raiseButton = screen.getByText(/加注/);
    fireEvent.click(raiseButton);

    // Should show quick buttons
    expect(screen.getByText('最小')).toBeInTheDocument();
    expect(screen.getByText('1/2池')).toBeInTheDocument();
    expect(screen.getByText('3/4池')).toBeInTheDocument();
    expect(screen.getByText('全下')).toBeInTheDocument();

    // Click half pot button
    const halfPotButton = screen.getByText('1/2池');
    fireEvent.click(halfPotButton);

    // Should update amount to half of max (525)
    expect(screen.getByRole('spinbutton')).toHaveValue(525);
  });

  it('should limit raise amount to available chips', () => {
    const gameSnapshot = createMockGameSnapshot({
      players: [
        {
          id: 'player1',
          name: 'Alice',
          chips: 100, // Low chips
          status: PlayerStatus.ACTIVE,
          cards: [
            { suit: Suit.SPADES, rank: Rank.ACE },
            { suit: Suit.HEARTS, rank: Rank.KING }
          ],
          currentBet: 50,
          totalBet: 50,
          hasActed: false,
          isReady: true
        },
        {
          id: 'player2',
          name: 'Bob',
          chips: 800,
          status: PlayerStatus.ACTIVE,
          cards: [
            { suit: Suit.CLUBS, rank: Rank.QUEEN },
            { suit: Suit.DIAMONDS, rank: Rank.JACK }
          ],
          currentBet: 100,
          totalBet: 100,
          hasActed: true,
          isReady: true
        }
      ]
    });
    
    render(
      <ActionPanel
        gameSnapshot={gameSnapshot}
        currentUserId="player1"
        onPlayerAction={mockOnPlayerAction}
      />
    );

    const raiseButton = screen.getByText(/加注/);
    fireEvent.click(raiseButton);

    // Max amount should be limited to available chips + current bet (150)
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('max', '150');
  });
});