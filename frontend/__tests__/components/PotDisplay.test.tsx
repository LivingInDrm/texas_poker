import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import PotDisplay from '../../src/components/PotDisplay';

describe('PotDisplay', () => {
  test('renders empty pot when no pots provided', () => {
    render(<PotDisplay pots={[]} />);
    
    expect(screen.getByText('底池')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  test('renders single pot correctly', () => {
    const pots = [
      {
        id: 'pot-1',
        amount: 1000,
        type: 'main' as const,
        eligiblePlayers: ['player1', 'player2', 'player3']
      }
    ];

    render(<PotDisplay pots={pots} />);
    
    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  test('renders multiple pots with details', () => {
    const pots = [
      {
        id: 'pot-1',
        amount: 600,
        type: 'main' as const,
        eligiblePlayers: ['player1', 'player2', 'player3']
      },
      {
        id: 'pot-2',
        amount: 400,
        type: 'side' as const,
        eligiblePlayers: ['player2', 'player3']
      }
    ];

    render(<PotDisplay pots={pots} />);
    
    // Total pot
    expect(screen.getByText('$1,000')).toBeInTheDocument();
    
    // Individual pot details
    expect(screen.getByText(/主池.*600/)).toBeInTheDocument();
    expect(screen.getByText(/边池.*400/)).toBeInTheDocument();
  });

  test('shows player count for limited pots', () => {
    const pots = [
      {
        id: 'pot-1',
        amount: 200,
        type: 'main' as const,
        eligiblePlayers: ['player1', 'player2', 'player3']
      },
      {
        id: 'pot-2',
        amount: 100,
        type: 'side' as const,
        eligiblePlayers: ['player1', 'player2'] // Less than 4 players
      }
    ];

    render(<PotDisplay pots={pots} />);
    
    expect(screen.getByText(/\(2人\)/)).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<PotDisplay pots={[]} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('formats large numbers with commas', () => {
    const pots = [
      {
        id: 'pot-1',
        amount: 123456,
        type: 'main' as const,
        eligiblePlayers: ['player1']
      }
    ];

    render(<PotDisplay pots={pots} />);
    
    expect(screen.getByText('$123,456')).toBeInTheDocument();
  });
});