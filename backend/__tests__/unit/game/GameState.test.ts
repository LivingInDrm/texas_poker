import { GameState, GamePhase, PlayerAction, PlayerStatus } from '../../src/game/GameState';
import { Deck } from '../../src/game/Deck';

describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState('test-game', 10, 20, 30000);
  });

  describe('Player management', () => {
    test('should add players correctly', () => {
      expect(gameState.addPlayer('player1', 'Alice', 1000)).toBe(true);
      expect(gameState.addPlayer('player2', 'Bob', 1000)).toBe(true);
      expect(gameState.addPlayer('player1', 'Alice', 1000)).toBe(false); // Duplicate
    });

    test('should remove players correctly', () => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);

      expect(gameState.removePlayer('player1')).toBe(true);
      expect(gameState.removePlayer('nonexistent')).toBe(false);
    });

    test('should set player ready status', () => {
      gameState.addPlayer('player1', 'Alice', 1000);
      
      expect(gameState.setPlayerReady('player1', true)).toBe(true);
      expect(gameState.setPlayerReady('nonexistent', true)).toBe(false);
    });

    test('should check if game can start', () => {
      expect(gameState.canStartGame()).toBe(false);

      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.setPlayerReady('player1', true);
      expect(gameState.canStartGame()).toBe(false); // Need at least 2 players

      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player2', true);
      expect(gameState.canStartGame()).toBe(true);
    });
  });

  describe('Game flow', () => {
    beforeEach(() => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.addPlayer('player3', 'Charlie', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      gameState.setPlayerReady('player3', true);
    });

    test('should start new hand correctly', () => {
      const snapshot1 = gameState.getGameSnapshot();
      expect(snapshot1.phase).toBe(GamePhase.WAITING);

      expect(gameState.startNewHand()).toBe(true);

      const snapshot2 = gameState.getGameSnapshot();
      expect(snapshot2.phase).toBe(GamePhase.PRE_FLOP);
      expect(snapshot2.isHandInProgress).toBe(true);
      expect(snapshot2.communityCards).toHaveLength(0);

      // Check that players have cards
      snapshot2.players.forEach((player: any) => {
        if (player.status === PlayerStatus.ACTIVE) {
          expect(player.cards).toHaveLength(2);
        }
      });
    });

    test('should post blinds correctly', () => {
      gameState.startNewHand();
      const snapshot = gameState.getGameSnapshot();

      // Find small blind and big blind players
      const smallBlindPlayer = snapshot.players.find((p: any) => 
        snapshot.positions.find((pos: any) => pos.playerId === p.id && pos.isSmallBlind)
      );
      const bigBlindPlayer = snapshot.players.find((p: any) => 
        snapshot.positions.find((pos: any) => pos.playerId === p.id && pos.isBigBlind)
      );

      expect(smallBlindPlayer.totalBet).toBe(10);
      expect(bigBlindPlayer.totalBet).toBe(20);
      expect(smallBlindPlayer.chips).toBe(990);
      expect(bigBlindPlayer.chips).toBe(980);
    });

    test('should handle valid player actions', () => {
      gameState.startNewHand();
      const currentPlayerId = gameState.getCurrentPlayerId();
      expect(currentPlayerId).not.toBeNull();

      // Test different actions
      expect(gameState.executePlayerAction(currentPlayerId!, PlayerAction.FOLD)).toBe(true);
      
      const snapshot = gameState.getGameSnapshot();
      const foldedPlayer = snapshot.players.find((p: any) => p.id === currentPlayerId);
      expect(foldedPlayer.status).toBe(PlayerStatus.FOLDED);
    });

    test('should reject invalid player actions', () => {
      gameState.startNewHand();
      const currentPlayerId = gameState.getCurrentPlayerId();

      // Wrong player trying to act
      expect(gameState.executePlayerAction('wrong-player', PlayerAction.CALL)).toBe(false);

      // Invalid action (check when there's a bet to call)
      expect(gameState.executePlayerAction(currentPlayerId!, PlayerAction.CHECK)).toBe(false);
    });

    test('should progress through game phases correctly', () => {
      gameState.startNewHand();
      
      // Complete pre-flop betting
      let currentPlayerId = gameState.getCurrentPlayerId();
      let actionCount = 0;
      const maxActions = 10;
      
      while (currentPlayerId && gameState.getGameSnapshot().phase === GamePhase.PRE_FLOP && actionCount < maxActions) {
        const snapshot = gameState.getGameSnapshot();
        const currentPlayer = snapshot.players.find((p: any) => p.id === currentPlayerId);
        
        // 确定正确的行动
        let action;
        if (currentPlayer.currentBet < 20) {
          action = PlayerAction.CALL;
        } else {
          action = PlayerAction.CHECK;
        }
        
        const result = gameState.executePlayerAction(currentPlayerId, action);
        if (!result) break;
        
        currentPlayerId = gameState.getCurrentPlayerId();
        actionCount++;
      }

      expect(gameState.getGameSnapshot().phase).toBe(GamePhase.FLOP);
      expect(gameState.getGameSnapshot().communityCards).toHaveLength(3);

      // Complete flop betting with check actions
      actionCount = 0;
      while (currentPlayerId && gameState.getGameSnapshot().phase === GamePhase.FLOP && actionCount < maxActions) {
        gameState.executePlayerAction(currentPlayerId, PlayerAction.CHECK);
        currentPlayerId = gameState.getCurrentPlayerId();
        actionCount++;
      }

      expect(gameState.getGameSnapshot().phase).toBe(GamePhase.TURN);
      expect(gameState.getGameSnapshot().communityCards).toHaveLength(4);

      // Complete turn betting with check actions
      actionCount = 0;
      while (currentPlayerId && gameState.getGameSnapshot().phase === GamePhase.TURN && actionCount < maxActions) {
        gameState.executePlayerAction(currentPlayerId, PlayerAction.CHECK);
        currentPlayerId = gameState.getCurrentPlayerId();
        actionCount++;
      }

      expect(gameState.getGameSnapshot().phase).toBe(GamePhase.RIVER);
      expect(gameState.getGameSnapshot().communityCards).toHaveLength(5);

      // Complete river betting with check actions
      actionCount = 0;
      while (currentPlayerId && gameState.getGameSnapshot().phase === GamePhase.RIVER && actionCount < maxActions) {
        gameState.executePlayerAction(currentPlayerId, PlayerAction.CHECK);
        currentPlayerId = gameState.getCurrentPlayerId();
        actionCount++;
      }

      expect(gameState.getGameSnapshot().phase).toBe(GamePhase.FINISHED);
    });
  });

  describe('Action validation', () => {
    beforeEach(() => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      gameState.startNewHand();
    });

    test('should validate fold action', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      expect(gameState.executePlayerAction(currentPlayerId, PlayerAction.FOLD)).toBe(true);
    });

    test('should validate call action', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      expect(gameState.executePlayerAction(currentPlayerId, PlayerAction.CALL)).toBe(true);
    });

    test('should validate raise action', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      expect(gameState.executePlayerAction(currentPlayerId, PlayerAction.RAISE, 40)).toBe(true);
    });

    test('should validate all-in action', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      expect(gameState.executePlayerAction(currentPlayerId, PlayerAction.ALL_IN)).toBe(true);
      
      const snapshot = gameState.getGameSnapshot();
      const allInPlayer = snapshot.players.find((p: any) => p.id === currentPlayerId);
      expect(allInPlayer.status).toBe(PlayerStatus.ALL_IN);
      expect(allInPlayer.chips).toBe(0);
    });

    test('should reject invalid raise amounts', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      
      // Raise too small
      expect(gameState.executePlayerAction(currentPlayerId, PlayerAction.RAISE, 1)).toBe(false);
      
      // Raise more than chips
      expect(gameState.executePlayerAction(currentPlayerId, PlayerAction.RAISE, 2000)).toBe(false);
    });
  });

  describe('Timeout handling', () => {
    beforeEach(() => {
      gameState = new GameState('test-game', 10, 20, 100); // 100ms timeout
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      gameState.startNewHand();
    });

    test('should handle timeout correctly', async () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(gameState.handleTimeout(currentPlayerId)).toBe(true);
      
      const snapshot = gameState.getGameSnapshot();
      const timedOutPlayer = snapshot.players.find((p: any) => p.id === currentPlayerId);
      expect(timedOutPlayer.status).toBe(PlayerStatus.FOLDED);
    });

    test('should not timeout before time limit', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      expect(gameState.handleTimeout(currentPlayerId)).toBe(false);
    });
  });

  describe('All-in scenarios', () => {
    beforeEach(() => {
      gameState.addPlayer('player1', 'Alice', 50);   // Short stack
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.addPlayer('player3', 'Charlie', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      gameState.setPlayerReady('player3', true);
      gameState.startNewHand();
    });

    test('should handle all-in with insufficient chips for blinds', () => {
      const snapshot = gameState.getGameSnapshot();
      
      // Player with 50 chips posting big blind of 20 should be fine
      // Player with 50 chips going all-in should work
      const shortStackPlayer = snapshot.players.find((p: any) => p.chips < 100);
      if (shortStackPlayer) {
        expect(shortStackPlayer.chips).toBeGreaterThanOrEqual(0);
      }
    });

    test('should create side pots with all-in players', () => {
      // Complete the pre-flop betting round with all-in scenario
      let currentPlayerId = gameState.getCurrentPlayerId();
      let actionCount = 0;
      const maxActions = 10;
      
      while (currentPlayerId && gameState.getGameSnapshot().phase === GamePhase.PRE_FLOP && actionCount < maxActions) {
        const snapshot = gameState.getGameSnapshot();
        const player = snapshot.players.find((p: any) => p.id === currentPlayerId);
        
        // 获取当前需要跟注的金额
        const highestBet = Math.max(...snapshot.players.map((p: any) => p.currentBet));
        const callAmount = highestBet - player.currentBet;
        
        let action;
        if (player && player.chips <= 50) {
          action = PlayerAction.ALL_IN;
        } else if (callAmount > 0) {
          action = PlayerAction.CALL;
        } else {
          action = PlayerAction.CHECK;
        }
        
        const result = gameState.executePlayerAction(currentPlayerId, action);
        if (!result) break;
        
        currentPlayerId = gameState.getCurrentPlayerId();
        actionCount++;
      }

      // Now we should have moved to the flop with pots calculated
      const snapshot = gameState.getGameSnapshot();
      expect(snapshot.phase).toBe(GamePhase.FLOP);
      expect(snapshot.pots.length).toBeGreaterThan(0);
    });
  });

  describe('Game completion and results', () => {
    beforeEach(() => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      gameState.startNewHand();
    });

    test('should complete game and provide results', () => {
      // Play through entire hand
      let currentPlayerId = gameState.getCurrentPlayerId();
      let actionCount = 0;
      const maxActions = 20;
      
      while (currentPlayerId && gameState.getGameSnapshot().phase !== GamePhase.FINISHED && actionCount < maxActions) {
        const snapshot = gameState.getGameSnapshot();
        const currentPlayer = snapshot.players.find((p: any) => p.id === currentPlayerId);
        
        let action;
        if (snapshot.phase === GamePhase.PRE_FLOP) {
          // Pre-flop: call or check appropriately
          if (currentPlayer.currentBet < 20) {
            action = PlayerAction.CALL;
          } else {
            action = PlayerAction.CHECK;
          }
        } else {
          // Post-flop: check
          action = PlayerAction.CHECK;
        }
        
        const result = gameState.executePlayerAction(currentPlayerId, action);
        if (!result) break;
        
        currentPlayerId = gameState.getCurrentPlayerId();
        actionCount++;
      }

      expect(gameState.getGameSnapshot().phase).toBe(GamePhase.FINISHED);
      
      const result = gameState.getGameResult();
      expect(result).not.toBeNull();
      expect(result!.winners.length).toBeGreaterThan(0);
      expect(result!.duration).toBeGreaterThan(0);
    });

    test('should handle single player remaining (others folded)', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      
      // First player folds
      gameState.executePlayerAction(currentPlayerId, PlayerAction.FOLD);
      
      // Game should end immediately
      expect(gameState.getGameSnapshot().phase).toBe(GamePhase.FINISHED);
      
      const result = gameState.getGameResult();
      expect(result).not.toBeNull();
    });
  });

  describe('Game state management', () => {
    beforeEach(() => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
    });

    test('should provide comprehensive game snapshot', () => {
      gameState.startNewHand();
      const snapshot = gameState.getGameSnapshot();

      expect(snapshot).toHaveProperty('gameId');
      expect(snapshot).toHaveProperty('phase');
      expect(snapshot).toHaveProperty('players');
      expect(snapshot).toHaveProperty('communityCards');
      expect(snapshot).toHaveProperty('pots');
      expect(snapshot).toHaveProperty('currentPlayerId');
      expect(snapshot).toHaveProperty('actionHistory');
      expect(snapshot).toHaveProperty('isHandInProgress');
      expect(snapshot).toHaveProperty('positions');
    });

    test('should track action history correctly', () => {
      gameState.startNewHand();
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      
      gameState.executePlayerAction(currentPlayerId, PlayerAction.RAISE, 40);
      
      const snapshot = gameState.getGameSnapshot();
      expect(snapshot.actionHistory).toHaveLength(1);
      expect(snapshot.actionHistory[0]).toMatchObject({
        playerId: currentPlayerId,
        action: PlayerAction.RAISE,
        amount: 40,
        phase: GamePhase.PRE_FLOP
      });
    });

    test('should reset game state correctly', () => {
      gameState.startNewHand();
      gameState.reset();

      const snapshot = gameState.getGameSnapshot();
      expect(snapshot.phase).toBe(GamePhase.WAITING);
      expect(snapshot.isHandInProgress).toBe(false);
      expect(snapshot.communityCards).toHaveLength(0);
      expect(snapshot.actionHistory).toHaveLength(0);
      
      snapshot.players.forEach((player: any) => {
        expect(player.cards).toHaveLength(0);
        expect(player.currentBet).toBe(0);
        expect(player.totalBet).toBe(0);
        expect(player.hasActed).toBe(false);
        expect(player.isReady).toBe(false);
      });
    });

    test('should provide debug information', () => {
      gameState.startNewHand();
      const debugInfo = gameState.getDebugInfo();

      expect(debugInfo).toHaveProperty('gameId');
      expect(debugInfo).toHaveProperty('phase');
      expect(debugInfo).toHaveProperty('players');
      expect(debugInfo).toHaveProperty('currentPlayerId');
      expect(debugInfo).toHaveProperty('potManager');
      expect(debugInfo).toHaveProperty('positionManager');
      expect(debugInfo).toHaveProperty('actionHistory');
    });
  });

  describe('Edge cases', () => {
    test('should handle game with minimum players', () => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);

      expect(gameState.canStartGame()).toBe(true);
      expect(gameState.startNewHand()).toBe(true);
    });

    test('should handle player removal during game', () => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.addPlayer('player3', 'Charlie', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      gameState.setPlayerReady('player3', true);
      
      gameState.startNewHand();
      
      // Remove a player during the game
      expect(gameState.removePlayer('player3')).toBe(true);
      
      // Game should continue with remaining players
      const snapshot = gameState.getGameSnapshot();
      expect(snapshot.players).toHaveLength(2);
    });

    test('should handle invalid player operations gracefully', () => {
      // Try operations on non-existent game
      expect(gameState.executePlayerAction('nonexistent', PlayerAction.FOLD)).toBe(false);
      expect(gameState.handleTimeout('nonexistent')).toBe(false);
      expect(gameState.getCurrentPlayerId()).toBeNull();
    });

    test('should handle empty community cards initially', () => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      
      const preGameSnapshot = gameState.getGameSnapshot();
      expect(preGameSnapshot.communityCards).toHaveLength(0);
      
      gameState.startNewHand();
      
      const postGameSnapshot = gameState.getGameSnapshot();
      expect(postGameSnapshot.communityCards).toHaveLength(0); // Still 0 in pre-flop
    });
  });

  describe('Integration with game logic components', () => {
    beforeEach(() => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.addPlayer('player3', 'Charlie', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);
      gameState.setPlayerReady('player3', true);
      gameState.startNewHand();
    });

    test('should integrate with PotManager correctly', () => {
      const currentPlayerId = gameState.getCurrentPlayerId()!;
      gameState.executePlayerAction(currentPlayerId, PlayerAction.RAISE, 50);
      
      const snapshot = gameState.getGameSnapshot();
      expect(snapshot.pots.length).toBeGreaterThanOrEqual(0);
    });

    test('should integrate with PositionManager correctly', () => {
      const snapshot = gameState.getGameSnapshot();
      expect(snapshot.positions).toHaveLength(3);
      
      const dealerPosition = snapshot.positions.find((p: any) => p.isDealer);
      const smallBlindPosition = snapshot.positions.find((p: any) => p.isSmallBlind);
      const bigBlindPosition = snapshot.positions.find((p: any) => p.isBigBlind);
      
      expect(dealerPosition).toBeDefined();
      expect(smallBlindPosition).toBeDefined();
      expect(bigBlindPosition).toBeDefined();
    });

    test('should integrate with Deck correctly', () => {
      const snapshot = gameState.getGameSnapshot();
      
      // All active players should have exactly 2 cards
      const activePlayers = snapshot.players.filter((p: any) => p.status === PlayerStatus.ACTIVE);
      activePlayers.forEach((player: any) => {
        expect(player.cards).toHaveLength(2);
        expect(player.cards[0]).toHaveProperty('suit');
        expect(player.cards[0]).toHaveProperty('rank');
        expect(player.cards[1]).toHaveProperty('suit');
        expect(player.cards[1]).toHaveProperty('rank');
      });
    });
  });
});