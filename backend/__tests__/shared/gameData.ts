/**
 * 游戏测试数据固定装置
 * 提供标准的测试数据集
 */

import { Card, Suit, Rank } from '@/game/Card';
import { RoomPlayer } from '@/types/socket';

export const TEST_CARDS = {
  // 皇家同花顺
  ROYAL_FLUSH: [
    new Card(Suit.HEARTS, Rank.ACE),
    new Card(Suit.HEARTS, Rank.KING),
    new Card(Suit.HEARTS, Rank.QUEEN),
    new Card(Suit.HEARTS, Rank.JACK),
    new Card(Suit.HEARTS, Rank.TEN)
  ],
  
  // 同花顺
  STRAIGHT_FLUSH: [
    new Card(Suit.SPADES, Rank.NINE),
    new Card(Suit.SPADES, Rank.EIGHT),
    new Card(Suit.SPADES, Rank.SEVEN),
    new Card(Suit.SPADES, Rank.SIX),
    new Card(Suit.SPADES, Rank.FIVE)
  ],

  // 四条
  FOUR_OF_A_KIND: [
    new Card(Suit.HEARTS, Rank.ACE),
    new Card(Suit.SPADES, Rank.ACE),
    new Card(Suit.CLUBS, Rank.ACE),
    new Card(Suit.DIAMONDS, Rank.ACE),
    new Card(Suit.HEARTS, Rank.KING)
  ],

  // 葫芦
  FULL_HOUSE: [
    new Card(Suit.HEARTS, Rank.KING),
    new Card(Suit.SPADES, Rank.KING),
    new Card(Suit.CLUBS, Rank.KING),
    new Card(Suit.DIAMONDS, Rank.QUEEN),
    new Card(Suit.HEARTS, Rank.QUEEN)
  ],

  // 对子
  PAIR: [
    new Card(Suit.HEARTS, Rank.ACE),
    new Card(Suit.SPADES, Rank.ACE),
    new Card(Suit.CLUBS, Rank.KING),
    new Card(Suit.DIAMONDS, Rank.QUEEN),
    new Card(Suit.HEARTS, Rank.JACK)
  ]
};

export const TEST_PLAYERS = {
  ALICE: {
    id: 'alice_123',
    username: 'Alice',
    chips: 1000,
    isReady: false,
    position: 0,
    isConnected: true,
    isOwner: true
  } as RoomPlayer,

  BOB: {
    id: 'bob_456',
    username: 'Bob',
    chips: 1500,
    isReady: false,
    position: 1,
    isConnected: true,
    isOwner: false
  } as RoomPlayer,

  CHARLIE: {
    id: 'charlie_789',
    username: 'Charlie',
    chips: 2000,
    isReady: false,
    position: 2,
    isConnected: true,
    isOwner: false
  } as RoomPlayer
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