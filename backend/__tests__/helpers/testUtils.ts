/**
 * 后端测试工具库
 * 提供通用的测试辅助函数和Mock工具
 */

import { GameState } from '../../src/game/GameState';
import { Card } from '../../src/game/Card';
import { Player } from '../../src/types/socket';

export class TestUtils {
  /**
   * 创建测试用的玩家数据
   */
  static createTestPlayer(id: string, chips = 1000, name?: string): Player {
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
  static createTestCard(suit: string, rank: string): Card {
    return new Card(suit, rank);
  }

  /**
   * 创建测试用的游戏状态
   */
  static createTestGameState(roomId: string, players: Player[] = []): GameState {
    const gameState = new GameState(roomId, 10, 20);
    players.forEach(player => gameState.addPlayer(player));
    return gameState;
  }

  /**
   * 等待指定时间
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成随机字符串
   */
  static randomString(length = 8): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * 验证游戏状态的一致性
   */
  static validateGameState(gameState: GameState): boolean {
    // 基本验证逻辑
    const players = gameState.getPlayers();
    return players.length >= 0 && players.length <= 9;
  }
}