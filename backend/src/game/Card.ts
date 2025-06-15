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
 * 扑克牌点数枚举 (2-14, where 11=J, 12=Q, 13=K, 14=A)
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
 * 扑克牌类
 */
export class Card {
  public readonly suit: Suit;
  public readonly rank: Rank;

  constructor(suit: Suit, rank: Rank) {
    this.suit = suit;
    this.rank = rank;
  }

  /**
   * 获取牌的字符串表示
   */
  toString(): string {
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
  toShortString(): string {
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
  compareRank(other: Card): number {
    return this.rank - other.rank;
  }

  /**
   * 检查两张牌是否相等
   */
  equals(other: Card): boolean {
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