/**
 * 测试数据生成器
 * 统一创建和管理测试中使用的各种数据对象
 */
export class TestDataGenerator {
  private static counter = 0;
  private static sessionId = Math.random().toString(36).substring(2, 15);

  /**
   * 获取唯一的测试ID
   */
  private static getUniqueId(prefix: string = 'test'): string {
    return `${prefix}-${this.sessionId}-${++this.counter}`;
  }

  /**
   * 获取唯一的时间戳（确保每次调用都不同）
   */
  private static getUniqueTimestamp(): number {
    const now = Date.now();
    return now + this.counter;
  }

  /**
   * 创建测试用户数据
   */
  static createUserData(overrides: any = {}) {
    const timestamp = this.getUniqueTimestamp();
    return {
      id: this.getUniqueId('user'),
      username: `testuser_${timestamp}`,
      passwordHash: '$2b$10$test.hash.for.testing.purposes.only',
      email: `test${timestamp}@example.com`,
      avatar: null,
      chips: 5000,
      gamesPlayed: 0,
      winRate: 0.0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * 创建测试房间数据
   */
  static createRoomData(ownerId?: string, overrides: any = {}) {
    return {
      id: this.getUniqueId('room'),
      ownerId: ownerId || this.getUniqueId('owner'),
      playerLimit: 6,
      password: null,
      status: 'WAITING' as const,
      bigBlind: 20,
      smallBlind: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * 创建完整的房间数据（包含owner关系）
   */
  static createRoomWithOwner(userOverrides: any = {}, roomOverrides: any = {}) {
    const owner = this.createUserData(userOverrides);
    const room = this.createRoomData(owner.id, roomOverrides);
    
    return {
      ...room,
      owner,
      ...roomOverrides
    };
  }

  /**
   * 创建游戏会话数据
   */
  static createGameSessionData(roomId?: string, overrides: any = {}) {
    return {
      id: this.getUniqueId('session'),
      roomId: roomId || this.getUniqueId('room'),
      status: 'PLAYING' as const,
      currentPhase: 'preflop' as const,
      currentPlayerIndex: 0,
      pot: 30,
      communityCards: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * 创建Socket事件数据
   */
  static createSocketEventData(eventType: string, overrides: any = {}) {
    const baseData = {
      timestamp: new Date().toISOString(),
      eventId: this.getUniqueId('event')
    };

    switch (eventType) {
      case 'room:join':
        return {
          ...baseData,
          roomId: this.getUniqueId('room'),
          password: null,
          ...overrides
        };

      case 'room:leave':
        return {
          ...baseData,
          roomId: this.getUniqueId('room'),
          ...overrides
        };

      case 'room:quick_start':
        return {
          ...baseData,
          ...overrides
        };

      case 'game:action':
        return {
          ...baseData,
          roomId: this.getUniqueId('room'),
          action: {
            type: 'call',
            amount: 0,
            timestamp: new Date()
          },
          ...overrides
        };

      default:
        return {
          ...baseData,
          ...overrides
        };
    }
  }

  /**
   * 创建JWT Payload数据
   */
  static createJWTPayload(overrides: any = {}) {
    return {
      userId: this.getUniqueId('user'),
      username: `testuser_${Date.now()}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
      ...overrides
    };
  }

  /**
   * 创建Redis存储的房间状态数据
   */
  static createRedisRoomStateData(overrides: any = {}) {
    // 首先确定玩家数量，优先使用overrides中的设置
    const playerCount = overrides.currentPlayerCount || overrides.players?.length || 1;
    
    // 如果没有指定players，则根据playerCount生成
    const players = overrides.players || Array.from({ length: playerCount }, (_, index) => ({
      id: this.getUniqueId('player'),
      username: `player_${Date.now()}`,
      chips: 5000,
      position: index,
      isOwner: index === 0,
      status: 'ACTIVE',
      isConnected: true
    }));
    
    const baseState = {
      id: this.getUniqueId('room'),
      ownerId: players[0]?.id || this.getUniqueId('owner'),
      status: 'WAITING',
      maxPlayers: 6,
      currentPlayerCount: players.length,
      hasPassword: false,
      bigBlind: 20,
      smallBlind: 10,
      players,
      gameStarted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      ...baseState,
      ...overrides,
      // 确保currentPlayerCount与players数组长度一致
      currentPlayerCount: overrides.players?.length ?? baseState.currentPlayerCount
    };
  }

  /**
   * 创建错误响应数据
   */
  static createErrorResponse(error: string, message?: string, code?: string) {
    return {
      success: false,
      error,
      message: message || 'An error occurred',
      code: code || 'GENERIC_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建成功响应数据
   */
  static createSuccessResponse(data?: any, message?: string) {
    return {
      success: true,
      data: data || {},
      message: message || 'Operation successful',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建数据库查询结果
   */
  static createDatabaseResult(type: 'user' | 'room' | 'session', overrides: any = {}) {
    switch (type) {
      case 'user':
        return this.createUserData(overrides);
      case 'room':
        return this.createRoomData(undefined, overrides);
      case 'session':
        return this.createGameSessionData(undefined, overrides);
      default:
        throw new Error(`Unknown database result type: ${type}`);
    }
  }

  /**
   * 批量创建测试数据
   */
  static createBulkData<T>(
    createFunction: (overrides?: any) => T,
    count: number,
    baseOverrides: any = {}
  ): T[] {
    return Array.from({ length: count }, (_, index) =>
      createFunction.call(this, {
        ...baseOverrides,
        // 为每个项目添加唯一标识
        bulkIndex: index
      })
    );
  }

  /**
   * 创建测试场景数据包
   * 为特定测试场景提供完整的数据集
   */
  static createScenarioData(scenario: string, customOverrides: any = {}) {
    const scenarios = {
      'room-join-success': () => {
        const user = this.createUserData({ chips: 5000 });
        const room = this.createRoomData();
        const roomState = this.createRedisRoomStateData({ 
          currentPlayerCount: 2,
          players: [
            {
              id: this.getUniqueId('owner'),
              username: 'roomowner',
              chips: 5000,
              position: 0,
              isOwner: true,
              status: 'ACTIVE',
              isConnected: true
            },
            {
              id: user.id,
              username: user.username,
              chips: user.chips,
              position: 1,
              isOwner: false,
              status: 'ACTIVE',
              isConnected: true
            }
          ]
        });
        return {
          user,
          room,
          roomState,
          eventData: this.createSocketEventData('room:join')
        };
      },

      'room-join-full': () => {
        const players = Array.from({ length: 6 }, (_, i) => ({
          id: this.getUniqueId('player'),
          username: `player${i + 1}`,
          position: i,
          isOwner: i === 0
        }));
        return {
          user: this.createUserData(),
          room: this.createRoomData(undefined, { playerLimit: 6 }),
          roomState: this.createRedisRoomStateData({ 
            players,
            currentPlayerCount: 6,
            maxPlayers: 6
          }),
          eventData: this.createSocketEventData('room:join')
        };
      },

      'room-join-password': () => ({
        user: this.createUserData(),
        room: this.createRoomData(undefined, { password: 'test-password' }),
        roomState: this.createRedisRoomStateData({ hasPassword: true }),
        eventData: this.createSocketEventData('room:join', { password: 'test-password' })
      }),

      'room-leave-owner-transfer': () => {
        const owner = this.createUserData();
        const newOwner = this.createUserData();
        const players = [
          { ...owner, position: 0, isOwner: true },
          { ...newOwner, position: 1, isOwner: false }
        ];
        return {
          user: owner,
          room: this.createRoomData(owner.id),
          roomState: this.createRedisRoomStateData({ 
            players,
            currentPlayerCount: 2,
            ownerId: owner.id
          }),
          eventData: this.createSocketEventData('room:leave')
        };
      },

      'quick-start-empty-server': () => ({
        user: this.createUserData(),
        availableRooms: [],
        eventData: this.createSocketEventData('room:quick_start')
      }),

      'quick-start-join-existing': () => ({
        user: this.createUserData(),
        availableRooms: [this.createRoomData()],
        roomState: this.createRedisRoomStateData({ currentPlayerCount: 2 }),
        eventData: this.createSocketEventData('room:quick_start')
      }),

      'user-not-found': () => ({
        user: null,
        eventData: this.createSocketEventData('room:join')
      }),

      'room-not-found': () => ({
        user: this.createUserData(),
        room: null,
        eventData: this.createSocketEventData('room:join', { 
          roomId: 'nonexistent-room' 
        })
      }),

      'room-leave-success': () => ({
        user: this.createUserData(),
        room: this.createRoomData(),
        roomState: this.createRedisRoomStateData({ currentPlayerCount: 1 }),
        eventData: this.createSocketEventData('room:leave')
      }),

      'quick-start-createNew': () => ({
        user: this.createUserData(),
        availableRooms: [],
        eventData: this.createSocketEventData('room:quick_start')
      }),

      'quick-start-joinExisting': () => {
        const room = this.createRoomData();
        return {
          user: this.createUserData(),
          availableRooms: [room],
          roomState: this.createRedisRoomStateData({ 
            id: room.id,
            ownerId: room.ownerId,
            currentPlayerCount: 2 
          }),
          eventData: this.createSocketEventData('room:quick_start')
        };
      }
    };

    const baseData = scenarios[scenario]?.() ?? {};
    return this.deepMerge(baseData, customOverrides);
  }

  /**
   * 深度合并对象
   */
  private static deepMerge(target: any, source: any): any {
    if (source === null || typeof source !== 'object') {
      return source;
    }

    if (Array.isArray(source)) {
      return source;
    }

    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * 重置计数器（用于测试隔离）
   */
  static resetCounter(): void {
    this.counter = 0;
    this.sessionId = Math.random().toString(36).substring(2, 15);
  }

  /**
   * 创建唯一ID数组（高性能批量生成）
   */
  static generateUniqueIds(count: number, prefix: string = 'id'): string[] {
    return Array.from({ length: count }, () => this.getUniqueId(prefix));
  }

  /**
   * 批量创建用户数据（高性能）
   */
  static generateUsers(count: number, overrides: any = {}): any[] {
    return Array.from({ length: count }, (_, index) => 
      this.createUserData({ ...overrides, bulkIndex: index })
    );
  }

  /**
   * 批量创建房间状态数据（高性能）
   */
  static generateRoomStates(count: number, overrides: any = {}): any[] {
    return Array.from({ length: count }, (_, index) => 
      this.createRedisRoomStateData({ ...overrides, bulkIndex: index })
    );
  }

  /**
   * 创建游戏事件数据
   */
  static generateGameEvents(count: number, overrides: any = {}) {
    return Array.from({ length: count }, (_, index) => ({
      id: this.getUniqueId('event'),
      type: overrides.type || 'bet',
      playerId: overrides.playerId || this.getUniqueId('player'),
      amount: overrides.amount || Math.floor(Math.random() * 1000),
      timestamp: new Date(),
      sequenceNumber: index,
      ...overrides
    }));
  }

  /**
   * 创建JWT令牌数据
   */
  static generateAuthTokens(count: number, overrides: any = {}) {
    return Array.from({ length: count }, () => ({
      token: `jwt.token.${this.getUniqueId()}`,
      type: overrides.type || 'Bearer',
      payload: this.createJWTPayload(overrides.payload),
      expiresIn: overrides.expiresIn || '1h',
      ...overrides
    }));
  }

  /**
   * 创建API请求负载数据
   */
  static generateApiPayloads(count: number, type: 'room' | 'user' | 'game', overrides: any = {}) {
    return Array.from({ length: count }, () => {
      switch (type) {
        case 'room':
          return {
            playerLimit: 6,
            bigBlind: 20,
            smallBlind: 10,
            password: null,
            ...overrides
          };
        case 'user':
          return {
            username: `user_${this.getUniqueId()}`,
            password: 'testpassword123',
            avatar: null,
            ...overrides
          };
        case 'game':
          return {
            action: 'bet',
            amount: 100,
            roomId: this.getUniqueId('room'),
            ...overrides
          };
        default:
          return overrides;
      }
    });
  }

  /**
   * 创建错误场景数据
   */
  static generateErrorScenarios(count: number, overrides: any = {}) {
    const errorTypes = [
      'VALIDATION_ERROR',
      'AUTHENTICATION_ERROR', 
      'AUTHORIZATION_ERROR',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMIT',
      'INTERNAL_ERROR'
    ];

    return Array.from({ length: count }, (_, index) => ({
      type: errorTypes[index % errorTypes.length],
      code: `ERR_${this.getUniqueId()}`,
      message: `Test error scenario ${index + 1}`,
      statusCode: 400 + (index % 5),
      timestamp: new Date(),
      ...overrides
    }));
  }
}

/**
 * 定时器清理工具类
 * 用于清理测试中创建的定时器
 */
export class TimerCleanup {
  private static timers: Set<NodeJS.Timeout> = new Set();
  private static intervals: Set<NodeJS.Timeout> = new Set();

  /**
   * 注册定时器以便清理
   */
  static registerTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.timers.add(timer);
    return timer;
  }

  /**
   * 注册间隔定时器以便清理
   */
  static registerInterval(interval: NodeJS.Timeout): NodeJS.Timeout {
    this.intervals.add(interval);
    return interval;
  }

  /**
   * 清理所有注册的定时器
   */
  static cleanup(): void {
    this.timers.forEach(timer => {
      clearTimeout(timer);
    });
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.timers.clear();
    this.intervals.clear();
  }

  /**
   * 创建带清理功能的setTimeout
   */
  static setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(callback, delay);
    return this.registerTimer(timer);
  }

  /**
   * 创建带清理功能的setInterval
   */
  static setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(callback, delay);
    return this.registerInterval(interval);
  }
}

/**
 * TypeScript兼容性工具类
 * 解决测试中的TypeScript类型问题
 */
export class TypeScriptCompatibility {
  /**
   * 安全的Mock函数转换
   */
  static asMockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
    return fn as jest.MockedFunction<T>;
  }

  /**
   * 安全的Mock对象转换
   */
  static asMockObject<T>(obj: T): jest.Mocked<T> {
    return obj as jest.Mocked<T>;
  }

  /**
   * 创建类型安全的Mock回调
   */
  static createTypedCallback<T = any>(): jest.MockedFunction<(response: T) => void> {
    return jest.fn<void, [T]>();
  }

  /**
   * 创建类型安全的Promise Mock
   */
  static createPromiseMock<T>(resolveValue?: T): jest.MockedFunction<() => Promise<T>> {
    const mockFn = jest.fn();
    if (resolveValue !== undefined) {
      mockFn.mockResolvedValue(resolveValue);
    }
    return mockFn as jest.MockedFunction<() => Promise<T>>;
  }
}

/**
 * 专门用于房间处理器测试的数据生成器
 */
export class RoomHandlerTestData {
  /**
   * 生成房间加入测试的完整数据集
   */
  static forRoomJoin(scenario: 'success' | 'full' | 'password' | 'notFound' | 'userNotFound') {
    return TestDataGenerator.createScenarioData(`room-join-${scenario}`);
  }

  /**
   * 生成房间离开测试的完整数据集
   */
  static forRoomLeave(scenario: 'success' | 'ownerTransfer' | 'notInRoom') {
    if (scenario === 'success') {
      return TestDataGenerator.createScenarioData('room-leave-success');
    } else if (scenario === 'ownerTransfer') {
      return TestDataGenerator.createScenarioData('room-leave-owner-transfer');
    }
    return TestDataGenerator.createScenarioData('room-leave-success');
  }

  /**
   * 生成快速开始测试的完整数据集
   */
  static forQuickStart(scenario: 'createNew' | 'joinExisting') {
    if (scenario === 'createNew') {
      return TestDataGenerator.createScenarioData('quick-start-createNew');
    } else {
      return TestDataGenerator.createScenarioData('quick-start-joinExisting');
    }
  }
}

/**
 * API路由测试工具类
 */
export class ApiTestHelper {
  /**
   * 创建模拟Express应用
   */
  static createTestApp(mocks: any) {
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    
    // Mock依赖注入
    app.locals.prisma = mocks.prisma;
    app.locals.redis = mocks.redis;
    app.locals.userStateService = mocks.userStateService;
    
    return app;
  }

  /**
   * 配置认证Mock
   */
  static setupAuthMocks(mocks: any, userData: any = {}) {
    const defaultUser = {
      id: 'test-user-id',
      username: 'testuser',
      ...userData
    };

    // Mock JWT验证
    if (mocks.jwt) {
      mocks.jwt.verify.mockImplementation((token: string) => {
        if (token.replace('Bearer ', '') === 'valid-token') {
          return defaultUser;
        }
        throw new Error('Invalid token');
      });
    }

    return defaultUser;
  }
}

/**
 * Mock数据配置辅助工具
 */
export class MockDataConfigurator {
  /**
   * 配置Prisma Mock返回指定的测试数据
   */
  static configurePrismaWithTestData(prismaMock: any, data: any) {
    if (data.validUser) {
      // For findUnique, return full user data (including passwordHash for auth checks)
      prismaMock.user.findUnique.mockResolvedValue(data.validUser);
    }

    if (data.newUser) {
      // For create, return user data without passwordHash (as per API spec)
      const userForResponse = {
        id: data.newUser.id,
        username: data.newUser.username,
        avatar: data.newUser.avatar,
        createdAt: data.newUser.createdAt
      };
      prismaMock.user.create.mockResolvedValue(userForResponse);
    }

    if (data.room) {
      prismaMock.room.findUnique.mockResolvedValue(data.room);
      prismaMock.room.create.mockResolvedValue(data.room);
      prismaMock.room.findMany.mockResolvedValue(data.availableRooms || [data.room]);
    }

    return prismaMock;
  }

  /**
   * 配置Redis Mock返回指定的房间状态
   */
  static configureRedisWithRoomState(redisMock: any, roomState: any) {
    if (roomState) {
      redisMock.get.mockResolvedValue(JSON.stringify(roomState));
    } else {
      redisMock.get.mockResolvedValue(null);
    }
    
    redisMock.setEx.mockResolvedValue('OK');
    redisMock.keys.mockResolvedValue([]);
    
    return redisMock;
  }

  /**
   * 一次性配置所有Mock对象
   */
  static configureAllMocks(mocks: any, testData: any) {
    this.configurePrismaWithTestData(mocks.prisma, testData);
    this.configureRedisWithRoomState(mocks.redis, testData.roomState);
    
    // 配置用户状态服务
    if (mocks.userStateService) {
      mocks.userStateService.getUserCurrentRoom.mockResolvedValue(null);
      mocks.userStateService.setUserCurrentRoom.mockResolvedValue(undefined);
      mocks.userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
    }

    // 配置定时器清理
    TimerCleanup.cleanup();

    return mocks;
  }

  /**
   * 配置Auth Mock对象
   */
  static configureAuthMocks(mocks: any, testData: any) {
    // 配置JWT Mock
    if (mocks.jwt) {
      mocks.jwt.verify.mockImplementation((token: string) => {
        if (token === 'valid-token' || token.startsWith('Bearer valid-token')) {
          return testData.jwtPayload || {
            userId: 'test-user-id',
            username: 'testuser',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600
          };
        }
        throw new Error('Invalid token');
      });
      mocks.jwt.sign.mockReturnValue('mocked-jwt-token');
    }

    // 配置bcrypt Mock
    if (mocks.bcrypt) {
      mocks.bcrypt.compare.mockImplementation((password: string, hash: string) => {
        return Promise.resolve(password === 'correct-password');
      });
      mocks.bcrypt.hash.mockResolvedValue('$2b$10$hashedpassword');
    }

    return mocks;
  }
}