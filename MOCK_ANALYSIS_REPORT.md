# Mock对象重复分析报告

## 执行摘要

通过分析 `backend/__tests__/realtime/` 目录下的14个测试文件，发现了大量重复的Mock对象定义和测试模式。本报告识别了主要的重复代码片段，并提供了标准化和重构建议。

## 1. 重复的Mock对象类型

### 1.1 Prisma Mock对象

**重复出现的文件**: 12个文件中都有类似定义

**重复代码模式**:
```javascript
const mockPrisma = {
  room: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  }
};
```

**文件分布**:
- roomHandlers.basic.test.js/ts
- roomHandlers.test.js/ts  
- socketServer.test.js/ts
- systemHandlers.test.js/ts
- systemHandlers.advanced.test.js/ts
- validation.test.js/ts

### 1.2 Redis客户端Mock对象

**重复出现的文件**: 10个文件

**重复代码模式**:
```javascript
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  exists: jest.fn(),
  setEx: jest.fn()
};
```

### 1.3 Socket对象Mock配置

**重复出现的文件**: 8个文件

**重复代码模式**:
```javascript
const mockSocket = {
  data: {
    userId: 'user-123',
    username: 'testuser'
  },
  emit: jest.fn(),
  on: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  to: jest.fn().mockReturnValue({
    emit: jest.fn()
  }),
  connected: true
};
```

### 1.4 JWT验证Mock

**重复出现的文件**: 6个文件

**重复代码模式**:
```javascript
jwt.verify.mockImplementation((token, secret, callback) => {
  if (token === 'valid-token') {
    callback(null, { userId: 'user-123', username: 'testuser' });
  } else {
    callback(new Error('Invalid token'));
  }
});
```

## 2. 共同Mock模式分析

### 2.1 用户状态服务Mock

**重复出现的文件**: 4个文件

**重复代码模式**:
```javascript
userStateService.getUserCurrentRoom.mockResolvedValue(null);
userStateService.setUserCurrentRoom.mockResolvedValue(undefined);
userStateService.clearUserCurrentRoom.mockResolvedValue(undefined);
userStateService.forceLeaveCurrentRoom.mockResolvedValue(undefined);
```

### 2.2 房间状态数据结构

**重复出现的文件**: 8个文件

**标准房间状态模式**:
```javascript
const mockRoomState = {
  id: 'room-123',
  ownerId: 'owner-id',
  status: 'WAITING',
  maxPlayers: 6,
  currentPlayerCount: 1,
  hasPassword: false,
  bigBlind: 20,
  smallBlind: 10,
  players: [{
    id: 'user-123',
    username: 'testuser',
    chips: 5000,
    position: 0,
    isOwner: false,
    status: 'ACTIVE'
  }],
  gameStarted: false
};
```

## 3. 可标准化的Mock配置

### 3.1 依赖注入Mock设置

**当前重复模式**:
```javascript
jest.mock('@prisma/client');
jest.mock('redis');
jest.mock('jsonwebtoken');
jest.mock('../../src/services/userStateService');
jest.mock('../../src/db');
```

### 3.2 beforeEach清理模式

**重复代码**:
```javascript
beforeEach(() => {
  jest.clearAllMocks();
  // Reset socket mock
  mockSocket = { /* 重复的socket配置 */ };
});
```

## 4. 测试数据创建模式

### 4.1 用户数据创建

**重复模式**:
```javascript
testUser = await prisma.user.create({
  data: {
    username: `test_user_${Date.now()}`,
    passwordHash: 'test_hash',
    chips: 5000
  }
});
```

### 4.2 房间数据创建

**重复模式**:
```javascript
testRoom = await prisma.room.create({
  data: {
    ownerId: testUser.id,
    playerLimit: 6,
    status: 'WAITING',
    bigBlind: 20,
    smallBlind: 10
  }
});
```

## 5. 重构建议

### 5.1 创建统一的Mock工厂

**建议文件**: `backend/__tests__/shared/mockFactory.ts`

```typescript
export class MockFactory {
  static createPrismaMock() {
    return {
      room: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      }
    };
  }

  static createRedisMock() {
    return {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      exists: jest.fn(),
      setEx: jest.fn()
    };
  }

  static createSocketMock(userData: Partial<SocketData> = {}) {
    return createMockAuthenticatedSocket(userData);
  }
}
```

### 5.2 标准化JWT Mock工具

**建议文件**: `backend/__tests__/shared/authTestUtils.ts`

```typescript
export function setupJWTMock() {
  (jwt.verify as jest.Mock).mockImplementation((token, secret, callback) => {
    if (token === 'valid-token') {
      callback(null, { userId: 'user-123', username: 'testuser' });
    } else {
      callback(new Error('Invalid token'));
    }
  });
}
```

### 5.3 房间状态数据工厂

**建议文件**: `backend/__tests__/shared/roomStateFactory.ts`

```typescript
export class RoomStateFactory {
  static createBasicRoomState(overrides: Partial<RoomState> = {}): RoomState {
    return {
      id: 'room-123',
      ownerId: 'owner-id',
      status: 'WAITING',
      maxPlayers: 6,
      currentPlayerCount: 1,
      hasPassword: false,
      bigBlind: 20,
      smallBlind: 10,
      players: [{
        id: 'user-123',
        username: 'testuser',
        chips: 5000,
        position: 0,
        isOwner: false,
        status: 'ACTIVE'
      }],
      gameStarted: false,
      ...overrides
    };
  }

  static createGameInProgressState(): RoomState {
    return this.createBasicRoomState({
      status: 'PLAYING',
      gameStarted: true,
      gameState: {
        phase: 'preflop',
        currentPlayerIndex: 0,
        currentBet: 20,
        pot: 30
      }
    });
  }
}
```

### 5.4 统一的测试数据生成器

**建议文件**: `backend/__tests__/shared/testDataGenerator.ts`

```typescript
export class TestDataGenerator {
  static async createTestUser(overrides: any = {}) {
    return await prisma.user.create({
      data: {
        username: `test_user_${Date.now()}`,
        passwordHash: 'test_hash',
        chips: 5000,
        ...overrides
      }
    });
  }

  static async createTestRoom(ownerId: string, overrides: any = {}) {
    return await prisma.room.create({
      data: {
        ownerId,
        playerLimit: 6,
        status: 'WAITING',
        bigBlind: 20,
        smallBlind: 10,
        ...overrides
      }
    });
  }
}
```

## 6. 推荐的重构步骤

### 阶段1: 创建共享工具
1. 创建 `MockFactory` 类
2. 创建 `RoomStateFactory` 类  
3. 创建 `TestDataGenerator` 类
4. 扩展现有的 `socketTestUtils.ts`

### 阶段2: 重构现有测试
1. 更新 `roomHandlers.*` 测试文件
2. 更新 `socketServer.*` 测试文件
3. 更新 `systemHandlers.*` 测试文件
4. 更新 `validation.*` 测试文件

### 阶段3: 标准化测试模式
1. 统一 beforeEach/afterEach 模式
2. 标准化错误处理测试
3. 统一断言模式

## 7. 预期收益

### 7.1 代码重用
- 减少约60%的重复Mock代码
- 统一约8种不同的Mock配置模式

### 7.2 维护性改进
- 集中化Mock对象管理
- 更容易更新Mock行为
- 减少测试文件间的不一致性

### 7.3 测试质量提升
- 更一致的测试数据
- 更好的测试覆盖率
- 更容易添加新的测试场景

## 8. 具体重复代码片段

### 8.1 高频重复代码片段

1. **Prisma Mock初始化** (12次重复)
2. **Redis Mock初始化** (10次重复)  
3. **Socket Mock初始化** (8次重复)
4. **JWT验证Mock** (6次重复)
5. **用户状态服务Mock** (4次重复)

### 8.2 测试设置模式重复

1. **beforeEach清理** (14个文件)
2. **afterEach数据清理** (8个文件)
3. **测试用户创建** (6个文件)
4. **测试房间创建** (6个文件)

## 9. 结论

通过标准化Mock对象和测试工具，可以显著减少代码重复，提高测试套件的可维护性。建议优先实施Mock工厂模式和数据生成器，然后逐步重构现有测试文件。