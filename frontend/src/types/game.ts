/**
 * 游戏相关的TypeScript类型定义
 * 与后端game模块的类型保持一致
 */

/**
 * 扑克牌花色枚举
 */
export enum Suit {
  SPADES = 'SPADES',     // 黑桃 ♠
  HEARTS = 'HEARTS',     // 红桃 ♥
  DIAMONDS = 'DIAMONDS', // 方块 ♦
  CLUBS = 'CLUBS'        // 梅花 ♣
}

/**
 * 扑克牌点数枚举
 */
export enum Rank {
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
  ACE = 14
}

/**
 * 扑克牌接口
 */
export interface Card {
  suit: Suit;
  rank: Rank;
}

/**
 * 游戏阶段枚举
 */
export enum GamePhase {
  WAITING = 'waiting',
  PRE_FLOP = 'pre_flop',
  FLOP = 'flop',
  TURN = 'turn',
  RIVER = 'river',
  SHOWDOWN = 'showdown',
  FINISHED = 'finished'
}

/**
 * 玩家操作类型
 */
export enum PlayerAction {
  FOLD = 'fold',
  CHECK = 'check',
  CALL = 'call',
  RAISE = 'raise',
  ALL_IN = 'all_in'
}

/**
 * 玩家状态
 */
export enum PlayerStatus {
  ACTIVE = 'active',
  FOLDED = 'folded',
  ALL_IN = 'all_in',
  SITTING_OUT = 'sitting_out'
}

/**
 * 游戏中的玩家信息
 */
export interface GamePlayer {
  id: string;
  name: string;
  chips: number;
  status: PlayerStatus;
  cards: Card[];
  currentBet: number;
  totalBet: number;
  hasActed: boolean;
  isReady: boolean;
  lastAction?: PlayerAction;
  timeoutAt?: number;
}

/**
 * 玩家位置信息
 */
export interface PlayerPosition {
  playerId: string;
  seatIndex: number;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}

/**
 * 筹码池信息
 */
export interface Pot {
  id: string;
  amount: number;
  type: 'main' | 'side';
  eligiblePlayers: string[];
}

/**
 * 游戏操作记录
 */
export interface GameAction {
  playerId: string;
  action: PlayerAction;
  amount: number;
  timestamp: number;
  phase: GamePhase;
}

/**
 * 游戏状态快照
 */
export interface GameSnapshot {
  gameId: string;
  phase: GamePhase;
  players: GamePlayer[];
  communityCards: Card[];
  pots: Pot[];
  currentPlayerId: string | null;
  actionHistory: GameAction[];
  isHandInProgress: boolean;
  positions: PlayerPosition[];
}

/**
 * 牌型信息（简化版）
 */
export interface HandRank {
  type: string;
  name: string;
  cards: Card[];
  rank: number;
}

/**
 * 游戏结果
 */
export interface GameResult {
  winners: Array<{
    playerId: string;
    hand: HandRank | null;
    winAmount: number;
    potIds: string[];
  }>;
  pots: Array<{
    id: string;
    amount: number;
    winnerIds: string[];
  }>;
  actions: GameAction[];
  duration: number;
}

/**
 * 花色符号映射
 */
export const SUIT_SYMBOLS = {
  [Suit.SPADES]: '♠',
  [Suit.HEARTS]: '♥',
  [Suit.DIAMONDS]: '♦',
  [Suit.CLUBS]: '♣'
} as const;

/**
 * 点数名称映射
 */
export const RANK_NAMES = {
  [Rank.TWO]: '2',
  [Rank.THREE]: '3',
  [Rank.FOUR]: '4',
  [Rank.FIVE]: '5',
  [Rank.SIX]: '6',
  [Rank.SEVEN]: '7',
  [Rank.EIGHT]: '8',
  [Rank.NINE]: '9',
  [Rank.TEN]: '10',
  [Rank.JACK]: 'J',
  [Rank.QUEEN]: 'Q',
  [Rank.KING]: 'K',
  [Rank.ACE]: 'A'
} as const;

/**
 * 游戏阶段名称映射
 */
export const PHASE_NAMES = {
  [GamePhase.WAITING]: '等待开始',
  [GamePhase.PRE_FLOP]: '翻牌前',
  [GamePhase.FLOP]: '翻牌',
  [GamePhase.TURN]: '转牌',
  [GamePhase.RIVER]: '河牌',
  [GamePhase.SHOWDOWN]: '摊牌',
  [GamePhase.FINISHED]: '游戏结束'
} as const;

/**
 * 玩家操作名称映射
 */
export const ACTION_NAMES = {
  [PlayerAction.FOLD]: '弃牌',
  [PlayerAction.CHECK]: '过牌',
  [PlayerAction.CALL]: '跟注',
  [PlayerAction.RAISE]: '加注',
  [PlayerAction.ALL_IN]: '全下'
} as const;