import { Card, Suit, Rank } from '../../src/game/Card';

describe('Card', () => {
  describe('Constructor and basic properties', () => {
    test('should create a card with suit and rank', () => {
      const card = new Card(Suit.HEARTS, Rank.ACE);
      expect(card.suit).toBe(Suit.HEARTS);
      expect(card.rank).toBe(Rank.ACE);
    });
  });

  describe('toString method', () => {
    test('should return correct string representation for ace of spades', () => {
      const card = new Card(Suit.SPADES, Rank.ACE);
      expect(card.toString()).toBe('A♠');
    });

    test('should return correct string representation for ten of hearts', () => {
      const card = new Card(Suit.HEARTS, Rank.TEN);
      expect(card.toString()).toBe('10♥');
    });

    test('should return correct string representation for face cards', () => {
      expect(new Card(Suit.DIAMONDS, Rank.JACK).toString()).toBe('J♦');
      expect(new Card(Suit.CLUBS, Rank.QUEEN).toString()).toBe('Q♣');
      expect(new Card(Suit.HEARTS, Rank.KING).toString()).toBe('K♥');
    });
  });

  describe('toShortString method', () => {
    test('should return correct short representation', () => {
      expect(new Card(Suit.SPADES, Rank.ACE).toShortString()).toBe('AS');
      expect(new Card(Suit.HEARTS, Rank.TEN).toShortString()).toBe('TH');
      expect(new Card(Suit.DIAMONDS, Rank.TWO).toShortString()).toBe('2D');
      expect(new Card(Suit.CLUBS, Rank.KING).toShortString()).toBe('KC');
    });
  });

  describe('compareRank method', () => {
    test('should compare ranks correctly', () => {
      const aceHearts = new Card(Suit.HEARTS, Rank.ACE);
      const kingSpades = new Card(Suit.SPADES, Rank.KING);
      const aceSpades = new Card(Suit.SPADES, Rank.ACE);

      expect(aceHearts.compareRank(kingSpades)).toBeGreaterThan(0);
      expect(kingSpades.compareRank(aceHearts)).toBeLessThan(0);
      expect(aceHearts.compareRank(aceSpades)).toBe(0);
    });
  });

  describe('equals method', () => {
    test('should identify equal cards', () => {
      const card1 = new Card(Suit.HEARTS, Rank.ACE);
      const card2 = new Card(Suit.HEARTS, Rank.ACE);
      const card3 = new Card(Suit.SPADES, Rank.ACE);

      expect(card1.equals(card2)).toBe(true);
      expect(card1.equals(card3)).toBe(false);
    });
  });

  describe('toJSON method', () => {
    test('should return correct JSON representation', () => {
      const card = new Card(Suit.HEARTS, Rank.ACE);
      const json = card.toJSON();

      expect(json).toEqual({
        suit: Suit.HEARTS,
        rank: Rank.ACE,
        display: 'A♥'
      });
    });
  });
});