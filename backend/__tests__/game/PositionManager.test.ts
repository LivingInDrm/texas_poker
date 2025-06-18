import { PositionManager } from '../../src/game/PositionManager';

describe('PositionManager', () => {
  let positionManager: PositionManager;

  beforeEach(() => {
    positionManager = new PositionManager(10, 20); // Small blind: 10, Big blind: 20
  });

  describe('Constructor and basic setup', () => {
    test('should initialize with correct blind amounts', () => {
      const blinds = positionManager.getBlindAmounts();
      expect(blinds.smallBlind).toBe(10);
      expect(blinds.bigBlind).toBe(20);
    });

    test('should start with empty player list', () => {
      expect(positionManager.getPlayerCount()).toBe(0);
      expect(positionManager.getAllPlayerIds()).toEqual([]);
    });
  });

  describe('Player management', () => {
    test('should add players correctly', () => {
      positionManager.setPlayers(['player1', 'player2', 'player3']);

      expect(positionManager.getPlayerCount()).toBe(3);
      expect(positionManager.getAllPlayerIds()).toEqual(['player1', 'player2', 'player3']);
    });

    test('should throw error with insufficient players', () => {
      expect(() => positionManager.setPlayers(['player1'])).toThrow('At least 2 players required');
    });

    test('should set initial dealer position', () => {
      positionManager.setPlayers(['player1', 'player2', 'player3'], 1);
      expect(positionManager.getDealerId()).toBe('player2');
    });

    test('should handle invalid initial dealer index', () => {
      positionManager.setPlayers(['player1', 'player2', 'player3'], 5);
      expect(positionManager.getDealerId()).toBe('player3'); // Should clamp to valid range
    });
  });

  describe('Position identification - 2 players (heads-up)', () => {
    beforeEach(() => {
      positionManager.setPlayers(['player1', 'player2'], 0);
    });

    test('should identify dealer (small blind) correctly', () => {
      expect(positionManager.getDealerId()).toBe('player1');
      expect(positionManager.getSmallBlindId()).toBe('player1');
    });

    test('should identify big blind correctly', () => {
      expect(positionManager.getBigBlindId()).toBe('player2');
    });

    test('should rotate positions correctly', () => {
      positionManager.nextHand();
      
      expect(positionManager.getDealerId()).toBe('player2');
      expect(positionManager.getSmallBlindId()).toBe('player2');
      expect(positionManager.getBigBlindId()).toBe('player1');
    });
  });

  describe('Position identification - 3+ players', () => {
    beforeEach(() => {
      positionManager.setPlayers(['player1', 'player2', 'player3', 'player4'], 0);
    });

    test('should identify positions correctly', () => {
      expect(positionManager.getDealerId()).toBe('player1');
      expect(positionManager.getSmallBlindId()).toBe('player2');
      expect(positionManager.getBigBlindId()).toBe('player3');
    });

    test('should handle position rotation', () => {
      positionManager.nextHand();
      
      expect(positionManager.getDealerId()).toBe('player2');
      expect(positionManager.getSmallBlindId()).toBe('player3');
      expect(positionManager.getBigBlindId()).toBe('player4');
    });

    test('should wrap around correctly', () => {
      // Move to last player as dealer
      for (let i = 0; i < 3; i++) {
        positionManager.nextHand();
      }
      
      expect(positionManager.getDealerId()).toBe('player4');
      expect(positionManager.getSmallBlindId()).toBe('player1');
      expect(positionManager.getBigBlindId()).toBe('player2');
    });
  });

  describe('Player position information', () => {
    beforeEach(() => {
      positionManager.setPlayers(['player1', 'player2', 'player3'], 0);
    });

    test('should get all positions correctly', () => {
      const positions = positionManager.getAllPositions();

      expect(positions).toHaveLength(3);
      expect(positions[0]).toEqual({
        playerId: 'player1',
        seatIndex: 0,
        isDealer: true,
        isSmallBlind: false,
        isBigBlind: false
      });
      expect(positions[1]).toEqual({
        playerId: 'player2',
        seatIndex: 1,
        isDealer: false,
        isSmallBlind: true,
        isBigBlind: false
      });
      expect(positions[2]).toEqual({
        playerId: 'player3',
        seatIndex: 2,
        isDealer: false,
        isSmallBlind: false,
        isBigBlind: true
      });
    });

    test('should get specific player position', () => {
      const position = positionManager.getPlayerPosition('player2');

      expect(position).toEqual({
        playerId: 'player2',
        seatIndex: 1,
        isDealer: false,
        isSmallBlind: true,
        isBigBlind: false
      });
    });

    test('should return null for non-existent player', () => {
      const position = positionManager.getPlayerPosition('nonexistent');
      expect(position).toBeNull();
    });
  });

  describe('Betting order', () => {
    beforeEach(() => {
      positionManager.setPlayers(['player1', 'player2', 'player3', 'player4'], 0);
    });

    test('should get correct post-flop betting order (small blind first)', () => {
      const bettingOrder = positionManager.getBettingOrder();
      expect(bettingOrder).toEqual(['player2', 'player3', 'player4', 'player1']);
    });

    test('should get correct pre-flop betting order (after big blind)', () => {
      const preflopOrder = positionManager.getPreflopBettingOrder();
      expect(preflopOrder).toEqual(['player4', 'player1', 'player2', 'player3']);
    });

    test('should exclude all-in players from betting order', () => {
      const bettingOrder = positionManager.getBettingOrder(['player2', 'player4']);
      expect(bettingOrder).toEqual(['player3', 'player1']);
    });

    test('should handle empty active players list', () => {
      const bettingOrder = positionManager.getBettingOrder(['player1', 'player2', 'player3', 'player4']);
      expect(bettingOrder).toEqual([]);
    });
  });

  describe('Blind management', () => {
    test('should update blind amounts', () => {
      positionManager.updateBlindAmounts(25, 50);
      
      const blinds = positionManager.getBlindAmounts();
      expect(blinds.smallBlind).toBe(25);
      expect(blinds.bigBlind).toBe(50);
    });

    test('should validate blind amounts', () => {
      expect(() => positionManager.updateBlindAmounts(0, 20)).toThrow('Blind amounts must be positive');
      expect(() => positionManager.updateBlindAmounts(-10, 20)).toThrow('Blind amounts must be positive');
      expect(() => positionManager.updateBlindAmounts(20, 10)).toThrow('Big blind must be greater than small blind');
      expect(() => positionManager.updateBlindAmounts(20, 20)).toThrow('Big blind must be greater than small blind');
    });
  });

  describe('Dynamic player management', () => {
    beforeEach(() => {
      positionManager.setPlayers(['player1', 'player2', 'player3', 'player4'], 1); // player2 is dealer
    });

    test('should remove player correctly', () => {
      positionManager.removePlayer('player3');
      
      expect(positionManager.getPlayerCount()).toBe(3);
      expect(positionManager.getAllPlayerIds()).toEqual(['player1', 'player2', 'player4']);
    });

    test('should adjust dealer position when removing player before dealer', () => {
      positionManager.removePlayer('player1'); // Remove player before dealer
      
      expect(positionManager.getDealerId()).toBe('player2'); // Should still be dealer
      expect(positionManager.getAllPlayerIds()).toEqual(['player2', 'player3', 'player4']);
    });

    test('should adjust dealer position when removing current dealer', () => {
      positionManager.removePlayer('player2'); // Remove current dealer
      
      expect(positionManager.getDealerId()).toBe('player3'); // Next player becomes dealer
    });

    test('should add player at specific position', () => {
      positionManager.addPlayer('player5', 2);
      
      expect(positionManager.getAllPlayerIds()).toEqual(['player1', 'player2', 'player5', 'player3', 'player4']);
    });

    test('should add player at end if no position specified', () => {
      positionManager.addPlayer('player5');
      
      expect(positionManager.getAllPlayerIds()).toEqual(['player1', 'player2', 'player3', 'player4', 'player5']);
    });

    test('should not add duplicate players', () => {
      positionManager.addPlayer('player2'); // Already exists
      
      expect(positionManager.getPlayerCount()).toBe(4);
      expect(positionManager.getAllPlayerIds()).toEqual(['player1', 'player2', 'player3', 'player4']);
    });
  });

  describe('Utility methods', () => {
    beforeEach(() => {
      positionManager.setPlayers(['player1', 'player2', 'player3'], 1);
    });

    test('should check if player exists', () => {
      expect(positionManager.hasPlayer('player2')).toBe(true);
      expect(positionManager.hasPlayer('nonexistent')).toBe(false);
    });

    test('should provide debug information', () => {
      const debugInfo = positionManager.getDebugInfo();
      
      expect(debugInfo).toHaveProperty('players');
      expect(debugInfo).toHaveProperty('dealerIndex');
      expect(debugInfo).toHaveProperty('dealerId');
      expect(debugInfo).toHaveProperty('smallBlindId');
      expect(debugInfo).toHaveProperty('bigBlindId');
      expect(debugInfo).toHaveProperty('blindAmounts');
      expect(debugInfo).toHaveProperty('positions');
    });

    test('should validate state correctly', () => {
      expect(positionManager.validateState()).toBe(true);
    });

    test('should detect invalid state', () => {
      // Start with valid state, then create invalid state manually
      positionManager.setPlayers(['player1', 'player2']);
      
      // Manually create invalid state by removing all players except one
      (positionManager as any).players = ['player1']; // Single player is invalid
      expect(positionManager.validateState()).toBe(false);
    });

    test('should copy state from another PositionManager', () => {
      const other = new PositionManager(5, 10);
      other.setPlayers(['playerA', 'playerB'], 1);
      other.nextHand();
      
      positionManager.copyFrom(other);
      
      expect(positionManager.getAllPlayerIds()).toEqual(['playerA', 'playerB']);
      expect(positionManager.getDealerId()).toBe('playerA');
      expect(positionManager.getBlindAmounts()).toEqual({ smallBlind: 5, bigBlind: 10 });
    });
  });

  describe('Edge cases', () => {
    test('should handle minimum 2 players scenario', () => {
      positionManager.setPlayers(['player1', 'player2']);
      
      expect(positionManager.getDealerId()).toBe('player1');
      expect(positionManager.getSmallBlindId()).toBe('player1'); // Dealer is small blind in heads-up
      expect(positionManager.getBigBlindId()).toBe('player2');
    });

    test('should handle empty operations gracefully', () => {
      expect(positionManager.getDealerId()).toBeNull();
      expect(positionManager.getSmallBlindId()).toBeNull();
      expect(positionManager.getBigBlindId()).toBeNull();
      expect(positionManager.getBettingOrder()).toEqual([]);
      expect(positionManager.getPreflopBettingOrder()).toEqual([]);
    });

    test('should handle next hand with no players', () => {
      positionManager.nextHand(); // Should not crash
      expect(positionManager.getDealerId()).toBeNull();
    });
  });
});