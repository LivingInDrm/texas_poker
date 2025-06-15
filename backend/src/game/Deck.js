"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deck = void 0;
const Card_1 = require("./Card");
/**
 * 牌堆类 - 管理一副完整的扑克牌
 */
class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }
    /**
     * 重置牌堆（创建一副完整的52张牌）
     */
    reset() {
        this.cards = [];
        // 创建所有花色和点数的组合
        for (const suit of Object.values(Card_1.Suit)) {
            for (const rank of Object.values(Card_1.Rank)) {
                if (typeof rank === 'number') {
                    this.cards.push(new Card_1.Card(suit, rank));
                }
            }
        }
    }
    /**
     * 洗牌 - 使用Fisher-Yates算法
     */
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    /**
     * 发一张牌
     * @returns 发出的牌，如果牌堆为空则返回null
     */
    deal() {
        return this.cards.pop() || null;
    }
    /**
     * 发多张牌
     * @param count 要发的牌数
     * @returns 发出的牌数组
     */
    dealCards(count) {
        const dealtCards = [];
        for (let i = 0; i < count && this.cards.length > 0; i++) {
            const card = this.deal();
            if (card) {
                dealtCards.push(card);
            }
        }
        return dealtCards;
    }
    /**
     * 获取剩余牌数
     */
    getRemainingCount() {
        return this.cards.length;
    }
    /**
     * 检查牌堆是否为空
     */
    isEmpty() {
        return this.cards.length === 0;
    }
    /**
     * 烧牌（丢弃顶部的牌，德州扑克规则中翻牌前要烧一张牌）
     * @returns 被烧掉的牌
     */
    burn() {
        return this.deal();
    }
    /**
     * 获取牌堆的字符串表示（调试用）
     */
    toString() {
        return `Deck(${this.cards.length} cards remaining)`;
    }
    /**
     * 获取牌堆中所有牌的字符串表示（调试用）
     */
    toDetailString() {
        return `Deck: [${this.cards.map(card => card.toShortString()).join(', ')}]`;
    }
    /**
     * 创建特定的牌（用于测试）
     */
    static createSpecificCards(cardSpecs) {
        return cardSpecs.map(spec => new Card_1.Card(spec.suit, spec.rank));
    }
    /**
     * 从字符串创建牌（用于测试）
     * 格式: "AS" = Ace of Spades, "2H" = Two of Hearts, etc.
     */
    static parseCard(cardString) {
        if (cardString.length < 2) {
            throw new Error(`Invalid card string: ${cardString}`);
        }
        const rankStr = cardString.slice(0, -1);
        const suitStr = cardString.slice(-1);
        // 解析点数
        let rank;
        switch (rankStr.toUpperCase()) {
            case '2':
                rank = Card_1.Rank.TWO;
                break;
            case '3':
                rank = Card_1.Rank.THREE;
                break;
            case '4':
                rank = Card_1.Rank.FOUR;
                break;
            case '5':
                rank = Card_1.Rank.FIVE;
                break;
            case '6':
                rank = Card_1.Rank.SIX;
                break;
            case '7':
                rank = Card_1.Rank.SEVEN;
                break;
            case '8':
                rank = Card_1.Rank.EIGHT;
                break;
            case '9':
                rank = Card_1.Rank.NINE;
                break;
            case '10':
            case 'T':
                rank = Card_1.Rank.TEN;
                break;
            case 'J':
                rank = Card_1.Rank.JACK;
                break;
            case 'Q':
                rank = Card_1.Rank.QUEEN;
                break;
            case 'K':
                rank = Card_1.Rank.KING;
                break;
            case 'A':
                rank = Card_1.Rank.ACE;
                break;
            default:
                throw new Error(`Invalid rank: ${rankStr}`);
        }
        // 解析花色
        let suit;
        switch (suitStr.toUpperCase()) {
            case 'S':
                suit = Card_1.Suit.SPADES;
                break;
            case 'H':
                suit = Card_1.Suit.HEARTS;
                break;
            case 'D':
                suit = Card_1.Suit.DIAMONDS;
                break;
            case 'C':
                suit = Card_1.Suit.CLUBS;
                break;
            default:
                throw new Error(`Invalid suit: ${suitStr}`);
        }
        return new Card_1.Card(suit, rank);
    }
    /**
     * 从字符串数组创建多张牌（用于测试）
     */
    static parseCards(cardStrings) {
        return cardStrings.map(str => Deck.parseCard(str));
    }
}
exports.Deck = Deck;
