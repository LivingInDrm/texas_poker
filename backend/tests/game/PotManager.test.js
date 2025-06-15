"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PotManager_1 = require("../../src/game/PotManager");
describe('PotManager', () => {
    let potManager;
    beforeEach(() => {
        potManager = new PotManager_1.PotManager();
    });
    describe('Basic betting operations', () => {
        test('should start with empty pots and bets', () => {
            expect(potManager.getPots()).toHaveLength(0);
            expect(potManager.getTotalPotAmount()).toBe(0);
            expect(potManager.getHighestBet()).toBe(0);
        });
        test('should track player bets', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 200);
            expect(potManager.getPlayerBet('player1')).toBe(100);
            expect(potManager.getPlayerBet('player2')).toBe(200);
            expect(potManager.getHighestBet()).toBe(200);
        });
        test('should accumulate multiple bets from same player', () => {
            potManager.addBet('player1', 50);
            potManager.addBet('player1', 75);
            expect(potManager.getPlayerBet('player1')).toBe(125);
        });
        test('should calculate call amounts correctly', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 200);
            expect(potManager.getCallAmount('player1')).toBe(100); // Needs 100 more to match 200
            expect(potManager.getCallAmount('player2')).toBe(0); // Already at highest bet
            expect(potManager.getCallAmount('player3')).toBe(200); // New player needs to match 200
        });
        test('should identify when players have called', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 100);
            expect(potManager.hasPlayerCalled('player1')).toBe(true);
            expect(potManager.hasPlayerCalled('player2')).toBe(true);
            expect(potManager.hasPlayerCalled('player3')).toBe(false);
        });
    });
    describe('Pot calculation - Simple scenarios', () => {
        test('should create main pot with equal bets', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 100);
            potManager.addBet('player3', 100);
            potManager.calculatePots(['player1', 'player2', 'player3']);
            const pots = potManager.getPots();
            expect(pots).toHaveLength(1);
            expect(pots[0].type).toBe('main');
            expect(pots[0].amount).toBe(300);
            expect(pots[0].eligiblePlayers).toEqual(['player1', 'player2', 'player3']);
        });
        test('should handle single all-in player', () => {
            potManager.addBet('player1', 50); // All-in
            potManager.addBet('player2', 100);
            potManager.addBet('player3', 100);
            potManager.calculatePots(['player1', 'player2', 'player3']);
            const pots = potManager.getPots();
            expect(pots).toHaveLength(2);
            // Main pot: 50 * 3 = 150
            expect(pots[0].type).toBe('main');
            expect(pots[0].amount).toBe(150);
            expect(pots[0].eligiblePlayers).toEqual(['player1', 'player2', 'player3']);
            // Side pot: 50 * 2 = 100
            expect(pots[1].type).toBe('side');
            expect(pots[1].amount).toBe(100);
            expect(pots[1].eligiblePlayers).toEqual(['player2', 'player3']);
        });
    });
    describe('Pot calculation - Complex all-in scenarios', () => {
        test('should handle multiple all-in amounts', () => {
            potManager.addBet('player1', 25); // All-in with least chips
            potManager.addBet('player2', 50); // All-in with middle chips
            potManager.addBet('player3', 100); // All-in with most chips
            potManager.addBet('player4', 100); // Call
            potManager.calculatePots(['player1', 'player2', 'player3', 'player4']);
            const pots = potManager.getPots();
            expect(pots).toHaveLength(3);
            // Main pot: 25 * 4 = 100 (all 4 players eligible)
            expect(pots[0].type).toBe('main');
            expect(pots[0].amount).toBe(100);
            expect(pots[0].eligiblePlayers).toEqual(['player1', 'player2', 'player3', 'player4']);
            // Side pot 1: 25 * 3 = 75 (player2, player3, player4 eligible)
            expect(pots[1].type).toBe('side');
            expect(pots[1].amount).toBe(75);
            expect(pots[1].eligiblePlayers).toEqual(['player2', 'player3', 'player4']);
            // Side pot 2: 50 * 2 = 100 (player3, player4 eligible)
            expect(pots[2].type).toBe('side');
            expect(pots[2].amount).toBe(100);
            expect(pots[2].eligiblePlayers).toEqual(['player3', 'player4']);
            expect(potManager.getTotalPotAmount()).toBe(275);
        });
        test('should exclude folded players from pots', () => {
            potManager.addBet('player1', 50); // All-in
            potManager.addBet('player2', 100); // Later folds
            potManager.addBet('player3', 100); // Active
            // player2 folded, so only player1 and player3 are active
            potManager.calculatePots(['player1', 'player3']);
            const pots = potManager.getPots();
            expect(pots).toHaveLength(2);
            // Main pot: only active players eligible
            expect(pots[0].eligiblePlayers).toEqual(['player1', 'player3']);
            expect(pots[1].eligiblePlayers).toEqual(['player3']);
        });
    });
    describe('Pot distribution', () => {
        test('should distribute single pot to single winner', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 100);
            potManager.calculatePots(['player1', 'player2']);
            const winners = { 'pot-1': ['player1'] };
            const winnings = potManager.distributePots(winners);
            expect(winnings).toEqual({ player1: 200 });
        });
        test('should split pot evenly between multiple winners', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 100);
            potManager.addBet('player3', 100);
            potManager.calculatePots(['player1', 'player2', 'player3']);
            const winners = { 'pot-1': ['player1', 'player2'] };
            const winnings = potManager.distributePots(winners);
            expect(winnings).toEqual({
                player1: 150,
                player2: 150
            });
        });
        test('should handle odd amounts in split pots', () => {
            potManager.addBet('player1', 50);
            potManager.addBet('player2', 51);
            potManager.addBet('player3', 51);
            potManager.calculatePots(['player1', 'player2', 'player3']);
            // Main pot = 150, Side pot = 2
            const winners = {
                'pot-1': ['player1', 'player2', 'player3'],
                'pot-2': ['player2', 'player3']
            };
            const winnings = potManager.distributePots(winners);
            // Main pot: 150/3 = 50 each
            // Side pot: 2/2 = 1 each
            expect(winnings).toEqual({
                player1: 50,
                player2: 51,
                player3: 51
            });
        });
        test('should distribute multiple pots correctly', () => {
            potManager.addBet('player1', 25);
            potManager.addBet('player2', 50);
            potManager.addBet('player3', 100);
            potManager.calculatePots(['player1', 'player2', 'player3']);
            const winners = {
                'pot-1': ['player1'], // Main pot winner
                'pot-2': ['player2'], // Side pot 1 winner
                'pot-3': ['player3'] // Side pot 2 winner
            };
            const winnings = potManager.distributePots(winners);
            expect(winnings).toEqual({
                player1: 75, // Main pot
                player2: 50, // Side pot 1
                player3: 50 // Side pot 2
            });
        });
    });
    describe('Betting round management', () => {
        test('should clear bets for new betting round', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 200);
            potManager.startNewBettingRound();
            expect(potManager.getPlayerBet('player1')).toBe(0);
            expect(potManager.getPlayerBet('player2')).toBe(0);
            expect(potManager.getHighestBet()).toBe(0);
        });
        test('should preserve pots when starting new round', () => {
            potManager.addBet('player1', 100);
            potManager.calculatePots(['player1']);
            const originalPots = potManager.getPots();
            potManager.startNewBettingRound();
            expect(potManager.getPots()).toEqual(originalPots);
        });
    });
    describe('Utility methods', () => {
        test('should reset completely', () => {
            potManager.addBet('player1', 100);
            potManager.calculatePots(['player1']);
            potManager.reset();
            expect(potManager.getPots()).toHaveLength(0);
            expect(potManager.getTotalPotAmount()).toBe(0);
            expect(potManager.getPlayerBet('player1')).toBe(0);
        });
        test('should provide debug information', () => {
            potManager.addBet('player1', 100);
            potManager.addBet('player2', 200);
            const debugInfo = potManager.getDebugInfo();
            expect(debugInfo).toHaveProperty('pots');
            expect(debugInfo).toHaveProperty('playerBets');
            expect(debugInfo).toHaveProperty('totalPot');
            expect(debugInfo).toHaveProperty('highestBet');
            expect(debugInfo.highestBet).toBe(200);
        });
        test('should validate pot integrity', () => {
            potManager.addBet('player1', 100);
            potManager.calculatePots(['player1']);
            expect(potManager.validatePots()).toBe(true);
        });
        test('getMainPot and getSidePots should work correctly', () => {
            potManager.addBet('player1', 50);
            potManager.addBet('player2', 100);
            potManager.calculatePots(['player1', 'player2']);
            const mainPot = potManager.getMainPot();
            const sidePots = potManager.getSidePots();
            expect(mainPot).not.toBeNull();
            expect(mainPot === null || mainPot === void 0 ? void 0 : mainPot.type).toBe('main');
            expect(sidePots).toHaveLength(1);
            expect(sidePots[0].type).toBe('side');
        });
    });
    describe('Edge cases', () => {
        test('should handle zero bets', () => {
            potManager.calculatePots(['player1', 'player2']);
            expect(potManager.getPots()).toHaveLength(0);
        });
        test('should handle empty active players list', () => {
            potManager.addBet('player1', 100);
            potManager.calculatePots([]);
            const pots = potManager.getPots();
            expect(pots).toHaveLength(0);
        });
        test('should handle single player betting', () => {
            potManager.addBet('player1', 100);
            potManager.calculatePots(['player1']);
            const pots = potManager.getPots();
            expect(pots).toHaveLength(1);
            expect(pots[0].amount).toBe(100);
            expect(pots[0].eligiblePlayers).toEqual(['player1']);
        });
    });
});
