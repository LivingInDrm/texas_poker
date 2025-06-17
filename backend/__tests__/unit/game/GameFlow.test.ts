import { Deck } from '../../src/game/Deck';
import { HandEvaluator, HandType } from '../../src/game/HandRank';
import { PotManager } from '../../src/game/PotManager';
import { PositionManager } from '../../src/game/PositionManager';

describe('Game Flow Integration', () => {
  let deck: Deck;
  let potManager: PotManager;
  let positionManager: PositionManager;

  beforeEach(() => {
    deck = new Deck();
    potManager = new PotManager();
    positionManager = new PositionManager(10, 20);
  });

  describe('Complete game simulation', () => {
    test('should simulate a full 3-player game hand', () => {
      // Setup players
      const players = ['alice', 'bob', 'charlie'];
      positionManager.setPlayers(players, 0); // Alice is dealer

      // Verify positions
      expect(positionManager.getDealerId()).toBe('alice');
      expect(positionManager.getSmallBlindId()).toBe('bob');
      expect(positionManager.getBigBlindId()).toBe('charlie');

      // Post blinds
      potManager.addBet('bob', 10);    // Small blind
      potManager.addBet('charlie', 20); // Big blind

      // Pre-flop betting round
      const preflopOrder = positionManager.getPreflopBettingOrder();
      expect(preflopOrder).toEqual(['alice', 'bob', 'charlie']);

      potManager.addBet('alice', 20);   // Dealer calls
      potManager.addBet('bob', 10);     // Small blind calls (total 20)
      // Charlie checks (already posted big blind)

      // Calculate pots after pre-flop
      potManager.calculatePots(players);
      expect(potManager.getTotalPotAmount()).toBe(60);

      // Deal community cards
      deck.shuffle();
      const communityCards = deck.dealCards(5);
      expect(communityCards).toHaveLength(5);

      // Simulate player hands
      const aliceHand = deck.dealCards(2);
      const bobHand = deck.dealCards(2);
      const charlieHand = deck.dealCards(2);

      expect(aliceHand).toHaveLength(2);
      expect(bobHand).toHaveLength(2);
      expect(charlieHand).toHaveLength(2);

      // Evaluate hands
      const aliceResult = HandEvaluator.evaluateHand([...aliceHand, ...communityCards]);
      const bobResult = HandEvaluator.evaluateHand([...bobHand, ...communityCards]);
      const charlieResult = HandEvaluator.evaluateHand([...charlieHand, ...communityCards]);

      // All hands should be valid
      expect(aliceResult.type).toBeGreaterThanOrEqual(HandType.HIGH_CARD);
      expect(bobResult.type).toBeGreaterThanOrEqual(HandType.HIGH_CARD);
      expect(charlieResult.type).toBeGreaterThanOrEqual(HandType.HIGH_CARD);

      // Determine winner (simplified - just compare Alice vs Bob)
      const comparison = HandEvaluator.compareHands(aliceResult, bobResult);
      let winner;
      if (comparison > 0) {
        winner = 'alice';
      } else if (comparison < 0) {
        winner = 'bob';
      } else {
        winner = 'tie';
      }

      // Distribute pot
      const mainPot = potManager.getMainPot();
      if (mainPot && winner !== 'tie') {
        const winnings = potManager.distributePots({
          [mainPot.id]: [winner]
        });
        expect(winnings[winner]).toBe(60);
      }

      // Move to next hand
      positionManager.nextHand();
      expect(positionManager.getDealerId()).toBe('bob'); // Dealer button moves
    });

    test('should handle all-in scenario with side pots', () => {
      const players = ['player1', 'player2', 'player3'];
      positionManager.setPlayers(players, 0);
      potManager.reset();

      // Complex betting scenario with all-ins
      potManager.addBet('player1', 50);   // All-in with 50 chips
      potManager.addBet('player2', 100);  // Call with 100 chips
      potManager.addBet('player3', 200);  // Raise to 200

      // Player 2 calls the raise
      potManager.addBet('player2', 100);  // Total: 200

      potManager.calculatePots(players);

      const pots = potManager.getPots();
      expect(pots).toHaveLength(2);

      // Main pot: 50 * 3 = 150 (all players eligible)
      expect(pots[0].amount).toBe(150);
      expect(pots[0].eligiblePlayers).toContain('player1');
      expect(pots[0].eligiblePlayers).toContain('player2');
      expect(pots[0].eligiblePlayers).toContain('player3');

      // Side pot: 150 * 2 = 300 (only player2 and player3 eligible)
      expect(pots[1].amount).toBe(300);
      expect(pots[1].eligiblePlayers).toContain('player2');
      expect(pots[1].eligiblePlayers).toContain('player3');
      expect(pots[1].eligiblePlayers).not.toContain('player1');

      expect(potManager.getTotalPotAmount()).toBe(450);
    });

    test('should handle heads-up play correctly', () => {
      const players = ['player1', 'player2'];
      positionManager.setPlayers(players, 0);

      // In heads-up, dealer is small blind
      expect(positionManager.getDealerId()).toBe('player1');
      expect(positionManager.getSmallBlindId()).toBe('player1');
      expect(positionManager.getBigBlindId()).toBe('player2');

      // Post blinds
      potManager.addBet('player1', 10); // Small blind
      potManager.addBet('player2', 20); // Big blind

      // Betting order should be correct
      const bettingOrder = positionManager.getBettingOrder();
      expect(bettingOrder).toEqual(['player1', 'player2']);

      const preflopOrder = positionManager.getPreflopBettingOrder();
      expect(preflopOrder).toEqual(['player1', 'player2']);
    });

    test('should handle specific hand comparisons correctly', () => {
      // Create specific hands for testing
      const royalFlushCards = Deck.parseCards(['AS', 'KS', 'QS', 'JS', 'TS', '9H', '8C']);
      const straightFlushCards = Deck.parseCards(['9H', '8H', '7H', '6H', '5H', 'AC', 'KD']);
      
      const royalFlush = HandEvaluator.evaluateHand(royalFlushCards);
      const straightFlush = HandEvaluator.evaluateHand(straightFlushCards);

      expect(royalFlush.type).toBe(HandType.STRAIGHT_FLUSH);
      expect(straightFlush.type).toBe(HandType.STRAIGHT_FLUSH);
      
      // Royal flush should beat straight flush
      expect(HandEvaluator.compareHands(royalFlush, straightFlush)).toBeGreaterThan(0);
    });

    test('should handle wheel straight correctly', () => {
      const wheelCards = Deck.parseCards(['AS', '2H', '3D', '4C', '5S', 'KH', 'QC']);
      const wheelResult = HandEvaluator.evaluateHand(wheelCards);

      expect(wheelResult.type).toBe(HandType.STRAIGHT);
      expect(wheelResult.primaryRank).toBe(5); // 5 is high card in wheel
      expect(wheelResult.name).toContain('5高顺子');
    });

    test('should simulate tournament-style blind increases', () => {
      const players = ['p1', 'p2', 'p3', 'p4'];
      positionManager.setPlayers(players);

      // Start with initial blinds
      expect(positionManager.getBlindAmounts()).toEqual({ smallBlind: 10, bigBlind: 20 });

      // Simulate blind level increase
      positionManager.updateBlindAmounts(25, 50);
      expect(positionManager.getBlindAmounts()).toEqual({ smallBlind: 25, bigBlind: 50 });

      // Another increase
      positionManager.updateBlindAmounts(50, 100);
      expect(positionManager.getBlindAmounts()).toEqual({ smallBlind: 50, bigBlind: 100 });
    });

    test('should handle player elimination correctly', () => {
      const players = ['p1', 'p2', 'p3', 'p4'];
      positionManager.setPlayers(players, 1); // p2 is dealer

      expect(positionManager.getPlayerCount()).toBe(4);
      expect(positionManager.getDealerId()).toBe('p2');

      // Eliminate a player
      positionManager.removePlayer('p3');
      expect(positionManager.getPlayerCount()).toBe(3);
      expect(positionManager.getAllPlayerIds()).toEqual(['p1', 'p2', 'p4']);

      // Eliminate the dealer
      positionManager.removePlayer('p2');
      expect(positionManager.getPlayerCount()).toBe(2);
      expect(positionManager.getDealerId()).toBe('p4'); // Next player becomes dealer
    });
  });

  describe('Performance and stress tests', () => {
    test('should handle large number of hand evaluations efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10000; i++) {
        deck.reset();
        deck.shuffle();
        const cards = deck.dealCards(7);
        HandEvaluator.evaluateHand(cards);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should be able to evaluate 10,000 hands in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    test('should handle complex pot calculations efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        potManager.reset();
        
        // Simulate 9 players with various bet amounts
        for (let j = 1; j <= 9; j++) {
          potManager.addBet(`player${j}`, j * 10 + Math.random() * 50);
        }
        
        const players = Array.from({ length: 9 }, (_, i) => `player${i + 1}`);
        potManager.calculatePots(players);
        potManager.validatePots();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(2000); // 2 seconds max
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle deck running out of cards gracefully', () => {
      // Deal most of the deck
      while (deck.getRemainingCount() > 5) {
        deck.deal();
      }

      // Try to deal more cards than available
      const cards = deck.dealCards(10);
      expect(cards.length).toBeLessThanOrEqual(5);
      expect(deck.isEmpty()).toBe(true);
    });

    test('should handle invalid hand evaluation input', () => {
      expect(() => {
        HandEvaluator.evaluateHand(Deck.parseCards(['AS', 'KH', 'QD'])); // Only 3 cards
      }).toThrow();

      expect(() => {
        HandEvaluator.evaluateHand(Deck.parseCards(['AS', 'KH', 'QD', 'JS', '10H', '9C', '8S', '7D'])); // 8 cards
      }).toThrow();
    });

    test('should handle pot distribution with no winners', () => {
      potManager.addBet('player1', 100);
      potManager.calculatePots(['player1']);

      const winnings = potManager.distributePots({}); // No winners specified
      expect(Object.keys(winnings)).toHaveLength(0);
    });

    test('should validate game state consistency', () => {
      // All components should start in valid state
      expect(positionManager.validateState()).toBe(true);
      expect(potManager.validatePots()).toBe(true);
      expect(deck.getRemainingCount()).toBe(52);

      // After setting up a game
      positionManager.setPlayers(['p1', 'p2', 'p3']);
      potManager.addBet('p1', 50);
      potManager.calculatePots(['p1', 'p2', 'p3']);

      expect(positionManager.validateState()).toBe(true);
      expect(potManager.validatePots()).toBe(true);
    });
  });
});