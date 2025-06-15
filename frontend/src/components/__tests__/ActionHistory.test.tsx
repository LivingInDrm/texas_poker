import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActionHistory from '../ActionHistory';
import { GameAction, PlayerAction, GamePhase } from '../../types/game';

// Mock date to ensure consistent time formatting
const mockDate = new Date('2024-01-01T12:00:00Z');
const mockTimestamp = mockDate.getTime();

// Mock game actions
const createMockActions = (): GameAction[] => [
  {
    playerId: 'player1',
    action: PlayerAction.RAISE,
    amount: 100,
    timestamp: mockTimestamp - 10000,
    phase: GamePhase.PRE_FLOP
  },
  {
    playerId: 'player2',
    action: PlayerAction.CALL,
    amount: 100,
    timestamp: mockTimestamp - 8000,
    phase: GamePhase.PRE_FLOP
  },
  {
    playerId: 'player3',
    action: PlayerAction.FOLD,
    amount: 0,
    timestamp: mockTimestamp - 6000,
    phase: GamePhase.PRE_FLOP
  },
  {
    playerId: 'player1',
    action: PlayerAction.CHECK,
    amount: 0,
    timestamp: mockTimestamp - 4000,
    phase: GamePhase.FLOP
  },
  {
    playerId: 'player2',
    action: PlayerAction.ALL_IN,
    amount: 500,
    timestamp: mockTimestamp - 2000,
    phase: GamePhase.FLOP
  }
];

const mockPlayers = [
  { id: 'player1', name: 'Alice' },
  { id: 'player2', name: 'Bob' },
  { id: 'player3', name: 'Charlie' }
];

describe('ActionHistory', () => {
  it('should render action history correctly', () => {
    const actions = createMockActions();
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    expect(screen.getByText('操作历史')).toBeInTheDocument();
    expect(screen.getByText('5 条记录')).toBeInTheDocument();
  });

  it('should display actions in reverse chronological order (most recent first)', () => {
    const actions = createMockActions();
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    const actionElements = screen.getAllByText(/Alice|Bob|Charlie/);
    
    // Most recent action should be first
    expect(actionElements[0]).toHaveTextContent('Bob 全下 $500');
    expect(actionElements[1]).toHaveTextContent('Alice 过牌');
    expect(actionElements[2]).toHaveTextContent('Charlie 弃牌');
    expect(actionElements[3]).toHaveTextContent('Bob 跟注 $100');
    expect(actionElements[4]).toHaveTextContent('Alice 加注 $100');
  });

  it('should display player names correctly', () => {
    const actions = createMockActions();
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    expect(screen.getByText(/Alice 加注/)).toBeInTheDocument();
    expect(screen.getByText(/Bob 跟注/)).toBeInTheDocument();
    expect(screen.getByText(/Charlie 弃牌/)).toBeInTheDocument();
    expect(screen.getByText(/Alice 过牌/)).toBeInTheDocument();
    expect(screen.getByText(/Bob 全下/)).toBeInTheDocument();
  });

  it('should display action amounts when applicable', () => {
    const actions = createMockActions();
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    expect(screen.getByText(/Alice 加注 \$100/)).toBeInTheDocument();
    expect(screen.getByText(/Bob 跟注 \$100/)).toBeInTheDocument();
    expect(screen.getByText(/Bob 全下 \$500/)).toBeInTheDocument();
    
    // Actions without amounts should not show money
    expect(screen.getByText('Charlie 弃牌')).toBeInTheDocument();
    expect(screen.getByText('Alice 过牌')).toBeInTheDocument();
  });

  it('should display game phases correctly', () => {
    const actions = createMockActions();
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    expect(screen.getAllByText(/翻牌前/)).toBeTruthy();
    expect(screen.getAllByText(/翻牌/)).toBeTruthy();
  });

  it('should show empty state when no actions', () => {
    render(
      <ActionHistory
        actions={[]}
        players={mockPlayers}
      />
    );

    expect(screen.getByText('暂无操作记录')).toBeInTheDocument();
  });

  it('should limit displayed actions to maxItems', () => {
    const actions = createMockActions();
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
        maxItems={3}
      />
    );

    // Should show only 3 most recent actions
    expect(screen.getByText(/Bob 全下/)).toBeInTheDocument();
    expect(screen.getByText(/Alice 过牌/)).toBeInTheDocument();
    expect(screen.getByText(/Charlie 弃牌/)).toBeInTheDocument();
    
    // Should not show older actions
    expect(screen.queryByText(/Bob 跟注/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alice 加注/)).not.toBeInTheDocument();

    // Should show total count and limited display message
    expect(screen.getByText('5 条记录')).toBeInTheDocument();
    expect(screen.getByText('显示最近 3 条记录，共 5 条')).toBeInTheDocument();
  });

  it('should handle unknown player names gracefully', () => {
    const actions = [
      {
        playerId: 'unknown-player',
        action: PlayerAction.FOLD,
        amount: 0,
        timestamp: mockTimestamp,
        phase: GamePhase.PRE_FLOP
      }
    ];
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    expect(screen.getByText(/未知玩家 弃牌/)).toBeInTheDocument();
  });

  it('should apply correct color classes for different actions', () => {
    const actions = createMockActions();
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    // Test action color classes are applied
    const foldAction = screen.getByText(/Charlie 弃牌/);
    expect(foldAction).toHaveClass('text-red-400');

    const checkAction = screen.getByText(/Alice 过牌/);
    expect(checkAction).toHaveClass('text-blue-400');

    const callAction = screen.getByText(/Bob 跟注/);
    expect(callAction).toHaveClass('text-green-400');

    const raiseAction = screen.getByText(/Alice 加注/);
    expect(raiseAction).toHaveClass('text-yellow-400');

    const allInAction = screen.getByText(/Bob 全下/);
    expect(allInAction).toHaveClass('text-purple-400');
  });

  it('should render with custom className', () => {
    const actions = createMockActions();
    
    const { container } = render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should handle large amounts with proper formatting', () => {
    const actions = [
      {
        playerId: 'player1',
        action: PlayerAction.RAISE,
        amount: 1234567,
        timestamp: mockTimestamp,
        phase: GamePhase.PRE_FLOP
      }
    ];
    
    render(
      <ActionHistory
        actions={actions}
        players={mockPlayers}
      />
    );

    expect(screen.getByText(/Alice 加注 \$1,234,567/)).toBeInTheDocument();
  });

  it('should scroll when there are many actions', () => {
    const manyActions = Array.from({ length: 20 }, (_, i) => ({
      playerId: 'player1',
      action: PlayerAction.CALL,
      amount: 50,
      timestamp: mockTimestamp - i * 1000,
      phase: GamePhase.PRE_FLOP
    }));
    
    const { container } = render(
      <ActionHistory
        actions={manyActions}
        players={mockPlayers}
      />
    );

    const scrollContainer = container.querySelector('.overflow-y-auto');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveClass('max-h-48');
  });
});