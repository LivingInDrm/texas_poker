import { Card, Suit, Rank } from './Card';

/**
 * 牌堆类 - 管理一副完整的扑克牌
 */
export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.reset();
  }

  /**
   * 重置牌堆（创建一副完整的52张牌）
   */
  reset(): void {
    this.cards = [];
    
    // 创建所有花色和点数的组合
    for (const suit of Object.values(Suit)) {
      for (const rank of Object.values(Rank)) {
        if (typeof rank === 'number') {
          this.cards.push(new Card(suit, rank));
        }
      }
    }
  }

  /**
   * 洗牌 - 使用Fisher-Yates算法
   */
  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * 发一张牌
   * @returns 发出的牌，如果牌堆为空则返回null
   */
  deal(): Card | null {
    return this.cards.pop() || null;
  }

  /**
   * 发多张牌
   * @param count 要发的牌数
   * @returns 发出的牌数组
   */
  dealCards(count: number): Card[] {
    const dealtCards: Card[] = [];
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
  getRemainingCount(): number {
    return this.cards.length;
  }

  /**
   * 检查牌堆是否为空
   */
  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  /**
   * 烧牌（丢弃顶部的牌，德州扑克规则中翻牌前要烧一张牌）
   * @returns 被烧掉的牌
   */
  burn(): Card | null {
    return this.deal();
  }

  /**
   * 获取牌堆的字符串表示（调试用）
   */
  toString(): string {
    return `Deck(${this.cards.length} cards remaining)`;
  }

  /**
   * 获取牌堆中所有牌的字符串表示（调试用）
   */
  toDetailString(): string {
    return `Deck: [${this.cards.map(card => card.toShortString()).join(', ')}]`;
  }

  /**
   * 创建特定的牌（用于测试）
   */
  static createSpecificCards(cardSpecs: Array<{suit: Suit, rank: Rank}>): Card[] {
    return cardSpecs.map(spec => new Card(spec.suit, spec.rank));
  }

  /**
   * 从字符串创建牌（用于测试）
   * 格式: "AS" = Ace of Spades, "2H" = Two of Hearts, etc.
   */
  static parseCard(cardString: string): Card {
    if (cardString.length < 2) {
      throw new Error(`Invalid card string: ${cardString}`);
    }

    const rankStr = cardString.slice(0, -1);
    const suitStr = cardString.slice(-1);

    // 解析点数
    let rank: Rank;
    switch (rankStr.toUpperCase()) {
      case '2': rank = Rank.TWO; break;
      case '3': rank = Rank.THREE; break;
      case '4': rank = Rank.FOUR; break;
      case '5': rank = Rank.FIVE; break;
      case '6': rank = Rank.SIX; break;
      case '7': rank = Rank.SEVEN; break;
      case '8': rank = Rank.EIGHT; break;
      case '9': rank = Rank.NINE; break;
      case '10': case 'T': rank = Rank.TEN; break;
      case 'J': rank = Rank.JACK; break;
      case 'Q': rank = Rank.QUEEN; break;
      case 'K': rank = Rank.KING; break;
      case 'A': rank = Rank.ACE; break;
      default:
        throw new Error(`Invalid rank: ${rankStr}`);
    }

    // 解析花色
    let suit: Suit;
    switch (suitStr.toUpperCase()) {
      case 'S': suit = Suit.SPADES; break;
      case 'H': suit = Suit.HEARTS; break;
      case 'D': suit = Suit.DIAMONDS; break;
      case 'C': suit = Suit.CLUBS; break;
      default:
        throw new Error(`Invalid suit: ${suitStr}`);
    }

    return new Card(suit, rank);
  }

  /**
   * 从字符串数组创建多张牌（用于测试）
   */
  static parseCards(cardStrings: string[]): Card[] {
    return cardStrings.map(str => Deck.parseCard(str));
  }
}