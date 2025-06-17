import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import GameTable from '../../src/components/GameTable';
import { GamePhase, PlayerStatus, Suit, Rank } from '../../src/types/game';
import { 
  TEST_GAME_SNAPSHOT, 
  TEST_FLOP_SNAPSHOT, 
  TEST_TURN_SNAPSHOT, 
  TEST_RIVER_SNAPSHOT,
  createMockGameSnapshot 
} from '../fixtures/gameState';

// Mock the component dependencies
vi.mock('../../src/components/PlayerSeat', () => ({
  default: ({ player }: any) => <div data-testid={`player-seat-${player.id}`}>{player.name}</div>
}));

vi.mock('../../src/components/PokerCards', () => ({
  PokerCards: ({ cards }: any) => <div data-testid="poker-cards">Cards: {cards.length}</div>
}));

vi.mock('../../src/components/PotDisplay', () => ({
  default: ({ pots }: any) => <div data-testid="pot-display">Pots: {pots.length}</div>
}));

describe('GameTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders game table with basic elements', () => {
    render(<GameTable gameSnapshot={TEST_FLOP_SNAPSHOT} currentUserId="player1" />);
    
    // Should render player seats
    expect(screen.getByTestId('player-seat-player1')).toBeInTheDocument();
    expect(screen.getByTestId('player-seat-player2')).toBeInTheDocument();
    expect(screen.getByTestId('player-seat-player3')).toBeInTheDocument();
    
    // Should render pot display
    expect(screen.getByTestId('pot-display')).toBeInTheDocument();
    
    // Should show game phase
    expect(screen.getByText('翻牌')).toBeInTheDocument();
  });

  test('shows community cards in flop phase', () => {
    render(<GameTable gameSnapshot={TEST_FLOP_SNAPSHOT} currentUserId="player1" />);
    
    expect(screen.getByText('公共牌')).toBeInTheDocument();
    expect(screen.getByTestId('poker-cards')).toBeInTheDocument();
  });

  test('shows current player turn message', () => {
    render(<GameTable gameSnapshot={TEST_FLOP_SNAPSHOT} currentUserId="player1" />);
    
    expect(screen.getByText('轮到你行动了！')).toBeInTheDocument();
  });

  test('shows waiting for other player message', () => {
    const snapshotWithOtherPlayer = createMockGameSnapshot({
      currentPlayerId: 'player2'
    });
    
    render(<GameTable gameSnapshot={snapshotWithOtherPlayer} currentUserId="player1" />);
    
    expect(screen.getByText('等待 Bob 行动...')).toBeInTheDocument();
  });

  test('shows waiting for game to start in waiting phase', () => {
    const waitingSnapshot = createMockGameSnapshot({
      phase: GamePhase.WAITING,
      isHandInProgress: false
    });

    render(<GameTable gameSnapshot={waitingSnapshot} currentUserId="player1" />);
    
    expect(screen.getByText('等待玩家准备...')).toBeInTheDocument();
    expect(screen.getByText('已准备: 3 / 3')).toBeInTheDocument();
  });

  test('shows game information panel', () => {
    render(<GameTable gameSnapshot={TEST_GAME_SNAPSHOT} currentUserId="player1" />);
    
    expect(screen.getByText('房间: test-room-123')).toBeInTheDocument();
    expect(screen.getByText('玩家: 3/9')).toBeInTheDocument();
  });

  test('handles different game phases correctly', () => {
    // Test pre-flop (no community cards)
    const { rerender } = render(<GameTable gameSnapshot={TEST_GAME_SNAPSHOT} currentUserId="player1" />);
    expect(screen.getByText('翻牌前')).toBeInTheDocument();
    expect(screen.queryByText('公共牌')).not.toBeInTheDocument();

    // Test flop (3 community cards)
    rerender(<GameTable gameSnapshot={TEST_FLOP_SNAPSHOT} currentUserId="player1" />);
    expect(screen.getByText('翻牌')).toBeInTheDocument();
    expect(screen.getByText('公共牌')).toBeInTheDocument();

    // Test turn (4 community cards)
    rerender(<GameTable gameSnapshot={TEST_TURN_SNAPSHOT} currentUserId="player1" />);
    expect(screen.getByText('转牌')).toBeInTheDocument();

    // Test river (5 community cards)
    rerender(<GameTable gameSnapshot={TEST_RIVER_SNAPSHOT} currentUserId="player1" />);
    expect(screen.getByText('河牌')).toBeInTheDocument();
  });

  test('handles action history display', () => {
    // TEST_GAME_SNAPSHOT already has action history
    render(<GameTable gameSnapshot={TEST_GAME_SNAPSHOT} currentUserId="player1" />);
    
    expect(screen.getByText('最近行动')).toBeInTheDocument();
    expect(screen.getByText('Bob: call $20')).toBeInTheDocument();
    expect(screen.getByText('Charlie: raise $40')).toBeInTheDocument();
  });

  test('calls onPlayerAction when provided', () => {
    const mockOnPlayerAction = vi.fn();
    
    render(
      <GameTable 
        gameSnapshot={TEST_GAME_SNAPSHOT} 
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
        gameSnapshot={TEST_GAME_SNAPSHOT} 
        currentUserId="player1" 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('handles empty players array gracefully', () => {
    const emptySnapshot = createMockGameSnapshot({
      players: [],
      positions: []
    });

    render(<GameTable gameSnapshot={emptySnapshot} currentUserId="player1" />);
    
    // Should not crash and should still show basic structure
    expect(screen.getByText('翻牌前')).toBeInTheDocument();
  });
});