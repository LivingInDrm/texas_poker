import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import PlayerSeat from '../../src/components/PlayerSeat';
import { PlayerStatus, Suit, Rank } from '../../src/types/game';

describe('PlayerSeat', () => {
  const mockPlayer = {
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
    lastAction: 'raise' as any
  };

  const mockPosition = {
    playerId: 'player1',
    seatIndex: 0,
    isDealer: true,
    isSmallBlind: false,
    isBigBlind: false
  };

  test('renders player basic information', () => {
    render(<PlayerSeat player={mockPlayer} position={mockPosition} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('$1,500')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument(); // Player avatar initial
  });

  test('shows position badges correctly', () => {
    // Test dealer badge
    render(<PlayerSeat player={mockPlayer} position={mockPosition} />);
    expect(screen.getByText('D')).toBeInTheDocument();

    // Test small blind badge
    const sbPosition = { ...mockPosition, isDealer: false, isSmallBlind: true };
    const { rerender } = render(<PlayerSeat player={mockPlayer} position={sbPosition} />);
    rerender(<PlayerSeat player={mockPlayer} position={sbPosition} />);
    expect(screen.getByText('SB')).toBeInTheDocument();

    // Test big blind badge
    const bbPosition = { ...mockPosition, isDealer: false, isBigBlind: true };
    rerender(<PlayerSeat player={mockPlayer} position={bbPosition} />);
    expect(screen.getByText('BB')).toBeInTheDocument();
  });

  test('displays current and total bets', () => {
    render(<PlayerSeat player={mockPlayer} position={mockPosition} />);
    
    expect(screen.getByText('本轮:')).toBeInTheDocument();
    expect(screen.getAllByText('$50')).toHaveLength(2); // Both in info and floating chip
    expect(screen.getByText('总计:')).toBeInTheDocument();
    expect(screen.getByText('$70')).toBeInTheDocument();
  });

  test('shows last action', () => {
    render(<PlayerSeat player={mockPlayer} position={mockPosition} />);
    
    expect(screen.getByText('加注')).toBeInTheDocument();
  });

  test('highlights current player', () => {
    const { container } = render(
      <PlayerSeat player={mockPlayer} position={mockPosition} isCurrentPlayer={true} />
    );
    
    expect(container.querySelector('.border-green-500')).toBeInTheDocument();
    expect(container.querySelector('.shadow-lg')).toBeInTheDocument();
  });

  test('shows time remaining for current player', () => {
    render(
      <PlayerSeat 
        player={mockPlayer} 
        position={mockPosition} 
        isCurrentPlayer={true}
        timeRemaining={15}
      />
    );
    
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  test('shows cards when showCards is true', () => {
    render(<PlayerSeat player={mockPlayer} position={mockPosition} showCards={true} />);
    
    // Should show actual cards - check for poker card suits to distinguish from avatar
    expect(screen.getByText('♠')).toBeInTheDocument(); // Spade suit
    expect(screen.getByText('♥')).toBeInTheDocument(); // Heart suit
    // Verify both card ranks are present (using getAllByText since avatar also shows 'A')
    const aceElements = screen.getAllByText('A');
    const kingElements = screen.getAllByText('K');
    expect(aceElements.length).toBeGreaterThanOrEqual(1);
    expect(kingElements.length).toBeGreaterThanOrEqual(1);
  });

  test('hides cards when showCards is false', () => {
    render(<PlayerSeat player={mockPlayer} position={mockPosition} showCards={false} />);
    
    // Should show hidden cards
    expect(screen.getAllByText('?')).toHaveLength(2);
  });

  test('handles folded player correctly', () => {
    const foldedPlayer = { ...mockPlayer, status: PlayerStatus.FOLDED };
    const { container } = render(<PlayerSeat player={foldedPlayer} position={mockPosition} />);
    
    expect(screen.getByText('弃牌')).toBeInTheDocument();
    expect(container.querySelector('.opacity-60')).toBeInTheDocument();
  });

  test('handles all-in player correctly', () => {
    const allInPlayer = { ...mockPlayer, status: PlayerStatus.ALL_IN };
    const { container } = render(<PlayerSeat player={allInPlayer} position={mockPosition} />);
    
    expect(screen.getByText('全下')).toBeInTheDocument();
    expect(container.querySelector('.border-red-500')).toBeInTheDocument();
  });

  test('handles sitting out player correctly', () => {
    const sittingOutPlayer = { ...mockPlayer, status: PlayerStatus.SITTING_OUT };
    const { container } = render(<PlayerSeat player={sittingOutPlayer} position={mockPosition} />);
    
    expect(screen.getByText('暂离')).toBeInTheDocument();
    expect(container.querySelector('.opacity-40')).toBeInTheDocument();
  });

  test('shows bet chips outside the seat', () => {
    render(<PlayerSeat player={mockPlayer} position={mockPosition} />);
    
    // Should show current bet as floating chip (appears twice - in info and floating)
    expect(screen.getAllByText('$50')).toHaveLength(2);
  });

  test('handles player with no cards', () => {
    const playerNoCards = { ...mockPlayer, cards: [] };
    render(<PlayerSeat player={playerNoCards} position={mockPosition} />);
    
    // Should not show any card related content
    expect(screen.queryByText('?')).not.toBeInTheDocument();
  });

  test('handles player with no current bet', () => {
    const playerNoBet = { ...mockPlayer, currentBet: 0 };
    render(<PlayerSeat player={playerNoBet} position={mockPosition} />);
    
    // Should not show current bet section
    expect(screen.queryByText(/本轮/)).not.toBeInTheDocument();
  });
});