/**
 * 游戏测试数据固定装置
 * 提供标准的测试数据集
 */

import { Card } from '@/game/Card';
import { Player } from '@/types/socket';

export const TEST_CARDS = {
  // 皇家同花顺
  ROYAL_FLUSH: [
    new Card('hearts', 'A'),
    new Card('hearts', 'K'),
    new Card('hearts', 'Q'),
    new Card('hearts', 'J'),
    new Card('hearts', '10')
  ],
  
  // 同花顺
  STRAIGHT_FLUSH: [
    new Card('spades', '9'),
    new Card('spades', '8'),
    new Card('spades', '7'),
    new Card('spades', '6'),
    new Card('spades', '5')
  ],

  // 四条
  FOUR_OF_A_KIND: [
    new Card('hearts', 'A'),
    new Card('spades', 'A'),
    new Card('clubs', 'A'),
    new Card('diamonds', 'A'),
    new Card('hearts', 'K')
  ],

  // 葫芦
  FULL_HOUSE: [
    new Card('hearts', 'K'),
    new Card('spades', 'K'),
    new Card('clubs', 'K'),
    new Card('diamonds', 'Q'),
    new Card('hearts', 'Q')
  ],

  // 对子
  PAIR: [
    new Card('hearts', 'A'),
    new Card('spades', 'A'),
    new Card('clubs', 'K'),
    new Card('diamonds', 'Q'),
    new Card('hearts', 'J')
  ]
};

export const TEST_PLAYERS = {
  ALICE: {
    id: 'alice_123',
    name: 'Alice',
    chips: 1000,
    currentBet: 0,
    hasActed: false,
    isAllIn: false,
    hasFolded: false,
    cards: [],
    position: 0,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    timeoutId: null,
    isActive: true
  } as Player,

  BOB: {
    id: 'bob_456',
    name: 'Bob',
    chips: 1500,
    currentBet: 0,
    hasActed: false,
    isAllIn: false,
    hasFolded: false,
    cards: [],
    position: 1,
    isDealer: false,
    isSmallBlind: true,
    isBigBlind: false,
    timeoutId: null,
    isActive: true
  } as Player,

  CHARLIE: {
    id: 'charlie_789',
    name: 'Charlie',
    chips: 2000,
    currentBet: 0,
    hasActed: false,
    isAllIn: false,
    hasFolded: false,
    cards: [],
    position: 2,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: true,
    timeoutId: null,
    isActive: true
  } as Player
};

export const TEST_ROOM_CONFIG = {
  DEFAULT: {
    roomId: 'test_room_123',
    smallBlind: 10,
    bigBlind: 20,
    maxPlayers: 6,
    buyIn: 1000
  },

  HIGH_STAKES: {
    roomId: 'high_stakes_room',
    smallBlind: 100,
    bigBlind: 200,
    maxPlayers: 9,
    buyIn: 10000
  }
};