# 德州扑克后端测试开发指南

**版本**: 1.0  
**更新日期**: 2025-06-19  

---

## 📋 技术规范与标准

### 🔧 必需技术栈
- **测试框架**: Jest 29+
- **语言**: TypeScript 5.0+
- **HTTP测试**: Supertest
- **Socket测试**: Socket.IO Client

### 📐 代码规范
- **文件命名**: `功能模块.测试类型.test.ts`
- **导入顺序**: Mock设置 → 依赖导入 → 测试模块导入
- **测试结构**: describe → beforeAll/beforeEach → test cases
- **断言风格**: expect().toBe() / expect().toEqual()

### ⚡ 性能要求
- **单元测试**: <5ms/用例
- **集成测试**: <50ms/用例  
- **Mock创建**: <1ms/对象
- **数据生成**: <1ms/1000个对象

### 🎯 架构原则
- **Mock优先**: 所有外部依赖必须Mock
- **类型安全**: 100% TypeScript兼容
- **测试隔离**: 无状态污染，完全并行
- **资源清理**: 定时器、连接、缓存自动清理
- **目录规范**: 严格遵循既定目录结构，勿随意创建新目录

---

## 🏗️ 测试架构总览

### 目录结构 (严格遵循)

```
__tests__/
├── api/                    # API路由集成测试 ⚠️ 仅限HTTP端点
│   ├── authRoutes.test.ts  # 认证API端点测试
│   ├── room.test.ts        # 房间管理API测试
│   └── user.test.ts        # 用户管理API测试
├── game/                   # 游戏逻辑单元测试 ⚠️ 仅限纯业务逻辑
│   ├── Card.test.ts        # 卡牌逻辑测试
│   ├── GameState.test.ts   # 游戏状态管理测试
│   └── ...                 # 其他游戏模块
├── middleware/             # 中间件单元测试 ⚠️ 仅限Express中间件
│   └── authMiddleware.test.ts # JWT认证中间件测试
├── realtime/               # 实时通信测试 ⚠️ 仅限Socket.IO事件
│   ├── gameHandlers.unit.test.ts    # 游戏事件处理器
│   ├── roomHandlers.unit.test.ts    # 房间事件处理器
│   └── systemHandlers.unit.test.ts  # 系统事件处理器
├── services/               # 服务层测试 ⚠️ 仅限业务服务
│   └── userStateService.test.ts     # 用户状态服务测试
├── shared/                 # 测试基础设施 ⚠️ 禁止修改工具类
│   ├── mockFactory.ts      # 统一Mock工厂
│   ├── testDataGenerator.ts # 测试数据生成器
│   ├── socketTestUtils.ts  # Socket测试工具
│   └── roomStateFactory.ts # 房间状态工厂
└── legacy/                 # 遗留测试 ⚠️ 禁止添加新文件
    └── *.legacy.test.ts    # 废弃的测试文件

🚫 禁止创建新目录: 请根据模块、功能决定新测试文件放到哪个已有目录
```

### 架构分层

| 层级 | 目录 | 测试类型 | 关注点 | 工具 |
|------|------|----------|--------|------|
| **API层** | `api/` | 集成测试 | HTTP端点、路由、中间件 | Supertest + Express |
| **业务层** | `services/` | 单元测试 | 业务逻辑、数据处理 | Jest + Mock注入 |
| **游戏层** | `game/` | 单元测试 | 游戏规则、状态管理 | Jest + 纯函数测试 |
| **实时层** | `realtime/` | 混合测试 | Socket事件、实时通信 | SocketTestUtils |
| **中间件层** | `middleware/` | 单元测试 | 认证、验证、错误处理 | Jest + Mock |

---

## 🔧 核心测试工具

### 1. MockFactory - 统一Mock工厂

**用途**: 类型安全的Mock对象创建和管理

**主要API**:
```typescript
// 基础Mock
MockFactory.createPrismaMock()     // 数据库Mock
MockFactory.createRedisMock()      // 缓存Mock  
MockFactory.createSocketMock()     // Socket Mock
MockFactory.createAuthMocks()      // 认证Mock套件

// 组合Mock (推荐)
MockFactory.createRoomHandlerMocks()   // 房间处理器全套
MockFactory.createGameHandlerMocks()   // 游戏处理器全套
MockFactory.createServiceMocks()       // 服务层全套
```

### 2. TestDataGenerator - 数据生成器

**用途**: 高性能测试数据生成，保证唯一性

**主要API**:
```typescript
// 单个对象
TestDataGenerator.createUserData(overrides)
TestDataGenerator.createRoomData(ownerId, overrides)
TestDataGenerator.createGameSessionData(roomId, overrides)

// 批量生成 (高性能)
TestDataGenerator.generateUsers(1000, options)    // 1ms内完成
TestDataGenerator.generateRooms(100, options)
```

### 3. SocketTestUtils - Socket测试工具

**用途**: Socket.IO事件测试和验证

**主要API**:
```typescript
// 创建Socket Mock
createMockAuthenticatedSocket(userData)

// 测试助手
SocketTestHelper.expectSocketBroadcast(socket, roomId, event, data)
SocketTestHelper.expectSocketResponse(callback, success, data, error)
HandlerTestUtils.triggerSocketEvent(socket, event, data, callback)
```

---

## 📝 测试开发模式

### 1. 单元测试模式

**适用**: 纯函数、业务逻辑、游戏规则

```typescript
// game/Card.test.ts
import { Card, Suit, Rank } from '../../src/game/Card';

describe('Card', () => {
  test('should create card with correct properties', () => {
    const card = new Card(Suit.HEARTS, Rank.ACE);
    expect(card.suit).toBe(Suit.HEARTS);
    expect(card.rank).toBe(Rank.ACE);
  });

  test('should compare ranks correctly', () => {
    const ace = new Card(Suit.HEARTS, Rank.ACE);
    const king = new Card(Suit.SPADES, Rank.KING);
    expect(ace.compareRank(king)).toBeGreaterThan(0);
  });
});
```

### 2. 服务层测试模式

**适用**: 业务服务、数据访问层

```typescript
// services/userStateService.test.ts
const mockRedis = MockFactory.createRedisMock();
jest.mock('../../src/db', () => ({ redisClient: mockRedis }));

import { userStateService } from '../../src/services/userStateService';

describe('UserStateService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should set user current room', async () => {
    mockRedis.setEx.mockResolvedValue('OK');
    
    const result = await userStateService.setUserCurrentRoom('user-1', 'room-123');
    
    expect(result.success).toBe(true);
    expect(mockRedis.setEx).toHaveBeenCalledWith('user_room:user-1', 3600, 'room-123');
  });
});
```

### 3. API集成测试模式

**适用**: HTTP端点、路由集成

```typescript
// api/authRoutes.test.ts
import request from 'supertest';
import { MockFactory } from '../shared/mockFactory';

const mocks = MockFactory.createAuthMocks();
jest.mock('../../src/prisma', () => mocks.prisma);
jest.mock('bcrypt', () => mocks.bcrypt);

describe('Auth Routes', () => {
  test('POST /register should create new user', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.user.create.mockResolvedValue({ id: '123', username: 'test' });
    
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: 'test', password: 'pass' });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

### 4. Socket实时测试模式

**适用**: Socket事件处理器

```typescript
// realtime/gameHandlers.unit.test.ts
import { MockFactory } from '../shared/mockFactory';
import { createMockAuthenticatedSocket, SocketTestHelper } from '../shared/socketTestUtils';

describe('Game Handlers', () => {
  let mocks = MockFactory.createGameHandlerMocks();
  let socket = createMockAuthenticatedSocket();

  test('should handle bet action', async () => {
    mocks.redis.get.mockResolvedValue(JSON.stringify(gameState));
    
    await HandlerTestUtils.triggerSocketEvent(socket, 'GAME_ACTION', { action: 'bet', amount: 100 });
    
    SocketTestHelper.expectSocketResponse(callback, true, expect.any(Object));
    SocketTestHelper.expectSocketBroadcast(socket, 'room-123', 'GAME_STATE_UPDATED');
  });
});
```

---

## ⚡ 性能和资源管理

### 1. 性能优化

**Timer清理**:
```typescript
import { TimerCleanup } from '../shared/testDataGenerator';

beforeEach(() => TimerCleanup.cleanup());
afterEach(() => TimerCleanup.cleanup());
```

**高效数据生成**:
```typescript
// ✅ 推荐：批量生成
const users = TestDataGenerator.generateUsers(1000, { chips: 5000 }); // 1ms

// ❌ 避免：逐个生成
for (let i = 0; i < 1000; i++) {
  users.push(TestDataGenerator.createUserData({ chips: 5000 })); // 100ms+
}
```

### 2. Mock管理

**标准模式**:
```typescript
describe('Test Suite', () => {
  let mocks: any;

  beforeAll(() => {
    mocks = MockFactory.createRoomHandlerMocks(); // 创建一次
  });

  beforeEach(() => {
    jest.clearAllMocks(); // 每次重置
  });
});
```

### 3. 内存管理

**清理策略**:
- 使用 `jest.clearAllMocks()` 重置调用历史
- 使用 `TimerCleanup.cleanup()` 清理定时器
- 避免全局变量，使用局部变量

---

## 🔍 调试和故障排除

### 常见问题

**1. Prisma Mock未正确注入**
```typescript
// ❌ 错误：Mock在导入后设置
import { userService } from '../../src/services/userService';
jest.mock('../../src/prisma', () => MockFactory.createPrismaMock());

// ✅ 正确：Mock在导入前设置
const mockPrisma = MockFactory.createPrismaMock();
jest.mock('../../src/prisma', () => mockPrisma);
import { userService } from '../../src/services/userService';
```

**2. 异步测试超时**
```typescript
// ❌ 错误：Promise未等待
it('should handle async operation', () => {
  service.asyncOperation();
  expect(mockFunction).toHaveBeenCalled();
});

// ✅ 正确：使用async/await
it('should handle async operation', async () => {
  await service.asyncOperation();
  expect(mockFunction).toHaveBeenCalled();
});
```

**3. Socket事件未触发**
```typescript
// ✅ 正确：使用测试工具
await HandlerTestUtils.triggerSocketEvent(socket, 'GAME_ACTION', data, callback);
```

### 调试技巧

**Mock调用追踪**:
```typescript
console.log('调用次数:', mockFunction.mock.calls.length);
console.log('调用参数:', mockFunction.mock.calls);
```

---

## 📋 开发流程指南

### 1. 新增测试流程

```bash
# 1. 确定目录归属 (必须使用现有目录)
# api/ - HTTP端点测试
# game/ - 游戏逻辑测试  
# middleware/ - Express中间件测试
# realtime/ - Socket.IO事件测试
# services/ - 业务服务测试

# 2. 创建测试文件 (使用现有目录)
cp __tests__/shared/example.test.ts __tests__/现有目录/功能.test.ts

# 3. 运行测试
npm test -- __tests__/现有目录/功能.test.ts

# ❌ 错误示例: 创建新目录
mkdir -p __tests__/integration  # 禁止！
mkdir -p __tests__/utils        # 禁止！
```

### 2. 命名规范和目录映射

**严格按目录归属命名**:
- `api/authRoutes.test.ts` - API路由测试
- `middleware/authMiddleware.test.ts` - 中间件测试  
- `realtime/gameHandlers.unit.test.ts` - Socket处理器测试
- `services/userService.test.ts` - 服务层测试
- `game/CardLogic.test.ts` - 游戏逻辑测试

**目录用途严格限定**:
- `api/` ➜ 仅限Express HTTP端点
- `game/` ➜ 仅限纯业务逻辑和游戏规则
- `middleware/` ➜ 仅限Express中间件
- `realtime/` ➜ 仅限Socket.IO事件处理
- `services/` ➜ 仅限业务服务层

### 3. 开发检查清单

**开始前**:
- [ ] 确认使用现有目录(api/game/middleware/realtime/services)
- [ ] 选择对应的Mock工厂方法
- [ ] 准备测试数据

**编写时**:
- [ ] Mock在导入前设置
- [ ] 遵循目录功能定位
- [ ] 包含正常和异常情况  
- [ ] 验证Mock调用

**完成后**:
- [ ] 运行测试验证
- [ ] 检查覆盖率  
- [ ] 确保性能要求
- [ ] 确认未创建新目录，新建文件的目录归属正确

---

## 🚀 高级模式

### 1. 测试数据工厂

```typescript
class GameTestDataFactory {
  static createGameScenario() {
    const owner = TestDataGenerator.createUserData({ chips: 10000 });
    const players = TestDataGenerator.generateUsers(5, { chips: 5000 });
    const room = TestDataGenerator.createRoomData(owner.id);
    return { owner, players, room };
  }
}
```

### 2. 参数化测试

```typescript
const testCases = [
  { action: 'bet', amount: 100, expected: true },
  { action: 'fold', amount: 0, expected: true },
  { action: 'invalid', amount: 100, expected: false }
];

testCases.forEach(({ action, amount, expected }) => {
  test(`should handle ${action} correctly`, () => {
    expect(gameLogic.validateAction(action, amount)).toBe(expected);
  });
});
```

### 3. Mock链模式

```typescript
describe('Sequential calls', () => {
  beforeEach(() => {
    mockUser.findUnique
      .mockResolvedValueOnce(testUser)   // 第一次调用
      .mockResolvedValueOnce(null);      // 第二次调用
  });
});
```

---

## 📊 质量保证

### 1. 覆盖率要求

```json
// jest.config.js 覆盖率配置
{
  "coverageThreshold": {
    "global": { "lines": 85, "functions": 90 },
    "./src/game/": { "lines": 95, "functions": 95 }
  }
}
```

### 2. CI/CD配置

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
```

### 3. 性能基准

```typescript
test('performance benchmark', () => {
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    TestDataGenerator.createUserData();
  }
  expect(Date.now() - start).toBeLessThan(100);
});
```

---

*本指南基于生产级测试架构，适用于企业级Node.js + TypeScript项目。*