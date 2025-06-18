import { jest } from '@jest/globals';

/**
 * 统一的Mock工厂类
 * 用于创建和管理测试中的所有Mock对象，避免重复定义
 */
export class MockFactory {
  /**
   * 创建Prisma数据库客户端Mock
   * 覆盖常用的数据库操作方法
   */
  static createPrismaMock() {
    return {
      room: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      gameSession: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
      },
      $disconnect: jest.fn(),
      $connect: jest.fn()
    };
  }

  /**
   * 创建Redis客户端Mock
   * 包含所有常用的Redis操作
   */
  static createRedisMock() {
    return {
      get: jest.fn(),
      set: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      lpop: jest.fn(),
      rpop: jest.fn(),
      lrange: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      quit: jest.fn(),
      ping: jest.fn()
    };
  }

  /**
   * 创建Socket对象Mock
   * 简单的Socket Mock，避免复杂的类型问题
   */
  static createSocketMock(userData: any = {}) {
    const defaultUserData = {
      userId: 'test-user-123',
      username: 'testuser',
      authenticated: true
    };
    
    return {
      data: {
        ...defaultUserData,
        ...userData
      },
      id: 'mock-socket-id',
      connected: true,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      broadcast: jest.fn().mockReturnThis(),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn(),
      rooms: new Set()
    };
  }

  /**
   * 创建Socket.IO服务器Mock
   */
  static createIOMock() {
    return {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      use: jest.fn(),
      on: jest.fn(),
      engine: {
        generateId: jest.fn(() => `socket-${Date.now()}`)
      }
    };
  }

  /**
   * 创建JWT库Mock
   * 标准化JWT验证行为
   */
  static createJWTMock() {
    const jwtMock = {
      verify: jest.fn(),
      sign: jest.fn(),
      decode: jest.fn()
    };

    // 设置默认的验证行为
    jwtMock.verify.mockImplementation(jest.fn());

    jwtMock.sign.mockReturnValue('mocked-jwt-token');

    return jwtMock;
  }

  /**
   * 创建UserStateService Mock
   * 统一用户状态服务的Mock行为
   */
  static createUserStateServiceMock() {
    return {
      getUserCurrentRoom: jest.fn(),
      setUserCurrentRoom: jest.fn(),
      clearUserCurrentRoom: jest.fn(),
      forceLeaveCurrentRoom: jest.fn(),
      cleanupOrphanedUserStates: jest.fn(),
      isUserInRoom: jest.fn(),
      getUsersInRoom: jest.fn(),
      checkAndHandleRoomConflict: jest.fn()
    };
  }

  /**
   * 创建ValidationMiddleware Mock
   */
  static createValidationMiddlewareMock() {
    return {
      validateRoomJoin: jest.fn(),
      validatePlayerAction: jest.fn(),
      validateMessageRate: jest.fn(),
      cleanup: jest.fn(),
      isRateLimited: jest.fn()
    };
  }

  /**
   * 创建bcrypt加密库Mock
   */
  static createBcryptMock() {
    return {
      compare: jest.fn(),
      hash: jest.fn(),
      genSalt: jest.fn()
    };
  }

  /**
   * 创建回调函数Mock
   * 用于测试Socket事件的回调
   */
  static createCallbackMock() {
    return jest.fn();
  }

  /**
   * 重置所有Mock对象的调用历史
   * 用于测试间的清理
   */
  static resetAllMocks(...mocks: any[]) {
    mocks.forEach(mock => {
      if (mock && typeof mock === 'object') {
        Object.values(mock).forEach((method: any) => {
          if (typeof method?.mockReset === 'function') {
            method.mockReset();
          }
        });
      }
    });
    jest.clearAllMocks();
  }

  /**
   * 批量创建常用Mock对象的组合
   * 为单元测试提供完整的Mock环境
   */
  static createRoomHandlerMocks() {
    return {
      prisma: this.createPrismaMock(),
      redis: this.createRedisMock(),
      socket: this.createSocketMock(),
      io: this.createIOMock(),
      userStateService: this.createUserStateServiceMock(),
      validationMiddleware: this.createValidationMiddlewareMock(),
      bcrypt: this.createBcryptMock(),
      callback: this.createCallbackMock()
    };
  }

  /**
   * 批量创建系统Handler测试所需的Mock对象
   */
  static createSystemHandlerMocks() {
    return {
      socket: this.createSocketMock(),
      io: this.createIOMock(),
      userStateService: this.createUserStateServiceMock(),
      redis: this.createRedisMock(),
      validationMiddleware: this.createValidationMiddlewareMock(),
      callback: this.createCallbackMock()
    };
  }
}

/**
 * Mock配置工具类
 * 提供常见的Mock配置模式
 */
export class MockConfigurationHelper {
  /**
   * 配置Prisma Mock返回特定的用户数据
   */
  static configurePrismaUserMock(prismaMock: any, userData: any) {
    prismaMock.user.findUnique.mockResolvedValue(userData);
    prismaMock.user.create.mockResolvedValue(userData);
    return prismaMock;
  }

  /**
   * 配置Prisma Mock返回特定的房间数据
   */
  static configurePrismaRoomMock(prismaMock: any, roomData: any) {
    prismaMock.room.findUnique.mockResolvedValue(roomData);
    prismaMock.room.create.mockResolvedValue(roomData);
    prismaMock.room.findMany.mockResolvedValue([roomData]);
    return prismaMock;
  }

  /**
   * 配置Redis Mock返回特定的房间状态
   */
  static configureRedisRoomStateMock(redisMock: any, roomState: string | null) {
    redisMock.get.mockResolvedValue(roomState);
    redisMock.setEx.mockResolvedValue('OK');
    return redisMock;
  }

  /**
   * 配置UserStateService Mock的用户状态
   */
  static configureUserStateMock(userStateServiceMock: any, currentRoom: string | null) {
    userStateServiceMock.getUserCurrentRoom.mockResolvedValue(currentRoom);
    return userStateServiceMock;
  }
}