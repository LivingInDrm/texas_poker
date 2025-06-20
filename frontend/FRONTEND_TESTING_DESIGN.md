# 德州扑克前端测试开发指南

**版本**: 1.0  
**更新日期**: 2025-06-20  

---

## 📋 技术规范与标准

### 🔧 必需技术栈
- **测试框架**: Vitest 3.2+ (现代化，高性能)
- **语言**: TypeScript 5.0+
- **组件测试**: @testing-library/react + @testing-library/jest-dom
- **用户交互**: @testing-library/user-event
- **测试环境**: jsdom
- **Mock框架**: Vitest内置 vi mocking

### 📐 代码规范
- **文件命名**: `组件名.test.tsx` / `功能模块.test.ts`
- **导入顺序**: Mock设置 → 测试工具导入 → 组件/服务导入
- **测试结构**: describe → beforeEach → 嵌套describe → test cases
- **断言风格**: expect().toBeInTheDocument() / expect().toHaveBeenCalledWith()

### ⚡ 性能要求
- **组件测试**: <10ms/用例
- **集成测试**: <100ms/用例  
- **Mock创建**: <1ms/对象
- **内存使用**: Fork隔离，自动垃圾收集

### 🎯 架构原则
- **双层基础设施**: 日常工具 + 高级功能分离
- **Mock优先**: 所有外部依赖必须Mock
- **类型安全**: 100% TypeScript兼容
- **测试隔离**: Fork进程隔离，无状态污染
- **内存管理**: 自动检测内存泄漏，定时器清理
- **目录规范**: 严格遵循既定目录结构

---

## 🏗️ 测试架构总览

### 双层基础设施设计

#### 1. 简化工具层 (`helpers/`) - 日常开发使用

```
helpers/
├── index.ts                          # 统一导出常用工具
├── test-utils.tsx                    # React测试工具、Mock stores
└── mocks/
    ├── useSocketMockFactory.ts       # useSocket Hook专用Mock
    └── memory-test-utils.ts          # 基础内存泄漏检测
```

**使用场景**: 组件测试、页面测试、日常开发

#### 2. 高级基础设施层 (`test-infrastructure/`) - 复杂场景

```
test-infrastructure/
├── index.ts                         # 高级工具统一导出
├── async/
│   └── asyncTestUtils.ts           # 异步测试工具
├── memory/
│   └── memoryTestUtils.ts          # 高级内存管理
├── react/
│   ├── testWrappers.ts             # 组件测试包装器
│   └── mockStores.ts               # 状态管理Mock
├── socket/
│   ├── SocketMockFactory.ts        # 完整Socket.IO Mock工厂
│   ├── socketTestUtils.ts          # Socket测试场景
│   └── types.ts                    # Socket Mock类型定义
├── types/
│   └── common.ts                   # 通用测试类型
└── utils/
    ├── mockDataFactory.ts          # 测试数据生成器
    └── testLogger.ts               # 测试专用日志
```

**使用场景**: 服务层测试、集成测试、Socket.IO测试

### 测试目录结构 (严格遵循)

```
__tests__/
├── components/           # 组件单元测试 ⚠️ 仅限React组件
│   ├── Button.test.tsx   # 按钮组件测试
│   ├── RoomList.test.tsx # 房间列表组件测试
│   └── ...               # 其他UI组件测试
├── hooks/                # 自定义Hook测试 ⚠️ 仅限React Hook
│   └── useSocket.test.ts # Socket Hook测试
├── pages/                # 页面集成测试 ⚠️ 仅限完整页面
│   └── LobbyPage.test.tsx # 大厅页面集成测试
├── services/             # 服务层测试 ⚠️ 仅限业务服务
│   ├── SocketService.test.ts # Socket服务测试
│   └── GameService.test.ts   # 游戏服务测试
├── fixtures/             # 测试数据夹具 ⚠️ 仅限静态数据
│   ├── gameData.ts       # 游戏状态数据
│   └── userData.ts       # 用户数据
├── integration/          # 集成测试 ⚠️ 仅限跨模块测试
│   └── gameFlow.test.ts  # 游戏流程集成测试
└── setup.ts             # 全局测试配置

🚫 禁止创建新目录: 请根据测试类型决定新测试文件放到哪个已有目录
```

### 架构分层

| 层级 | 目录 | 测试类型 | 关注点 | 工具选择 |
|------|------|----------|--------|----------|
| **组件层** | `components/` | 单元测试 | UI渲染、用户交互 | helpers + React Testing Library |
| **页面层** | `pages/` | 集成测试 | 页面功能、路由、状态管理 | helpers + Router Mock |
| **服务层** | `services/` | 单元测试 | 业务逻辑、Socket.IO | test-infrastructure + Socket Mock |
| **Hook层** | `hooks/` | 单元测试 | 自定义Hook、状态管理 | helpers + renderHook |
| **集成层** | `integration/` | 集成测试 | 跨模块协作、端到端流程 | test-infrastructure |

---

## 🔧 核心测试工具

### 1. Helpers层 - 日常开发工具

#### 统一导入接口
```typescript
// 组件测试推荐导入
import { 
  render, screen, fireEvent, waitFor, act,
  createComponentTestSocketMock, 
  createMockUserStore, createMockGameStore 
} from '../helpers';
```

#### 主要功能
- **React测试工具**: render, screen, fireEvent, waitFor, act
- **组件级Socket Mock**: 轻量级useSocket Hook模拟
- **状态管理Mock**: Zustand store模拟
- **基础内存检测**: 简单的内存泄漏预警

### 2. Test-Infrastructure层 - 高级功能

#### 完整Socket.IO模拟系统
```typescript
// 服务测试推荐导入
import { 
  createSocketTestUtils, 
  AsyncTestUtils, 
  MockDataFactory,
  MemoryLeakDetector 
} from '../test-infrastructure';

// 创建完整Socket Mock
const socketUtils = createSocketTestUtils({
  autoConnect: false,
  defaultLatency: 50,
  enableLogging: true
});
```

#### 高级数据生成器
```typescript
// 测试数据工厂
const MockDataFactory = {
  user: {
    basic: () => ({ id: 'user-123', username: 'testuser', chips: 5000 }),
    withChips: (chips: number) => ({ ...basic(), chips }),
    multiple: (count: number) => Array.from({ length: count }, createUser)
  },
  room: {
    basic: () => ({ id: 'room-123', status: 'WAITING', currentPlayers: 2 }),
    withStatus: (status) => ({ ...basic(), status }),
    multiple: (count: number) => Array.from({ length: count }, createRoom)
  }
};
```

---

## 📝 测试开发模式

### 1. 组件单元测试模式

**适用**: React组件、UI元素、用户交互

```typescript
// components/Button.test.tsx
import { render, screen, fireEvent } from '../helpers';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Button', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Rendering', () => {
    it('should render with correct text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });
  });

  describe('User Interactions', () => {
    it('should handle click events', () => {
      const mockClick = vi.fn();
      render(<Button onClick={mockClick}>Click</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(mockClick).toHaveBeenCalledTimes(1);
    });
  });
});
```

### 2. 页面集成测试模式

**适用**: 完整页面、路由、多组件协作

```typescript
// pages/LobbyPage.test.tsx
import { render, screen, fireEvent, waitFor, createComponentTestSocketMock } from '../helpers';
import { MemoryRouter } from 'react-router-dom';

const mockSocket = createComponentTestSocketMock({
  connected: true,
  quickStart: vi.fn().mockResolvedValue({ success: true, roomId: 'room-123' })
});

vi.mock('../../src/hooks/useSocket', () => ({
  useSocket: vi.fn(() => mockSocket)
}));

describe('LobbyPage', () => {
  const renderLobbyPage = () => render(
    <MemoryRouter><LobbyPage /></MemoryRouter>
  );

  it('should handle quick start successfully', async () => {
    renderLobbyPage();
    fireEvent.click(screen.getByText('快速开始'));
    
    await waitFor(() => {
      expect(mockSocket.quickStart).toHaveBeenCalledTimes(1);
    });
  });
});
```

### 3. 服务层测试模式

**适用**: Socket.IO服务、业务逻辑、API调用

```typescript
// services/SocketService.test.ts
import { createSocketTestUtils, MockDataFactory } from '../test-infrastructure';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('SocketService', () => {
  let socketUtils: any;

  beforeEach(() => {
    socketUtils = createSocketTestUtils({ autoConnect: false, defaultLatency: 10 });
  });

  afterEach(() => socketUtils?.cleanup());

  it('should join room successfully', async () => {
    const userData = MockDataFactory.user.basic();
    const roomData = MockDataFactory.room.basic();
    
    socketUtils.mockServerResponse('join_room', { success: true, room: roomData });
    
    const result = await socketUtils.emitWithResponse('join_room', {
      roomId: roomData.id, userId: userData.id
    });
    
    expect(result.success).toBe(true);
    expect(result.room).toEqual(roomData);
  });
});
```

### 4. Hook测试模式

**适用**: 自定义React Hook、状态管理

```typescript
// hooks/useSocket.test.ts
import { renderHook, act } from '../helpers';
import { useSocket } from '../../src/hooks/useSocket';

describe('useSocket', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useSocket());
    
    expect(result.current.connected).toBe(false);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should handle connection state changes', async () => {
    const { result } = renderHook(() => useSocket());
    
    await act(async () => result.current.connect());
    
    expect(result.current.connectionStatus).toBe('connecting');
  });
});
```

---

## ⚡ 性能和内存管理

### 1. Fork隔离配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
        minForks: 1,
        maxForks: 4,
      }
    },
    logHeapUsage: true,
    clearMocks: true,
    restoreMocks: true,
    resetMocks: true,
  }
});
```

### 2. 内存泄漏检测

```typescript
// 全局内存保护 (setup.ts)
beforeEach(() => {
  console.warn = vi.fn().mockImplementation((message: string) => {
    if (message.includes('memory leak') || message.includes('listener leak')) {
      throw new Error(`潜在内存泄漏: ${message}`);
    }
  });
});

afterEach(() => {
  if (global.gc) {
    global.gc(); // 强制垃圾回收
  }
});
```

### 3. 高性能测试数据生成

```typescript
// ✅ 推荐：批量生成
const users = MockDataFactory.user.multiple(1000); // <1ms

// ❌ 避免：逐个生成  
for (let i = 0; i < 1000; i++) {
  users.push(MockDataFactory.user.basic()); // >100ms
}
```

---

## 🎯 上下文感知Mock系统

### 1. 智能Mock选择

```typescript
// 全局上下文标记
globalThis.__VITEST_SERVICE_TEST__ = true;
globalThis.__VITEST_TEST_TYPE__ = 'service';

// 上下文感知Mock
vi.mock('socket.io-client', () => {
  if (globalThis.__VITEST_SERVICE_TEST__) {
    return createFullSocketMock(); // 服务测试用完整Mock
  }
  return createSimpleMock();       // 组件测试用轻量Mock
});
```

### 2. 分层Mock策略

**组件层Mock**:
```typescript
// 轻量级，专注UI交互
const mockSocket = createComponentTestSocketMock({
  connected: true,
  quickStart: vi.fn().mockResolvedValue({ success: true })
});
```

**服务层Mock**:
```typescript
// 完整功能，支持复杂场景
const socketUtils = createSocketTestUtils({
  autoConnect: false,
  defaultLatency: 50,
  enableLogging: true
});
```

---

## 🌐 浏览器API Mock

### 1. 全局浏览器Mock

```typescript
// setup.ts - 浏览器API模拟
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};

// localStorage Mock
const storageMock = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
Object.defineProperty(window, 'localStorage', { value: storageMock });

// matchMedia Mock
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation(query => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn()
  }))
});
```

---

## 🚀 高级测试模式

### 1. 响应式设计测试

```typescript
describe('Responsive Design', () => {
  it('should use responsive grid classes', () => {
    render(<RoomList {...defaultProps} />);
    const infoSection = screen.getByText('2/6').closest('.grid');
    expect(infoSection).toHaveClass('grid-cols-2', 'md:grid-cols-4');
  });
});
```

### 2. 性能基准测试

```typescript
describe('Performance', () => {
  it('should render large datasets efficiently', () => {
    const manyItems = Array.from({ length: 100 }, MockDataFactory.room.basic);
    
    const startTime = performance.now();
    render(<RoomList rooms={manyItems} />);
    
    expect(performance.now() - startTime).toBeLessThan(100);
  });
});
```

### 3. 参数化测试

```typescript
describe('Game Actions', () => {
  const testCases = [
    { action: 'bet', amount: 100, expected: true },
    { action: 'fold', amount: 0, expected: true },
    { action: 'invalid', amount: -100, expected: false }
  ];

  testCases.forEach(({ action, amount, expected }) => {
    it(`should handle ${action} correctly`, () => {
      expect(validateGameAction(action, amount).valid).toBe(expected);
    });
  });
});
```

---

## 🔍 调试和故障排除

### 1. 常见问题

**Mock未正确设置**:
```typescript
// ❌ 错误：Mock在导入后设置
import { useSocket } from '../../src/hooks/useSocket';
vi.mock('../../src/hooks/useSocket', () => mockSocket);

// ✅ 正确：Mock在导入前设置
vi.mock('../../src/hooks/useSocket', () => ({
  useSocket: vi.fn(() => mockSocket)
}));
import { useSocket } from '../../src/hooks/useSocket';
```

**异步测试超时**:
```typescript
// ❌ 错误：未等待异步操作
it('should update state', () => {
  fireEvent.click(button);
  expect(screen.getByText('Updated')).toBeInTheDocument();
});

// ✅ 正确：使用waitFor等待
it('should update state', async () => {
  fireEvent.click(button);
  await waitFor(() => {
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
```

### 2. 调试技巧

**Mock调用追踪**:
```typescript
console.log('调用次数:', mockFunction.mock.calls.length);
console.log('调用参数:', mockFunction.mock.calls);
console.log('返回值:', mockFunction.mock.results);
```

**组件状态调试**:
```typescript
import { debug } from '../helpers';

it('should render correctly', () => {
  render(<Component />);
  debug(); // 打印当前DOM结构
});
```

---

## 📋 开发流程指南

### 1. 新增测试流程

```bash
# 1. 确定测试类型和目录归属
# components/ - React组件测试
# pages/ - 页面集成测试
# services/ - 服务层测试
# hooks/ - 自定义Hook测试
# integration/ - 跨模块集成测试

# 2. 选择合适的工具层
# helpers/ - 组件、页面、Hook测试
# test-infrastructure/ - 服务、集成测试

# 3. 创建测试文件 (参考现有文件结构)
touch __tests__/components/NewComponent.test.tsx
# 或
touch __tests__/services/newService.test.ts

# 4. 运行单个测试文件
npm test NewComponent.test.tsx

# 5. 运行所有测试
npm test

# ❌ 错误示例: 创建新目录
mkdir -p __tests__/utils        # 禁止！
```

### 2. 工具选择指南

**日常开发 (helpers/):**
- ✅ 组件渲染测试
- ✅ 用户交互测试
- ✅ 页面集成测试
- ✅ 简单Hook测试

**复杂场景 (test-infrastructure/):**
- ✅ Socket.IO服务测试
- ✅ 跨模块集成测试
- ✅ 复杂异步操作测试
- ✅ 内存性能测试

### 3. 开发检查清单

**开始前**:
- [ ] 确认使用现有目录(components/pages/services/hooks/integration)
- [ ] 选择合适的工具层(helpers vs test-infrastructure)
- [ ] 准备测试数据和Mock

**编写时**:
- [ ] Mock在导入前设置
- [ ] 遵循目录功能定位
- [ ] 包含边界情况和错误处理
- [ ] 验证Mock调用和状态变化

**完成后**:
- [ ] 运行测试验证通过
- [ ] 检查内存泄漏
- [ ] 确保性能要求
- [ ] 确认未创建新目录

---

## 📊 质量保证

### 1. 覆盖率要求

```javascript
// vitest.config.ts 覆盖率配置
{
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov'],
    thresholds: {
      global: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      },
      './src/components/': {
        branches: 85,
        functions: 90,
        lines: 85,
        statements: 85
      }
    }
  }
}
```

### 2. 性能基准

```typescript
// 性能要求
describe('Performance Benchmarks', () => {
  it('should meet performance requirements', () => {
    // 组件渲染 <10ms, 大数据集处理 <100ms
    // Mock创建 <1ms, 内存使用 <50MB/test
  });
});
```

### 3. 当前测试状态

**测试统计**:
- **总测试数**: 411个测试，100%通过率
- **组件测试**: 17个文件，覆盖所有主要UI组件
- **服务测试**: 2个文件，覆盖Socket.IO集成
- **Hook测试**: 1个文件，覆盖自定义React Hook
- **页面测试**: 1个文件，完整集成测试
- **覆盖率**: 全部指标70%+

---

## 🌟 最佳实践总结

### 1. 导入策略

```typescript
// ✅ 日常开发推荐
import { render, screen, fireEvent, createComponentTestSocketMock } from '../helpers';

// ✅ 复杂场景推荐
import { createSocketTestUtils, AsyncTestUtils, MockDataFactory } from '../test-infrastructure';
```

### 2. Mock策略

**组件级Mock**:
- 使用 `createComponentTestSocketMock()` 进行useSocket Hook模拟
- 优先使用工厂函数而非手动创建Mock
- 只覆盖必要功能，保持接口完整性

**服务级Mock**:
- 使用 `SocketMockFactory` 进行完整Socket.IO模拟
- 启用日志记录用于调试复杂场景
- 配置延迟进行真实时序测试

### 3. 测试组织

**层次化测试结构**:
- 使用嵌套 `describe` 进行逻辑分组
- 按功能分组 (渲染、交互、边界情况)
- 分离正向和负向测试用例
- 为关键组件包含性能测试

### 4. 清理协议

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  AsyncTestUtils.cleanup();    // test-infrastructure使用时
  testUtils?.cleanup();        // socket测试工具使用时
  vi.clearAllMocks();          // 额外清理
});
```

---

*本指南基于现代化React + TypeScript + Vitest测试架构，适用于大型前端应用的企业级开发。*