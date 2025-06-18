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
        new Card_1.Card('hearts', 'A'),
        new Card_1.Card('hearts', 'K'),
        new Card_1.Card('hearts', 'Q'),
        new Card_1.Card('hearts', 'J'),
        new Card_1.Card('hearts', '10')
    ],
    // 同花顺
    STRAIGHT_FLUSH: [
        new Card_1.Card('spades', '9'),
        new Card_1.Card('spades', '8'),
        new Card_1.Card('spades', '7'),
        new Card_1.Card('spades', '6'),
        new Card_1.Card('spades', '5')
    ],
    // 四条
    FOUR_OF_A_KIND: [
        new Card_1.Card('hearts', 'A'),
        new Card_1.Card('spades', 'A'),
        new Card_1.Card('clubs', 'A'),
        new Card_1.Card('diamonds', 'A'),
        new Card_1.Card('hearts', 'K')
    ],
    // 葫芦
    FULL_HOUSE: [
        new Card_1.Card('hearts', 'K'),
        new Card_1.Card('spades', 'K'),
        new Card_1.Card('clubs', 'K'),
        new Card_1.Card('diamonds', 'Q'),
        new Card_1.Card('hearts', 'Q')
    ],
    // 对子
    PAIR: [
        new Card_1.Card('hearts', 'A'),
        new Card_1.Card('spades', 'A'),
        new Card_1.Card('clubs', 'K'),
        new Card_1.Card('diamonds', 'Q'),
        new Card_1.Card('hearts', 'J')
    ]
};
exports.TEST_PLAYERS = {
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
    },
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
    },
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
