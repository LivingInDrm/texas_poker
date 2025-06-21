"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomStateAssertions = exports.RoomStateFactory = void 0;
/**
 * 房间状态数据工厂
 * 统一创建测试中使用的房间状态数据，避免在多个文件中重复定义
 */
class RoomStateFactory {
    /**
     * 创建基本的房间状态
     * 适用于大多数测试场景
     */
    static createBasicRoomState(overrides = {}) {
        var _a, _b;
        // 生成唯一ID，避免测试中的ID冲突
        const roomId = overrides.id || `room-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
        const ownerId = overrides.ownerId || `owner-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
        const defaultState = {
            id: roomId,
            ownerId: ownerId,
            status: 'WAITING',
            maxPlayers: 6,
            currentPlayerCount: 1,
            hasPassword: false,
            bigBlind: 20,
            smallBlind: 10,
            players: [
                this.createBasicPlayer({
                    id: ownerId,
                    username: 'roomowner'
                })
            ],
            gameStarted: false
        };
        return Object.assign(Object.assign(Object.assign({}, defaultState), overrides), { 
            // 确保currentPlayerCount与players数组长度一致
            currentPlayerCount: (_b = (_a = overrides.players) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : defaultState.currentPlayerCount });
    }
    /**
     * 创建空房间状态
     * 用于测试房间创建场景
     */
    static createEmptyRoomState(overrides = {}) {
        return this.createBasicRoomState(Object.assign({ currentPlayerCount: 0, players: [] }, overrides));
    }
    /**
     * 创建满员房间状态
     * 用于测试房间满员的情况
     */
    static createFullRoomState(overrides = {}) {
        const players = Array.from({ length: 6 }, (_, index) => this.createBasicPlayer({
            id: `player-${index + 1}`,
            username: `player${index + 1}`,
            position: index
        }));
        return this.createBasicRoomState(Object.assign({ currentPlayerCount: 6, maxPlayers: 6, players }, overrides));
    }
    /**
     * 创建游戏进行中的房间状态
     * 用于测试游戏相关功能
     */
    static createGameInProgressState(overrides = {}) {
        var _a;
        // 如果传入了players，使用传入的players；否则根据currentPlayerCount生成
        const playerCount = overrides.currentPlayerCount || ((_a = overrides.players) === null || _a === void 0 ? void 0 : _a.length) || 2;
        const players = overrides.players || Array.from({ length: playerCount }, (_, index) => this.createBasicPlayer({
            id: `player-${index + 1}`,
            username: `player${index + 1}`,
            position: index,
            chips: 4800 + (index * 100) // 轻微的筹码差异
        }));
        return this.createBasicRoomState(Object.assign({ status: 'PLAYING', gameStarted: true, currentPlayerCount: players.length, players, gameState: this.createBasicGameState() }, overrides));
    }
    /**
     * 创建有密码的房间状态
     * 用于测试密码验证功能
     */
    static createPasswordProtectedRoomState(overrides = {}) {
        return this.createBasicRoomState(Object.assign({ hasPassword: true }, overrides));
    }
    /**
     * 创建基本的玩家数据
     */
    static createBasicPlayer(overrides = {}) {
        const defaultPlayer = {
            id: 'player-123',
            username: 'testplayer',
            avatar: undefined,
            chips: 5000,
            isReady: false,
            position: 0,
            isConnected: true,
            lastAction: undefined
        };
        return Object.assign(Object.assign({}, defaultPlayer), overrides);
    }
    /**
     * 创建多个玩家的数组
     */
    static createPlayersArray(count, baseOverrides = {}) {
        return Array.from({ length: count }, (_, index) => this.createBasicPlayer(Object.assign({ id: `player-${index + 1}`, username: `player${index + 1}`, position: index }, baseOverrides)));
    }
    /**
     * 创建基本的游戏状态
     */
    static createBasicGameState(overrides = {}) {
        const defaultGameState = {
            phase: 'preflop',
            players: [],
            dealerIndex: 0,
            smallBlindIndex: 1,
            bigBlindIndex: 2,
            currentPlayerIndex: 0,
            board: [],
            pot: 30,
            sidePots: [],
            currentBet: 20,
            roundBets: {},
            history: [],
            timeout: 30000,
            gameId: 'game-123',
            roomId: 'room-123'
        };
        return Object.assign(Object.assign({}, defaultGameState), overrides);
    }
    /**
     * 创建不同游戏阶段的房间状态
     */
    static createRoomWithGamePhase(phase, overrides = {}) {
        const board = {
            preflop: [],
            flop: ['Ah', 'Ks', 'Qd'],
            turn: ['Ah', 'Ks', 'Qd', 'Jc'],
            river: ['Ah', 'Ks', 'Qd', 'Jc', 'Th']
        };
        return this.createGameInProgressState(Object.assign({ gameState: this.createBasicGameState({
                phase,
                board: board[phase]
            }) }, overrides));
    }
    /**
     * 为特定测试场景创建房间状态的便捷方法
     */
    static forTestScenario(scenario, customOverrides = {}) {
        var _a, _b;
        const scenarios = {
            'room-join-success': () => this.createBasicRoomState({ currentPlayerCount: 2 }),
            'room-join-full': () => this.createFullRoomState(),
            'room-join-password': () => this.createPasswordProtectedRoomState(),
            'room-leave-owner-transfer': () => this.createBasicRoomState({
                currentPlayerCount: 3,
                players: this.createPlayersArray(3)
            }),
            'game-in-progress': () => this.createGameInProgressState(),
            'empty-room': () => this.createEmptyRoomState(),
            'waiting-room': () => this.createBasicRoomState({ status: 'WAITING' }),
            'playing-room': () => this.createGameInProgressState({ status: 'PLAYING' })
        };
        const baseState = (_b = (_a = scenarios[scenario]) === null || _a === void 0 ? void 0 : _a.call(scenarios)) !== null && _b !== void 0 ? _b : this.createBasicRoomState();
        return Object.assign(Object.assign({}, baseState), customOverrides);
    }
}
exports.RoomStateFactory = RoomStateFactory;
/**
 * 房间状态断言辅助工具
 * 提供常用的房间状态验证方法
 */
class RoomStateAssertions {
    /**
     * 验证房间状态的基本完整性
     */
    static assertValidRoomState(roomState) {
        expect(roomState).toBeDefined();
        expect(roomState.id).toBeTruthy();
        expect(roomState.ownerId).toBeTruthy();
        expect(roomState.currentPlayerCount).toBe(roomState.players.length);
        expect(roomState.maxPlayers).toBeGreaterThan(0);
        expect(roomState.bigBlind).toBeGreaterThan(roomState.smallBlind);
    }
    /**
     * 验证玩家在房间中
     */
    static assertPlayerInRoom(roomState, playerId) {
        const player = roomState.players.find(p => p.id === playerId);
        expect(player).toBeDefined();
        return player;
    }
    /**
     * 验证玩家不在房间中
     */
    static assertPlayerNotInRoom(roomState, playerId) {
        const player = roomState.players.find(p => p.id === playerId);
        expect(player).toBeUndefined();
    }
    /**
     * 验证房间状态
     */
    static assertRoomStatus(roomState, expectedStatus) {
        expect(roomState.status).toBe(expectedStatus);
    }
    /**
     * 验证房间玩家数量
     */
    static assertPlayerCount(roomState, expectedCount) {
        expect(roomState.currentPlayerCount).toBe(expectedCount);
        expect(roomState.players).toHaveLength(expectedCount);
    }
}
exports.RoomStateAssertions = RoomStateAssertions;
