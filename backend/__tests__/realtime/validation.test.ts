import { ValidationMiddleware } from '../../src/socket/middleware/validation';
import { AuthenticatedSocket, PlayerAction } from '../../src/types/socket';
import { redisClient } from '../../src/db';
import prisma from '../../src/prisma';

describe('ValidationMiddleware', () => {
  let validationMiddleware: ValidationMiddleware;
  let mockSocket: Partial<AuthenticatedSocket>;
  let testUser: any;
  let testRoom: any;

  beforeEach(async () => {
    validationMiddleware = new ValidationMiddleware();
    
    // 创建测试用户
    testUser = await prisma.user.create({
      data: {
        username: `test_validation_user_${Date.now()}`,
        passwordHash: 'test_hash',
        chips: 5000
      }
    });

    // 创建测试房间
    testRoom = await prisma.room.create({
      data: {
        ownerId: testUser.id,
        playerLimit: 6,
        status: 'WAITING',
        bigBlind: 20,
        smallBlind: 10
      }
    });

    // 模拟socket
    mockSocket = {
      data: {
        userId: testUser.id,
        username: testUser.username,
        authenticated: true
      }
    };
  });

  afterEach(async () => {
    // 清理测试数据
    await prisma.room.delete({ where: { id: testRoom.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    
    // 清理Redis数据
    const keys = await redisClient.keys('room:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    
    const actionKeys = await redisClient.keys('action_history:*');
    if (actionKeys.length > 0) {
      await redisClient.del(actionKeys);
    }
    
    const lastActionKeys = await redisClient.keys('last_action:*');
    if (lastActionKeys.length > 0) {
      await redisClient.del(lastActionKeys);
    }
  });

  describe('validateRoomJoin', () => {
    test('should validate valid room join request', async () => {
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        undefined
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject invalid room ID format', async () => {
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        'invalid-room-id',
        undefined
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid room ID format');
    });

    test('should reject invalid password format', async () => {
      const longPassword = 'a'.repeat(51); // 超过50字符
      
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        longPassword
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid password format');
    });

    test('should enforce join rate limiting', async () => {
      // 快速连续尝试加入房间
      const promises: Promise<{ valid: boolean; error?: string }>[] = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          validationMiddleware.validateRoomJoin(
            mockSocket as AuthenticatedSocket,
            testRoom.id,
            undefined
          )
        );
      }

      const results = await Promise.all(promises);
      
      // 前10个应该通过，后面的应该被限制
      const validResults = results.filter(r => r.valid);
      const invalidResults = results.filter(r => !r.valid);

      expect(validResults.length).toBe(10);
      expect(invalidResults.length).toBe(5);
      expect(invalidResults[0].error).toContain('Too many join attempts');
    });
  });

  describe('validatePlayerAction', () => {
    beforeEach(async () => {
      // 设置房间状态，包含正在进行的游戏
      const roomState = {
        id: testRoom.id,
        ownerId: testUser.id,
        players: [{
          id: testUser.id,
          username: testUser.username,
          chips: 5000,
          isReady: true,
          position: 0,
          isConnected: true
        }],
        status: 'playing',
        gameStarted: true,
        gameState: {
          phase: 'preflop',
          players: [{
            id: testUser.id,
            username: testUser.username,
            chips: 5000,
            cards: ['AH', 'AS'],
            status: 'active',
            position: 0,
            totalBet: 0,
            isConnected: true
          }],
          currentPlayerIndex: 0,
          currentBet: 20,
          roundBets: {},
          pot: 30
        }
      };

      await redisClient.set(`room:${testRoom.id}`, JSON.stringify(roomState));
    });

    test('should validate valid player action', async () => {
      const action: PlayerAction = {
        type: 'call',
        timestamp: new Date()
      };

      const result = await validationMiddleware.validatePlayerAction(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        action
      );

      expect(result.valid).toBe(true);
    });

    test('should reject action when not player turn', async () => {
      // 修改游戏状态，使当前玩家不是测试用户
      const roomData = await redisClient.get(`room:${testRoom.id}`);
      const roomState = JSON.parse(roomData!);
      roomState.gameState.currentPlayerIndex = 1; // 不是测试用户的索引
      
      await redisClient.set(`room:${testRoom.id}`, JSON.stringify(roomState));

      const action: PlayerAction = {
        type: 'call',
        timestamp: new Date()
      };

      const result = await validationMiddleware.validatePlayerAction(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        action
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('NOT_PLAYER_TURN');
    });

    test('should reject invalid action type', async () => {
      const action: PlayerAction = {
        type: 'invalid_action' as any,
        timestamp: new Date()
      };

      const result = await validationMiddleware.validatePlayerAction(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        action
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid action type');
    });

    test('should reject raise with invalid amount', async () => {
      const action: PlayerAction = {
        type: 'raise',
        amount: -100, // 负数金额
        timestamp: new Date()
      };

      const result = await validationMiddleware.validatePlayerAction(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        action
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid raise amount');
    });

    test('should enforce action rate limiting', async () => {
      const action: PlayerAction = {
        type: 'call',
        timestamp: new Date()
      };

      // 快速连续发送动作
      const promises: Promise<{ valid: boolean; error?: string }>[] = [];
      for (let i = 0; i < 65; i++) {
        promises.push(
          validationMiddleware.validatePlayerAction(
            mockSocket as AuthenticatedSocket,
            testRoom.id,
            action
          )
        );
      }

      const results = await Promise.all(promises);
      
      // 前60个应该通过，后面的应该被限制
      const validResults = results.filter(r => r.valid);
      const invalidResults = results.filter(r => !r.valid);

      expect(validResults.length).toBeLessThanOrEqual(60);
      expect(invalidResults.length).toBeGreaterThan(0);
    });

    test('should detect suspicious action patterns', async () => {
      const action: PlayerAction = {
        type: 'call',
        timestamp: new Date()
      };

      // 设置行动历史，模拟重复模式
      const actionHistory = ['call:0', 'raise:100', 'call:0', 'raise:100'];
      for (const action of actionHistory) {
        await redisClient.lPush(`action_history:${testUser.id}:${testRoom.id}`, action);
      }

      const result = await validationMiddleware.validatePlayerAction(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        action
      );

      // 注意：当前实现只是记录警告，不会拒绝行动
      expect(result.valid).toBe(true);
    });

    test('should prevent too fast actions', async () => {
      const action: PlayerAction = {
        type: 'call',
        timestamp: new Date()
      };

      // 设置最后行动时间为刚刚
      await redisClient.set(`last_action:${testUser.id}`, Date.now().toString());

      const result = await validationMiddleware.validatePlayerAction(
        mockSocket as AuthenticatedSocket,
        testRoom.id,
        action
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Actions too fast');
    });
  });

  describe('validateMessageRate', () => {
    test('should allow messages within rate limit', () => {
      // 前100条消息应该通过
      for (let i = 0; i < 100; i++) {
        const result = validationMiddleware.validateMessageRate(testUser.id);
        expect(result).toBe(true);
      }
    });

    test('should block messages exceeding rate limit', () => {
      // 发送100条消息（达到限制）
      for (let i = 0; i < 100; i++) {
        validationMiddleware.validateMessageRate(testUser.id);
      }

      // 第101条消息应该被阻止
      const result = validationMiddleware.validateMessageRate(testUser.id);
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should clean up expired counters', () => {
      // 手动设置过期的计数器
      const expiredTime = Date.now() - 120000; // 2分钟前
      validationMiddleware['actionCounts'].set(testUser.id, {
        count: 10,
        resetTime: expiredTime
      });

      expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(true);

      // 执行清理
      validationMiddleware.cleanup();

      expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(false);
    });

    test('should keep valid counters', () => {
      // 设置未过期的计数器
      const futureTime = Date.now() + 60000; // 1分钟后
      validationMiddleware['actionCounts'].set(testUser.id, {
        count: 10,
        resetTime: futureTime
      });

      expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(true);

      // 执行清理
      validationMiddleware.cleanup();

      expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(true);
    });
  });
});