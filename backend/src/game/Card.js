"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = exports.Rank = exports.Suit = void 0;
/**
 * 扑克牌花色枚举
 */
var Suit;
(function (Suit) {
    Suit["SPADES"] = "SPADES";
    Suit["HEARTS"] = "HEARTS";
    Suit["DIAMONDS"] = "DIAMONDS";
    Suit["CLUBS"] = "CLUBS"; // 梅花 ♣
})(Suit || (exports.Suit = Suit = {}));
/**
 * 扑克牌点数枚举 (2-14, where 11=J, 12=Q, 13=K, 14=A)
 */
var Rank;
(function (Rank) {
    Rank[Rank["TWO"] = 2] = "TWO";
    Rank[Rank["THREE"] = 3] = "THREE";
    Rank[Rank["FOUR"] = 4] = "FOUR";
    Rank[Rank["FIVE"] = 5] = "FIVE";
    Rank[Rank["SIX"] = 6] = "SIX";
    Rank[Rank["SEVEN"] = 7] = "SEVEN";
    Rank[Rank["EIGHT"] = 8] = "EIGHT";
    Rank[Rank["NINE"] = 9] = "NINE";
    Rank[Rank["TEN"] = 10] = "TEN";
    Rank[Rank["JACK"] = 11] = "JACK";
    Rank[Rank["QUEEN"] = 12] = "QUEEN";
    Rank[Rank["KING"] = 13] = "KING";
    Rank[Rank["ACE"] = 14] = "ACE";
})(Rank || (exports.Rank = Rank = {}));
/**
 * 扑克牌类
 */
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }
    /**
     * 获取牌的字符串表示
     */
    toString() {
        const suitSymbols = {
            [Suit.SPADES]: '♠',
            [Suit.HEARTS]: '♥',
            [Suit.DIAMONDS]: '♦',
            [Suit.CLUBS]: '♣'
        };
        const rankNames = {
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
        };
        return `${rankNames[this.rank]}${suitSymbols[this.suit]}`;
    }
    /**
     * 获取牌的简短表示（用于日志等）
     */
    toShortString() {
        const suitAbbr = {
            [Suit.SPADES]: 'S',
            [Suit.HEARTS]: 'H',
            [Suit.DIAMONDS]: 'D',
            [Suit.CLUBS]: 'C'
        };
        const rankAbbr = {
            [Rank.TWO]: '2',
            [Rank.THREE]: '3',
            [Rank.FOUR]: '4',
            [Rank.FIVE]: '5',
            [Rank.SIX]: '6',
            [Rank.SEVEN]: '7',
            [Rank.EIGHT]: '8',
            [Rank.NINE]: '9',
            [Rank.TEN]: 'T',
            [Rank.JACK]: 'J',
            [Rank.QUEEN]: 'Q',
            [Rank.KING]: 'K',
            [Rank.ACE]: 'A'
        };
        return `${rankAbbr[this.rank]}${suitAbbr[this.suit]}`;
    }
    /**
     * 比较两张牌的大小（只比较点数）
     */
    compareRank(other) {
        return this.rank - other.rank;
    }
    /**
     * 检查两张牌是否相等
     */
    equals(other) {
        return this.suit === other.suit && this.rank === other.rank;
    }
    /**
     * 获取牌的JSON表示
     */
    toJSON() {
        return {
            suit: this.suit,
            rank: this.rank,
            display: this.toString()
        };
    }
}
exports.Card = Card;
