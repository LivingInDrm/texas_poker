"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandEvaluator = exports.HandType = void 0;
/**
 * 牌型枚举（按强度从低到高排列）
 */
var HandType;
(function (HandType) {
    HandType[HandType["HIGH_CARD"] = 1] = "HIGH_CARD";
    HandType[HandType["ONE_PAIR"] = 2] = "ONE_PAIR";
    HandType[HandType["TWO_PAIR"] = 3] = "TWO_PAIR";
    HandType[HandType["THREE_OF_A_KIND"] = 4] = "THREE_OF_A_KIND";
    HandType[HandType["STRAIGHT"] = 5] = "STRAIGHT";
    HandType[HandType["FLUSH"] = 6] = "FLUSH";
    HandType[HandType["FULL_HOUSE"] = 7] = "FULL_HOUSE";
    HandType[HandType["FOUR_OF_A_KIND"] = 8] = "FOUR_OF_A_KIND";
    HandType[HandType["STRAIGHT_FLUSH"] = 9] = "STRAIGHT_FLUSH"; // 同花顺
})(HandType || (exports.HandType = HandType = {}));
/**
 * 牌型判断器
 */
class HandEvaluator {
    /**
     * 评估7张牌中的最佳5张牌组合
     * @param cards 7张牌（2张手牌 + 5张公共牌）
     * @returns 最佳牌型
     */
    static evaluateHand(cards) {
        if (cards.length !== 7) {
            throw new Error('Hand evaluation requires exactly 7 cards');
        }
        // 生成所有可能的5张牌组合
        const combinations = this.generateCombinations(cards, 5);
        let bestHand = null;
        // 评估每种组合，找出最强的牌型
        for (const combination of combinations) {
            const handRank = this.evaluate5Cards(combination);
            if (!bestHand || this.compareHands(handRank, bestHand) > 0) {
                bestHand = handRank;
            }
        }
        return bestHand;
    }
    /**
     * 评估5张牌的牌型
     */
    static evaluate5Cards(cards) {
        if (cards.length !== 5) {
            throw new Error('evaluate5Cards requires exactly 5 cards');
        }
        // 按点数排序
        const sortedCards = [...cards].sort((a, b) => b.rank - a.rank);
        // 检查各种牌型
        const isStraightFlush = this.isStraightFlush(sortedCards);
        if (isStraightFlush)
            return isStraightFlush;
        const isFourOfAKind = this.isFourOfAKind(sortedCards);
        if (isFourOfAKind)
            return isFourOfAKind;
        const isFullHouse = this.isFullHouse(sortedCards);
        if (isFullHouse)
            return isFullHouse;
        const isFlush = this.isFlush(sortedCards);
        if (isFlush)
            return isFlush;
        const isStraight = this.isStraight(sortedCards);
        if (isStraight)
            return isStraight;
        const isThreeOfAKind = this.isThreeOfAKind(sortedCards);
        if (isThreeOfAKind)
            return isThreeOfAKind;
        const isTwoPair = this.isTwoPair(sortedCards);
        if (isTwoPair)
            return isTwoPair;
        const isOnePair = this.isOnePair(sortedCards);
        if (isOnePair)
            return isOnePair;
        return this.isHighCard(sortedCards);
    }
    /**
     * 检查是否为同花顺
     */
    static isStraightFlush(cards) {
        const isFlush = this.checkFlush(cards);
        const straightInfo = this.checkStraight(cards);
        if (isFlush && straightInfo) {
            return {
                type: HandType.STRAIGHT_FLUSH,
                primaryRank: straightInfo.highCard,
                kickers: [],
                cards: cards,
                name: `${this.getRankName(straightInfo.highCard)}高同花顺`
            };
        }
        return null;
    }
    /**
     * 检查是否为四条
     */
    static isFourOfAKind(cards) {
        const rankCounts = this.getRankCounts(cards);
        const fourOfAKindRank = Object.keys(rankCounts).find(rank => rankCounts[parseInt(rank)] === 4);
        if (fourOfAKindRank) {
            const fourRank = parseInt(fourOfAKindRank);
            const kicker = Object.keys(rankCounts).find(rank => parseInt(rank) !== fourRank);
            return {
                type: HandType.FOUR_OF_A_KIND,
                primaryRank: fourRank,
                kickers: kicker ? [parseInt(kicker)] : [],
                cards: cards,
                name: `${this.getRankName(fourRank)}四条`
            };
        }
        return null;
    }
    /**
     * 检查是否为葫芦
     */
    static isFullHouse(cards) {
        const rankCounts = this.getRankCounts(cards);
        const threeOfAKindRank = Object.keys(rankCounts).find(rank => rankCounts[parseInt(rank)] === 3);
        const pairRank = Object.keys(rankCounts).find(rank => rankCounts[parseInt(rank)] === 2);
        if (threeOfAKindRank && pairRank) {
            const threeRank = parseInt(threeOfAKindRank);
            const twoRank = parseInt(pairRank);
            return {
                type: HandType.FULL_HOUSE,
                primaryRank: threeRank,
                secondaryRank: twoRank,
                kickers: [],
                cards: cards,
                name: `${this.getRankName(threeRank)}满${this.getRankName(twoRank)}`
            };
        }
        return null;
    }
    /**
     * 检查是否为同花
     */
    static isFlush(cards) {
        if (this.checkFlush(cards)) {
            const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
            return {
                type: HandType.FLUSH,
                primaryRank: ranks[0],
                kickers: ranks.slice(1),
                cards: cards,
                name: `${this.getRankName(ranks[0])}高同花`
            };
        }
        return null;
    }
    /**
     * 检查是否为顺子
     */
    static isStraight(cards) {
        const straightInfo = this.checkStraight(cards);
        if (straightInfo) {
            return {
                type: HandType.STRAIGHT,
                primaryRank: straightInfo.highCard,
                kickers: [],
                cards: cards,
                name: `${this.getRankName(straightInfo.highCard)}高顺子`
            };
        }
        return null;
    }
    /**
     * 检查是否为三条
     */
    static isThreeOfAKind(cards) {
        const rankCounts = this.getRankCounts(cards);
        const threeOfAKindRank = Object.keys(rankCounts).find(rank => rankCounts[parseInt(rank)] === 3);
        if (threeOfAKindRank) {
            const threeRank = parseInt(threeOfAKindRank);
            const kickers = Object.keys(rankCounts)
                .filter(rank => parseInt(rank) !== threeRank)
                .map(rank => parseInt(rank))
                .sort((a, b) => b - a);
            return {
                type: HandType.THREE_OF_A_KIND,
                primaryRank: threeRank,
                kickers: kickers,
                cards: cards,
                name: `${this.getRankName(threeRank)}三条`
            };
        }
        return null;
    }
    /**
     * 检查是否为两对
     */
    static isTwoPair(cards) {
        const rankCounts = this.getRankCounts(cards);
        const pairs = Object.keys(rankCounts)
            .filter(rank => rankCounts[parseInt(rank)] === 2)
            .map(rank => parseInt(rank))
            .sort((a, b) => b - a);
        if (pairs.length === 2) {
            const kicker = Object.keys(rankCounts)
                .find(rank => rankCounts[parseInt(rank)] === 1);
            return {
                type: HandType.TWO_PAIR,
                primaryRank: pairs[0],
                secondaryRank: pairs[1],
                kickers: kicker ? [parseInt(kicker)] : [],
                cards: cards,
                name: `${this.getRankName(pairs[0])}和${this.getRankName(pairs[1])}两对`
            };
        }
        return null;
    }
    /**
     * 检查是否为一对
     */
    static isOnePair(cards) {
        const rankCounts = this.getRankCounts(cards);
        const pairRank = Object.keys(rankCounts).find(rank => rankCounts[parseInt(rank)] === 2);
        if (pairRank) {
            const pair = parseInt(pairRank);
            const kickers = Object.keys(rankCounts)
                .filter(rank => parseInt(rank) !== pair)
                .map(rank => parseInt(rank))
                .sort((a, b) => b - a);
            return {
                type: HandType.ONE_PAIR,
                primaryRank: pair,
                kickers: kickers,
                cards: cards,
                name: `${this.getRankName(pair)}一对`
            };
        }
        return null;
    }
    /**
     * 高牌
     */
    static isHighCard(cards) {
        const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
        return {
            type: HandType.HIGH_CARD,
            primaryRank: ranks[0],
            kickers: ranks.slice(1),
            cards: cards,
            name: `${this.getRankName(ranks[0])}高牌`
        };
    }
    /**
     * 比较两个牌型的强弱
     * @returns 1 if hand1 > hand2, -1 if hand1 < hand2, 0 if equal
     */
    static compareHands(hand1, hand2) {
        // 首先比较牌型类型
        if (hand1.type !== hand2.type) {
            return hand1.type - hand2.type;
        }
        // 比较主要点数
        if (hand1.primaryRank !== hand2.primaryRank) {
            return hand1.primaryRank - hand2.primaryRank;
        }
        // 比较次要点数（如果存在）
        if (hand1.secondaryRank !== undefined && hand2.secondaryRank !== undefined) {
            if (hand1.secondaryRank !== hand2.secondaryRank) {
                return hand1.secondaryRank - hand2.secondaryRank;
            }
        }
        // 比较踢脚牌
        for (let i = 0; i < Math.max(hand1.kickers.length, hand2.kickers.length); i++) {
            const kicker1 = hand1.kickers[i] || 0;
            const kicker2 = hand2.kickers[i] || 0;
            if (kicker1 !== kicker2) {
                return kicker1 - kicker2;
            }
        }
        return 0; // 完全相等
    }
    // 辅助方法
    /**
     * 检查是否为同花
     */
    static checkFlush(cards) {
        const suit = cards[0].suit;
        return cards.every(card => card.suit === suit);
    }
    /**
     * 检查是否为顺子
     */
    static checkStraight(cards) {
        const ranks = [...new Set(cards.map(card => card.rank))].sort((a, b) => a - b);
        if (ranks.length !== 5)
            return null;
        // 检查普通顺子
        for (let i = 1; i < ranks.length; i++) {
            if (ranks[i] - ranks[i - 1] !== 1) {
                // 检查A-2-3-4-5顺子（轮子顺）
                if (ranks.toString() === '2,3,4,5,14') {
                    return { highCard: 5 }; // A-2-3-4-5顺子中，5是最大牌
                }
                return null;
            }
        }
        return { highCard: ranks[ranks.length - 1] };
    }
    /**
     * 统计各点数的出现次数
     */
    static getRankCounts(cards) {
        const counts = {};
        for (const card of cards) {
            counts[card.rank] = (counts[card.rank] || 0) + 1;
        }
        return counts;
    }
    /**
     * 获取点数的中文名称
     */
    static getRankName(rank) {
        const names = {
            2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
            11: 'J', 12: 'Q', 13: 'K', 14: 'A'
        };
        return names[rank] || rank.toString();
    }
    /**
     * 生成组合
     */
    static generateCombinations(array, size) {
        if (size === 0)
            return [[]];
        if (array.length === 0)
            return [];
        const [first, ...rest] = array;
        const withFirst = this.generateCombinations(rest, size - 1).map(combo => [first, ...combo]);
        const withoutFirst = this.generateCombinations(rest, size);
        return [...withFirst, ...withoutFirst];
    }
}
exports.HandEvaluator = HandEvaluator;
