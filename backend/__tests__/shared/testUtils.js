"use strict";
/**
 * 后端测试工具库
 * 提供通用的测试辅助函数和Mock工具
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestUtils = void 0;
const GameState_1 = require("../../src/game/GameState");
const Card_1 = require("../../src/game/Card");
class TestUtils {
    /**
     * 创建测试用的玩家数据
     */
    static createTestPlayer(id, chips = 1000, name) {
        return {
            id,
            name: name || `Player_${id}`,
            chips,
            currentBet: 0,
            hasActed: false,
            isAllIn: false,
            hasFolded: false,
            cards: [],
            position: 0,
            isDealer: false,
            isSmallBlind: false,
            isBigBlind: false,
            timeoutId: null,
            isActive: true
        };
    }
    /**
     * 创建测试用的扑克牌
     */
    static createTestCard(suit, rank) {
        return new Card_1.Card(suit, rank);
    }
    /**
     * 创建测试用的游戏状态
     */
    static createTestGameState(roomId, players = []) {
        const gameState = new GameState_1.GameState(roomId, 10, 20);
        players.forEach(player => gameState.addPlayer(player));
        return gameState;
    }
    /**
     * 等待指定时间
     */
    static delay(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => setTimeout(resolve, ms));
        });
    }
    /**
     * 生成随机字符串
     */
    static randomString(length = 8) {
        return Math.random().toString(36).substring(2, 2 + length);
    }
    /**
     * 验证游戏状态的一致性
     */
    static validateGameState(gameState) {
        // 基本验证逻辑
        const players = gameState.getPlayers();
        return players.length >= 0 && players.length <= 9;
    }
}
exports.TestUtils = TestUtils;
