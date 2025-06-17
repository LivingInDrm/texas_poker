import { ValidationMiddleware } from '../../../src/socket/middleware/validation';
import { AuthenticatedSocket, PlayerAction } from '../../../src/types/socket';

describe('ValidationMiddleware (Simple Tests)', () => {
  let validationMiddleware: ValidationMiddleware;
  let mockSocket: Partial<AuthenticatedSocket>;

  beforeEach(() => {
    validationMiddleware = new ValidationMiddleware();
    
    // 模拟socket
    mockSocket = {
      data: {
        userId: 'test-user-id',
        username: 'test-user',
        authenticated: true
      }
    };
  });

  describe('UUID Validation', () => {
    test('should validate correct UUID format', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        validUUID,
        undefined
      );

      expect(result.valid).toBe(true);
    });

    test('should reject invalid UUID format', async () => {
      const invalidUUID = 'invalid-uuid';
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        invalidUUID,
        undefined
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid room ID format');
    });
  });

  describe('Password Validation', () => {
    test('should accept valid password', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const validPassword = 'valid_password';
      
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        validUUID,
        validPassword
      );

      expect(result.valid).toBe(true);
    });

    test('should reject password that is too long', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const longPassword = 'a'.repeat(51); // 超过50字符
      
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        validUUID,
        longPassword
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid password format');
    });

    test('should reject empty password', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const emptyPassword = '';
      
      const result = await validationMiddleware.validateRoomJoin(
        mockSocket as AuthenticatedSocket,
        validUUID,
        emptyPassword
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid password format');
    });
  });

  describe('Rate Limiting Logic', () => {
    test('should allow actions within rate limit', () => {
      const userId = 'test-user-1';
      
      // 前60个动作应该被允许
      for (let i = 0; i < 60; i++) {
        const result = validationMiddleware.validateMessageRate(userId);
        expect(result).toBe(true);
      }
    });

    test('should block actions exceeding rate limit', () => {
      const userId = 'test-user-2';
      
      // 发送100条消息（达到限制）
      for (let i = 0; i < 100; i++) {
        validationMiddleware.validateMessageRate(userId);
      }

      // 第101条消息应该被阻止
      const result = validationMiddleware.validateMessageRate(userId);
      expect(result).toBe(false);
    });

    test('should track different users separately', () => {
      const user1 = 'test-user-3';
      const user2 = 'test-user-4';
      
      // 用户1发送100条消息
      for (let i = 0; i < 100; i++) {
        validationMiddleware.validateMessageRate(user1);
      }

      // 用户1应该被限制
      expect(validationMiddleware.validateMessageRate(user1)).toBe(false);
      
      // 用户2应该仍然可以发送消息
      expect(validationMiddleware.validateMessageRate(user2)).toBe(true);
    });
  });

  describe('Action Pattern Detection', () => {
    test('should detect repeated action patterns', () => {
      const actions = ['call:0', 'raise:100', 'call:0', 'raise:100'];
      const isPattern = validationMiddleware['detectActionPattern'](actions);
      
      expect(isPattern).toBe(true);
    });

    test('should not detect pattern in random actions', () => {
      const actions = ['call:0', 'raise:100', 'fold:0', 'check:0'];
      const isPattern = validationMiddleware['detectActionPattern'](actions);
      
      expect(isPattern).toBe(false);
    });

    test('should handle insufficient actions', () => {
      const actions = ['call:0'];
      const isPattern = validationMiddleware['detectActionPattern'](actions);
      
      expect(isPattern).toBe(false);
    });
  });

  describe('Cleanup Functionality', () => {
    test('should clean up expired counters', () => {
      const userId = 'test-user-5';
      
      // 手动设置过期的计数器
      const expiredTime = Date.now() - 120000; // 2分钟前
      validationMiddleware['actionCounts'].set(userId, {
        count: 10,
        resetTime: expiredTime
      });

      expect(validationMiddleware['actionCounts'].has(userId)).toBe(true);

      // 执行清理
      validationMiddleware.cleanup();

      expect(validationMiddleware['actionCounts'].has(userId)).toBe(false);
    });

    test('should keep valid counters', () => {
      const userId = 'test-user-6';
      
      // 设置未过期的计数器
      const futureTime = Date.now() + 60000; // 1分钟后
      validationMiddleware['actionCounts'].set(userId, {
        count: 10,
        resetTime: futureTime
      });

      expect(validationMiddleware['actionCounts'].has(userId)).toBe(true);

      // 执行清理
      validationMiddleware.cleanup();

      expect(validationMiddleware['actionCounts'].has(userId)).toBe(true);
    });
  });

  describe('Action Validation Logic', () => {
    test('should validate action types', () => {
      const validAction: PlayerAction = {
        type: 'call',
        timestamp: new Date()
      };

      const player = {
        id: 'test-user',
        chips: 5000,
        status: 'active'
      };

      const gameState = {
        currentBet: 20,
        roundBets: {}
      };

      const result = validationMiddleware['validateActionDetails'](validAction, player, gameState);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid action types', () => {
      const invalidAction: PlayerAction = {
        type: 'invalid_action' as any,
        timestamp: new Date()
      };

      const player = {
        id: 'test-user',
        chips: 5000,
        status: 'active'
      };

      const gameState = {
        currentBet: 20,
        roundBets: {}
      };

      const result = validationMiddleware['validateActionDetails'](invalidAction, player, gameState);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid action type');
    });

    test('should validate raise amounts', () => {
      const raiseAction: PlayerAction = {
        type: 'raise',
        amount: 100,
        timestamp: new Date()
      };

      const player = {
        id: 'test-user',
        chips: 5000,
        status: 'active'
      };

      const gameState = {
        currentBet: 20,
        roundBets: {}
      };

      const result = validationMiddleware['validateActionDetails'](raiseAction, player, gameState);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid raise amounts', () => {
      const invalidRaiseAction: PlayerAction = {
        type: 'raise',
        amount: -100, // 负数金额
        timestamp: new Date()
      };

      const player = {
        id: 'test-user',
        chips: 5000,
        status: 'active'
      };

      const gameState = {
        currentBet: 20,
        roundBets: {}
      };

      const result = validationMiddleware['validateActionDetails'](invalidRaiseAction, player, gameState);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid raise amount');
    });

    test('should validate sufficient chips for raise', () => {
      const raiseAction: PlayerAction = {
        type: 'raise',
        amount: 10000, // 超过玩家筹码
        timestamp: new Date()
      };

      const player = {
        id: 'test-user',
        chips: 1000, // 筹码不足
        status: 'active'
      };

      const gameState = {
        currentBet: 20,
        roundBets: {}
      };

      const result = validationMiddleware['validateActionDetails'](raiseAction, player, gameState);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('INSUFFICIENT_CHIPS');
    });

    test('should validate check conditions', () => {
      const checkAction: PlayerAction = {
        type: 'check',
        timestamp: new Date()
      };

      const player = {
        id: 'test-user',
        chips: 5000,
        status: 'active'
      };

      const gameState = {
        currentBet: 0, // 没有当前下注，可以过牌
        roundBets: {}
      };

      const result = validationMiddleware['validateActionDetails'](checkAction, player, gameState);
      expect(result.valid).toBe(true);
    });

    test('should reject check when bet is required', () => {
      const checkAction: PlayerAction = {
        type: 'check',
        timestamp: new Date()
      };

      const player = {
        id: 'test-user',
        chips: 5000,
        status: 'active'
      };

      const gameState = {
        currentBet: 20, // 有当前下注，不能过牌
        roundBets: {} // 玩家还没有下注
      };

      const result = validationMiddleware['validateActionDetails'](checkAction, player, gameState);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot check, must call or raise');
    });
  });
});