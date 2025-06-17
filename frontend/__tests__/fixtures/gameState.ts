/**
 * 前端游戏状态测试数据
 */

import { 
  GameSnapshot, 
  GamePlayer, 
  Card, 
  Pot, 
  PlayerPosition,
  GameAction,
  GamePhase,
  PlayerStatus,
  PlayerAction,
  Suit,
  Rank
} from '../../src/types/game';

export const TEST_CARDS: Card[] = [
  { suit: Suit.HEARTS, rank: Rank.ACE },
  { suit: Suit.SPADES, rank: Rank.KING },
  { suit: Suit.DIAMONDS, rank: Rank.QUEEN },
  { suit: Suit.CLUBS, rank: Rank.JACK },
  { suit: Suit.HEARTS, rank: Rank.TEN }
];

export const TEST_PLAYERS: GamePlayer[] = [
  {
    id: 'player1',
    name: 'Alice',
    chips: 1000,
    status: PlayerStatus.ACTIVE,
    cards: [],
    currentBet: 0,
    totalBet: 0,
    hasActed: false,
    isReady: true
  },
  {
    id: 'player2',
    name: 'Bob',
    chips: 1500,
    status: PlayerStatus.ACTIVE,
    cards: [],
    currentBet: 20,
    totalBet: 20,
    hasActed: true,
    isReady: true
  },
  {
    id: 'player3',
    name: 'Charlie',
    chips: 2000,
    status: PlayerStatus.ACTIVE,
    cards: [],
    currentBet: 40,
    totalBet: 40,
    hasActed: true,
    isReady: true
  }
];

export const TEST_POSITIONS: PlayerPosition[] = [
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
  },
  {
    playerId: 'player3',
    seatIndex: 2,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: true
  }
];

export const TEST_POTS: Pot[] = [
  {
    id: 'pot-main',
    amount: 60,
    type: 'main',
    eligiblePlayers: ['player1', 'player2', 'player3']
  }
];

export const TEST_ACTIONS: GameAction[] = [
  {
    playerId: 'player2',
    action: PlayerAction.CALL,
    amount: 20,
    timestamp: Date.now() - 10000,
    phase: GamePhase.PRE_FLOP
  },
  {
    playerId: 'player3',
    action: PlayerAction.RAISE,
    amount: 40,
    timestamp: Date.now() - 5000,
    phase: GamePhase.PRE_FLOP
  }
];

export const TEST_GAME_SNAPSHOT: GameSnapshot = {
  gameId: 'test-room-123',
  phase: GamePhase.PRE_FLOP,
  players: TEST_PLAYERS,
  communityCards: [],
  pots: TEST_POTS,
  currentPlayerId: 'player1',
  actionHistory: TEST_ACTIONS,
  isHandInProgress: true,
  positions: TEST_POSITIONS,
  dealerIndex: 0,
  smallBlindIndex: 1,
  bigBlindIndex: 2
};

export const TEST_FLOP_SNAPSHOT: GameSnapshot = {
  ...TEST_GAME_SNAPSHOT,
  phase: GamePhase.FLOP,
  communityCards: [
    { suit: Suit.SPADES, rank: Rank.TEN },
    { suit: Suit.HEARTS, rank: Rank.NINE },
    { suit: Suit.CLUBS, rank: Rank.EIGHT }
  ]
};

export const TEST_TURN_SNAPSHOT: GameSnapshot = {
  ...TEST_FLOP_SNAPSHOT,
  phase: GamePhase.TURN,
  communityCards: [
    ...TEST_FLOP_SNAPSHOT.communityCards,
    { suit: Suit.DIAMONDS, rank: Rank.SEVEN }
  ]
};

export const TEST_RIVER_SNAPSHOT: GameSnapshot = {
  ...TEST_TURN_SNAPSHOT,
  phase: GamePhase.RIVER,
  communityCards: [
    ...TEST_TURN_SNAPSHOT.communityCards,
    { suit: Suit.HEARTS, rank: Rank.SIX }
  ]
};

// 房间状态Mock（用于非游戏测试）
export const MOCK_ROOM_STATE = {
  id: 'test-room-123',
  name: 'Test Room',
  ownerId: 'player1',
  players: TEST_PLAYERS,
  maxPlayers: 6,
  currentPlayerCount: 3,
  gameStarted: true,
  smallBlind: 10,
  bigBlind: 20,
  status: 'in_progress' as const,
  hasPassword: false
};

// 简化的Mock工厂函数
export const createMockGameSnapshot = (overrides: Partial<GameSnapshot> = {}): GameSnapshot => ({
  ...TEST_GAME_SNAPSHOT,
  ...overrides
});

export const createMockPlayer = (overrides: Partial<GamePlayer> = {}): GamePlayer => ({
  id: 'test-player',
  name: 'Test Player',
  chips: 1000,
  status: PlayerStatus.ACTIVE,
  cards: [],
  currentBet: 0,
  totalBet: 0,
  hasActed: false,
  isReady: true,
  ...overrides
});

export const createMockCard = (overrides: Partial<Card> = {}): Card => ({
  suit: Suit.HEARTS,
  rank: Rank.ACE,
  ...overrides
});

export const createMockPot = (overrides: Partial<Pot> = {}): Pot => ({
  id: 'test-pot',
  amount: 100,
  type: 'main',
  eligiblePlayers: ['player1'],
  ...overrides
});