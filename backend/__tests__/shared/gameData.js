"use strict";
/**
 * 游戏测试数据固定装置
 * 提供标准的测试数据集
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_ROOM_CONFIG = exports.TEST_PLAYERS = exports.TEST_CARDS = void 0;
const Card_1 = require("@/game/Card");
exports.TEST_CARDS = {
    // 皇家同花顺
    ROYAL_FLUSH: [
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE),
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.KING),
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.QUEEN),
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.JACK),
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.TEN)
    ],
    // 同花顺
    STRAIGHT_FLUSH: [
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.NINE),
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.EIGHT),
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.SEVEN),
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.SIX),
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.FIVE)
    ],
    // 四条
    FOUR_OF_A_KIND: [
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE),
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.ACE),
        new Card_1.Card(Card_1.Suit.CLUBS, Card_1.Rank.ACE),
        new Card_1.Card(Card_1.Suit.DIAMONDS, Card_1.Rank.ACE),
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.KING)
    ],
    // 葫芦
    FULL_HOUSE: [
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.KING),
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.KING),
        new Card_1.Card(Card_1.Suit.CLUBS, Card_1.Rank.KING),
        new Card_1.Card(Card_1.Suit.DIAMONDS, Card_1.Rank.QUEEN),
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.QUEEN)
    ],
    // 对子
    PAIR: [
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.ACE),
        new Card_1.Card(Card_1.Suit.SPADES, Card_1.Rank.ACE),
        new Card_1.Card(Card_1.Suit.CLUBS, Card_1.Rank.KING),
        new Card_1.Card(Card_1.Suit.DIAMONDS, Card_1.Rank.QUEEN),
        new Card_1.Card(Card_1.Suit.HEARTS, Card_1.Rank.JACK)
    ]
};
exports.TEST_PLAYERS = {
    ALICE: {
        id: 'alice_123',
        username: 'Alice',
        chips: 1000,
        isReady: false,
        position: 0,
        isConnected: true,
        isOwner: true
    },
    BOB: {
        id: 'bob_456',
        username: 'Bob',
        chips: 1500,
        isReady: false,
        position: 1,
        isConnected: true,
        isOwner: false
    },
    CHARLIE: {
        id: 'charlie_789',
        username: 'Charlie',
        chips: 2000,
        isReady: false,
        position: 2,
        isConnected: true,
        isOwner: false
    }
};
exports.TEST_ROOM_CONFIG = {
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
