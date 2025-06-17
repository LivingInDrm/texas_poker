import { AuthenticatedSocket, PlayerAction, SOCKET_ERRORS } from '../../types/socket';
import { redisClient } from '../../db';

// 速率限制配置
const RATE_LIMITS = {
  ACTIONS_PER_MINUTE: 60,        // 每分钟最多60个动作
  JOINS_PER_MINUTE: 10,          // 每分钟最多加入10个房间
  MESSAGES_PER_MINUTE: 100       // 每分钟最多100条消息
};

// 验证中间件
export class ValidationMiddleware {
  private actionCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private joinCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private messageCounts: Map<string, { count: number; resetTime: number }> = new Map();

  // 验证玩家行动
  async validatePlayerAction(
    socket: AuthenticatedSocket,
    roomId: string,
    action: PlayerAction
  ): Promise<{ valid: boolean; error?: string }> {
    const { userId } = socket.data;

    // 1. 速率限制检查
    if (!this.checkActionRateLimit(userId)) {
      return {
        valid: false,
        error: 'Too many actions. Please slow down.'
      };
    }

    // 2. 获取房间状态验证
    const roomData = await redisClient.get(`room:${roomId}`);
    if (!roomData) {
      return {
        valid: false,
        error: SOCKET_ERRORS.ROOM_NOT_FOUND
      };
    }

    const roomState = JSON.parse(roomData.toString());

    // 3. 验证玩家是否在房间中
    const player = roomState.players.find((p: any) => p.id === userId);
    if (!player) {
      return {
        valid: false,
        error: SOCKET_ERRORS.PLAYER_NOT_IN_ROOM
      };
    }

    // 4. 验证游戏是否开始
    if (!roomState.gameStarted || !roomState.gameState) {
      return {
        valid: false,
        error: SOCKET_ERRORS.GAME_NOT_STARTED
      };
    }

    // 5. 验证是否轮到该玩家
    const currentPlayer = roomState.gameState.players[roomState.gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== userId) {
      return {
        valid: false,
        error: SOCKET_ERRORS.NOT_PLAYER_TURN
      };
    }

    // 6. 验证玩家状态
    if (currentPlayer.status !== 'active') {
      return {
        valid: false,
        error: 'Player is not in active state'
      };
    }

    // 7. 验证行动类型和金额
    const validationResult = this.validateActionDetails(action, currentPlayer, roomState.gameState);
    if (!validationResult.valid) {
      return validationResult;
    }

    // 8. 防作弊检查
    const antiCheatResult = await this.antiCheatCheck(userId, roomId, action);
    if (!antiCheatResult.valid) {
      return antiCheatResult;
    }

    return { valid: true };
  }

  // 验证房间加入
  async validateRoomJoin(
    socket: AuthenticatedSocket,
    roomId: string,
    password?: string
  ): Promise<{ valid: boolean; error?: string }> {
    const { userId } = socket.data;

    // 1. 速率限制检查
    if (!this.checkJoinRateLimit(userId)) {
      return {
        valid: false,
        error: 'Too many join attempts. Please wait.'
      };
    }

    // 2. 验证房间ID格式
    if (!this.isValidUUID(roomId)) {
      return {
        valid: false,
        error: 'Invalid room ID format'
      };
    }

    // 3. 验证密码格式（如果提供）
    if (password !== undefined && (password.length > 50 || password.length < 1)) {
      return {
        valid: false,
        error: 'Invalid password format'
      };
    }

    return { valid: true };
  }

  // 验证消息速率
  validateMessageRate(userId: string): boolean {
    return this.checkMessageRateLimit(userId);
  }

  // 检查行动速率限制
  private checkActionRateLimit(userId: string): boolean {
    return this.checkRateLimit(userId, this.actionCounts, RATE_LIMITS.ACTIONS_PER_MINUTE);
  }

  // 检查加入速率限制
  private checkJoinRateLimit(userId: string): boolean {
    return this.checkRateLimit(userId, this.joinCounts, RATE_LIMITS.JOINS_PER_MINUTE);
  }

  // 检查消息速率限制
  private checkMessageRateLimit(userId: string): boolean {
    return this.checkRateLimit(userId, this.messageCounts, RATE_LIMITS.MESSAGES_PER_MINUTE);
  }

  // 通用速率限制检查
  private checkRateLimit(
    userId: string,
    countMap: Map<string, { count: number; resetTime: number }>,
    limit: number
  ): boolean {
    const now = Date.now();
    const userCount = countMap.get(userId);

    if (!userCount || now > userCount.resetTime) {
      // 重置计数器
      countMap.set(userId, {
        count: 1,
        resetTime: now + 60000 // 1分钟后重置
      });
      return true;
    }

    if (userCount.count >= limit) {
      return false;
    }

    userCount.count++;
    return true;
  }

  // 验证行动详情
  private validateActionDetails(
    action: PlayerAction,
    player: any,
    gameState: any
  ): { valid: boolean; error?: string } {
    // 验证行动类型
    const validActionTypes = ['fold', 'check', 'call', 'raise', 'allin'];
    if (!validActionTypes.includes(action.type)) {
      return {
        valid: false,
        error: 'Invalid action type'
      };
    }

    // 验证加注金额
    if (action.type === 'raise') {
      if (!action.amount || action.amount <= 0) {
        return {
          valid: false,
          error: 'Invalid raise amount'
        };
      }

      // 验证最小加注
      const minRaise = gameState.currentBet * 2;
      if (action.amount < minRaise) {
        return {
          valid: false,
          error: `Minimum raise is ${minRaise}`
        };
      }

      // 验证筹码是否足够
      if (action.amount > player.chips) {
        return {
          valid: false,
          error: SOCKET_ERRORS.INSUFFICIENT_CHIPS
        };
      }
    }

    // 验证跟注
    if (action.type === 'call') {
      const callAmount = gameState.currentBet - (gameState.roundBets[player.id] || 0);
      if (callAmount > player.chips) {
        return {
          valid: false,
          error: SOCKET_ERRORS.INSUFFICIENT_CHIPS
        };
      }
    }

    // 验证过牌条件
    if (action.type === 'check') {
      const playerBet = gameState.roundBets[player.id] || 0;
      if (playerBet < gameState.currentBet) {
        return {
          valid: false,
          error: 'Cannot check, must call or raise'
        };
      }
    }

    return { valid: true };
  }

  // 防作弊检查
  private async antiCheatCheck(
    userId: string,
    roomId: string,
    action: PlayerAction
  ): Promise<{ valid: boolean; error?: string }> {
    // 1. 检查行动时间间隔（防止机器人）
    const lastActionKey = `last_action:${userId}`;
    const lastActionTime = await redisClient.get(lastActionKey);
    
    if (lastActionTime) {
      const timeDiff = Date.now() - parseInt(lastActionTime.toString());
      if (timeDiff < 500) { // 最少间隔500ms
        return {
          valid: false,
          error: 'Actions too fast. Please slow down.'
        };
      }
    }

    // 记录当前行动时间
    await redisClient.setEx(lastActionKey, 300, Date.now().toString()); // 5分钟过期

    // 2. 检查重复行动
    const actionKey = `action_history:${userId}:${roomId}`;
    const recentActions = await redisClient.lRange(actionKey, 0, 4); // 获取最近5个行动
    
    const actionString = `${action.type}:${action.amount || 0}`;
    const duplicateCount = recentActions.filter((a: string) => a === actionString).length;
    
    if (duplicateCount >= 3) {
      return {
        valid: false,
        error: 'Suspicious repeated actions detected'
      };
    }

    // 记录行动历史
    await redisClient.lPush(actionKey, actionString);
    await redisClient.lTrim(actionKey, 0, 9); // 保留最近10个行动
    await redisClient.expire(actionKey, 3600); // 1小时过期

    // 3. 检查行动模式（简单的机器人检测）
    if (recentActions.length >= 4) {
      const isPattern = this.detectActionPattern(recentActions as string[]);
      if (isPattern) {
        console.warn(`Suspicious action pattern detected for user ${userId}`);
        // 可以选择记录警告而不是直接拒绝
      }
    }

    return { valid: true };
  }

  // 检测行动模式
  private detectActionPattern(actions: string[]): boolean {
    // 检查是否有重复的序列
    const pattern = actions.slice(0, 2).join(',');
    const nextPattern = actions.slice(2, 4).join(',');
    
    return pattern === nextPattern;
  }

  // 验证UUID格式
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // 清理过期的计数器
  cleanup(): void {
    const now = Date.now();
    
    for (const [userId, data] of this.actionCounts.entries()) {
      if (now > data.resetTime) {
        this.actionCounts.delete(userId);
      }
    }

    for (const [userId, data] of this.joinCounts.entries()) {
      if (now > data.resetTime) {
        this.joinCounts.delete(userId);
      }
    }

    for (const [userId, data] of this.messageCounts.entries()) {
      if (now > data.resetTime) {
        this.messageCounts.delete(userId);
      }
    }
  }
}

// 创建全局验证实例
export const validationMiddleware = new ValidationMiddleware();

// 定期清理过期计数器
setInterval(() => {
  validationMiddleware.cleanup();
}, 60000); // 每分钟清理一次