import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { PokerCard, PokerCards } from '../PokerCards';
import { Suit, Rank } from '../../types/game';

describe('PokerCard', () => {
  const mockCard = {
    suit: Suit.SPADES,
    rank: Rank.ACE
  };

  test('renders a poker card with correct rank and suit', () => {
    render(<PokerCard card={mockCard} />);
    
    // Should show ace and spade symbols
    expect(screen.getAllByText('A')).toHaveLength(2); // Top and bottom
    expect(screen.getAllByText('♠')).toHaveLength(3); // Top, center, bottom
  });

  test('renders hidden card when isHidden is true', () => {
    render(<PokerCard card={mockCard} isHidden={true} />);
    
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  test('applies correct color for red suits', () => {
    const redCard = { suit: Suit.HEARTS, rank: Rank.KING };
    render(<PokerCard card={redCard} />);
    
    expect(screen.getAllByText('K')).toHaveLength(2);
    expect(screen.getAllByText('♥')).toHaveLength(3);
  });

  test('applies correct color for black suits', () => {
    const blackCard = { suit: Suit.SPADES, rank: Rank.QUEEN };
    render(<PokerCard card={blackCard} />);
    
    expect(screen.getAllByText('Q')).toHaveLength(2);
    expect(screen.getAllByText('♠')).toHaveLength(3);
  });

  test('renders different sizes correctly', () => {
    const { container: smallContainer } = render(<PokerCard card={mockCard} size="small" />);
    const { container: largeContainer } = render(<PokerCard card={mockCard} size="large" />);
    
    // Check that different size classes are applied
    expect(smallContainer.querySelector('.w-8')).toBeInTheDocument();
    expect(largeContainer.querySelector('.w-16')).toBeInTheDocument();
  });
});

describe('PokerCards', () => {
  const mockCards = [
    { suit: Suit.SPADES, rank: Rank.ACE },
    { suit: Suit.HEARTS, rank: Rank.KING },
    { suit: Suit.CLUBS, rank: Rank.QUEEN }
  ];

  test('renders multiple cards', () => {
    render(<PokerCards cards={mockCards} />);
    
    expect(screen.getAllByText('A')).toHaveLength(2); // Ace top and bottom
    expect(screen.getAllByText('K')).toHaveLength(2); // King top and bottom
    expect(screen.getAllByText('Q')).toHaveLength(2); // Queen top and bottom
  });

  test('renders all cards as hidden when isHidden is true', () => {
    render(<PokerCards cards={mockCards} isHidden={true} />);
    
    expect(screen.getAllByText('?')).toHaveLength(3);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  test('applies custom spacing', () => {
    const { container } = render(<PokerCards cards={mockCards} spacing={16} />);
    
    const cardsContainer = container.querySelector('.flex');
    expect(cardsContainer).toHaveStyle({ gap: '16px' });
  });

  test('renders empty array without errors', () => {
    render(<PokerCards cards={[]} />);
    
    // Should not throw error and should render empty container
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});