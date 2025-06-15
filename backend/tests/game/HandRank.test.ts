import { HandEvaluator, HandType } from '../../src/game/HandRank';
import { Deck } from '../../src/game/Deck';

describe('HandEvaluator', () => {
  describe('Hand evaluation', () => {
    test('should identify straight flush', () => {
      const cards = Deck.parseCards(['AS', 'KS', 'QS', 'JS', 'TS', '9H', '8C']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.STRAIGHT_FLUSH);
      expect(result.primaryRank).toBe(14); // Ace high
      expect(result.name).toContain('A高同花顺');
    });

    test('should identify four of a kind', () => {
      const cards = Deck.parseCards(['AS', 'AH', 'AD', 'AC', 'KS', 'QH', '9C']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.FOUR_OF_A_KIND);
      expect(result.primaryRank).toBe(14); // Aces
      expect(result.kickers[0]).toBe(13); // King kicker
    });

    test('should identify full house', () => {
      const cards = Deck.parseCards(['AS', 'AH', 'AD', 'KS', 'KH', 'QC', '9D']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.FULL_HOUSE);
      expect(result.primaryRank).toBe(14); // Aces
      expect(result.secondaryRank).toBe(13); // Kings
    });

    test('should identify flush', () => {
      const cards = Deck.parseCards(['AS', 'KS', 'QS', 'JS', '9S', '7H', '5C']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.FLUSH);
      expect(result.primaryRank).toBe(14); // Ace high
      expect(result.kickers).toEqual([13, 12, 11, 9]); // K, Q, J, 9
    });

    test('should identify straight', () => {
      const cards = Deck.parseCards(['AS', 'KH', 'QD', 'JC', 'TS', '9H', '7C']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.STRAIGHT);
      expect(result.primaryRank).toBe(14); // Ace high straight
    });

    test('should identify wheel straight (A-2-3-4-5)', () => {
      const cards = Deck.parseCards(['AS', '2H', '3D', '4C', '5S', 'KH', 'QC']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.STRAIGHT);
      expect(result.primaryRank).toBe(5); // 5 high (wheel)
    });

    test('should identify three of a kind', () => {
      const cards = Deck.parseCards(['AS', 'AH', 'AD', 'KS', 'QH', 'JC', '9D']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.THREE_OF_A_KIND);
      expect(result.primaryRank).toBe(14); // Aces
      expect(result.kickers).toEqual([13, 12]); // King, Queen
    });

    test('should identify two pair', () => {
      const cards = Deck.parseCards(['AS', 'AH', 'KD', 'KS', 'QH', 'JC', '9D']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.TWO_PAIR);
      expect(result.primaryRank).toBe(14); // Aces
      expect(result.secondaryRank).toBe(13); // Kings
      expect(result.kickers[0]).toBe(12); // Queen
    });

    test('should identify one pair', () => {
      const cards = Deck.parseCards(['AS', 'AH', 'KD', 'QS', 'JH', '9C', '7D']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.ONE_PAIR);
      expect(result.primaryRank).toBe(14); // Aces
      expect(result.kickers).toEqual([13, 12, 11]); // K, Q, J
    });

    test('should identify high card', () => {
      const cards = Deck.parseCards(['AS', 'KH', 'QD', 'JS', '9H', '7C', '5D']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.HIGH_CARD);
      expect(result.primaryRank).toBe(14); // Ace high
      expect(result.kickers).toEqual([13, 12, 11, 9]); // K, Q, J, 9
    });
  });

  describe('Hand comparison', () => {
    test('should compare different hand types correctly', () => {
      const straightFlush = Deck.parseCards(['9S', '8S', '7S', '6S', '5S', 'AH', 'KC']);
      const fourOfAKind = Deck.parseCards(['AS', 'AH', 'AD', 'AC', 'KS', 'QH', 'JC']);

      const sfResult = HandEvaluator.evaluateHand(straightFlush);
      const fourResult = HandEvaluator.evaluateHand(fourOfAKind);

      expect(HandEvaluator.compareHands(sfResult, fourResult)).toBeGreaterThan(0);
      expect(HandEvaluator.compareHands(fourResult, sfResult)).toBeLessThan(0);
    });

    test('should compare same hand types by rank', () => {
      const acesFullOfKings = Deck.parseCards(['AS', 'AH', 'AD', 'KS', 'KH', 'QC', 'JD']);
      const kingsFullOfAces = Deck.parseCards(['KS', 'KH', 'KD', 'AS', 'AH', 'QC', 'JD']);

      const acesResult = HandEvaluator.evaluateHand(acesFullOfKings);
      const kingsResult = HandEvaluator.evaluateHand(kingsFullOfAces);

      expect(HandEvaluator.compareHands(acesResult, kingsResult)).toBeGreaterThan(0);
    });

    test('should compare hands with kickers', () => {
      const aceKingHigh = Deck.parseCards(['AS', 'KH', 'QD', 'JS', '9H', '7C', '5D']);
      const aceQueenHigh = Deck.parseCards(['AH', 'QS', 'JD', '9C', '8H', '7S', '5C']);

      const akResult = HandEvaluator.evaluateHand(aceKingHigh);
      const aqResult = HandEvaluator.evaluateHand(aceQueenHigh);

      expect(HandEvaluator.compareHands(akResult, aqResult)).toBeGreaterThan(0);
    });

    test('should identify equal hands', () => {
      const hand1 = Deck.parseCards(['AS', 'KH', 'QD', 'JS', '9H', '8C', '7D']);
      const hand2 = Deck.parseCards(['AD', 'KC', 'QS', 'JH', '9C', '8S', '7H']);

      const result1 = HandEvaluator.evaluateHand(hand1);
      const result2 = HandEvaluator.evaluateHand(hand2);

      expect(HandEvaluator.compareHands(result1, result2)).toBe(0);
    });
  });

  describe('Edge cases', () => {
    test('should throw error for wrong number of cards', () => {
      const tooFewCards = Deck.parseCards(['AS', 'KH', 'QD', 'JS', '9H', '8C']);
      const tooManyCards = Deck.parseCards(['AS', 'KH', 'QD', 'JS', '9H', '8C', '7D', '6S']);

      expect(() => HandEvaluator.evaluateHand(tooFewCards)).toThrow();
      expect(() => HandEvaluator.evaluateHand(tooManyCards)).toThrow();
    });

    test('should handle low straight flush (5-4-3-2-A)', () => {
      const cards = Deck.parseCards(['5S', '4S', '3S', '2S', 'AS', 'KH', 'QC']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.STRAIGHT_FLUSH);
      expect(result.primaryRank).toBe(5); // 5 high
    });

    test('should prefer higher ranking hands from 7 cards', () => {
      // These 7 cards can make both a flush and a straight, should prefer flush
      const cards = Deck.parseCards(['AS', 'KS', 'QS', 'JS', '9S', '10H', '8C']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.FLUSH);
    });

    test('should handle multiple pairs correctly', () => {
      const cards = Deck.parseCards(['AS', 'AH', 'KD', 'KS', 'QH', 'QC', '9D']);
      const result = HandEvaluator.evaluateHand(cards);

      expect(result.type).toBe(HandType.TWO_PAIR);
      expect(result.primaryRank).toBe(14); // Aces
      expect(result.secondaryRank).toBe(13); // Kings (higher pair of the remaining)
    });
  });

  describe('Performance', () => {
    test('should evaluate hands efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const cards = Deck.parseCards(['AS', 'KH', 'QD', 'JS', '9H', '8C', '7D']);
        HandEvaluator.evaluateHand(cards);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should be able to evaluate 1000 hands in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});