import { Deck } from '../../src/game/Deck';
import { Card, Suit, Rank } from '../../src/game/Card';

describe('Deck', () => {
  let deck: Deck;

  beforeEach(() => {
    deck = new Deck();
  });

  describe('Constructor and reset', () => {
    test('should create a full deck of 52 cards', () => {
      expect(deck.getRemainingCount()).toBe(52);
    });

    test('should contain all suits and ranks', () => {
      const allCards: Card[] = [];
      while (!deck.isEmpty()) {
        const card = deck.deal();
        if (card) allCards.push(card);
      }

      expect(allCards.length).toBe(52);

      // Check that we have all suits
      const suits = new Set(allCards.map(card => card.suit));
      expect(suits.size).toBe(4);
      expect(suits.has(Suit.SPADES)).toBe(true);
      expect(suits.has(Suit.HEARTS)).toBe(true);
      expect(suits.has(Suit.DIAMONDS)).toBe(true);
      expect(suits.has(Suit.CLUBS)).toBe(true);

      // Check that we have all ranks
      const ranks = new Set(allCards.map(card => card.rank));
      expect(ranks.size).toBe(13);
      for (let rank = 2; rank <= 14; rank++) {
        expect(ranks.has(rank)).toBe(true);
      }
    });

    test('should reset deck to full 52 cards', () => {
      deck.deal();
      deck.deal();
      expect(deck.getRemainingCount()).toBe(50);

      deck.reset();
      expect(deck.getRemainingCount()).toBe(52);
    });
  });

  describe('Deal methods', () => {
    test('should deal cards from the top', () => {
      const initialCount = deck.getRemainingCount();
      const card = deck.deal();

      expect(card).toBeInstanceOf(Card);
      expect(deck.getRemainingCount()).toBe(initialCount - 1);
    });

    test('should return null when deck is empty', () => {
      while (!deck.isEmpty()) {
        deck.deal();
      }

      expect(deck.deal()).toBeNull();
      expect(deck.getRemainingCount()).toBe(0);
    });

    test('should deal multiple cards correctly', () => {
      const cards = deck.dealCards(5);

      expect(cards.length).toBe(5);
      expect(deck.getRemainingCount()).toBe(47);

      cards.forEach(card => {
        expect(card).toBeInstanceOf(Card);
      });
    });

    test('should deal remaining cards when requesting more than available', () => {
      const smallDeck = new Deck();
      while (smallDeck.getRemainingCount() > 3) {
        smallDeck.deal();
      }

      const cards = smallDeck.dealCards(5);
      expect(cards.length).toBe(3);
      expect(smallDeck.isEmpty()).toBe(true);
    });
  });

  describe('Shuffle method', () => {
    test('should randomize card order', () => {
      const deck1 = new Deck();
      const deck2 = new Deck();

      deck2.shuffle();

      const cards1: Card[] = [];
      const cards2: Card[] = [];

      while (!deck1.isEmpty() && !deck2.isEmpty()) {
        const card1 = deck1.deal();
        const card2 = deck2.deal();
        if (card1) cards1.push(card1);
        if (card2) cards2.push(card2);
      }

      // It's extremely unlikely that shuffled deck has same order
      let sameOrder = true;
      for (let i = 0; i < cards1.length; i++) {
        if (!cards1[i].equals(cards2[i])) {
          sameOrder = false;
          break;
        }
      }

      expect(sameOrder).toBe(false);
    });

    test('should maintain deck size after shuffle', () => {
      deck.shuffle();
      expect(deck.getRemainingCount()).toBe(52);
    });
  });

  describe('Burn method', () => {
    test('should burn a card (same as deal)', () => {
      const initialCount = deck.getRemainingCount();
      const burnedCard = deck.burn();

      expect(burnedCard).toBeInstanceOf(Card);
      expect(deck.getRemainingCount()).toBe(initialCount - 1);
    });

    test('should return null when burning from empty deck', () => {
      while (!deck.isEmpty()) {
        deck.deal();
      }

      expect(deck.burn()).toBeNull();
    });
  });

  describe('Static helper methods', () => {
    test('parseCard should create correct card from string', () => {
      expect(Deck.parseCard('AS').equals(new Card(Suit.SPADES, Rank.ACE))).toBe(true);
      expect(Deck.parseCard('2H').equals(new Card(Suit.HEARTS, Rank.TWO))).toBe(true);
      expect(Deck.parseCard('10D').equals(new Card(Suit.DIAMONDS, Rank.TEN))).toBe(true);
      expect(Deck.parseCard('TD').equals(new Card(Suit.DIAMONDS, Rank.TEN))).toBe(true);
      expect(Deck.parseCard('KC').equals(new Card(Suit.CLUBS, Rank.KING))).toBe(true);
    });

    test('parseCard should throw error for invalid input', () => {
      expect(() => Deck.parseCard('XX')).toThrow();
      expect(() => Deck.parseCard('A')).toThrow();
      expect(() => Deck.parseCard('')).toThrow();
      expect(() => Deck.parseCard('1S')).toThrow();
    });

    test('parseCards should create array of cards', () => {
      const cards = Deck.parseCards(['AS', '2H', 'KC']);
      
      expect(cards.length).toBe(3);
      expect(cards[0].equals(new Card(Suit.SPADES, Rank.ACE))).toBe(true);
      expect(cards[1].equals(new Card(Suit.HEARTS, Rank.TWO))).toBe(true);
      expect(cards[2].equals(new Card(Suit.CLUBS, Rank.KING))).toBe(true);
    });

    test('createSpecificCards should create cards from specs', () => {
      const specs = [
        { suit: Suit.HEARTS, rank: Rank.ACE },
        { suit: Suit.SPADES, rank: Rank.KING }
      ];
      const cards = Deck.createSpecificCards(specs);

      expect(cards.length).toBe(2);
      expect(cards[0].equals(new Card(Suit.HEARTS, Rank.ACE))).toBe(true);
      expect(cards[1].equals(new Card(Suit.SPADES, Rank.KING))).toBe(true);
    });
  });

  describe('String representation', () => {
    test('toString should show remaining count', () => {
      expect(deck.toString()).toBe('Deck(52 cards remaining)');
      
      deck.deal();
      expect(deck.toString()).toBe('Deck(51 cards remaining)');
    });

    test('toDetailString should show all cards', () => {
      const smallDeck = new Deck();
      while (smallDeck.getRemainingCount() > 3) {
        smallDeck.deal();
      }

      const detailString = smallDeck.toDetailString();
      expect(detailString).toContain('Deck: [');
      expect(detailString.split(',').length).toBe(3);
    });
  });
});