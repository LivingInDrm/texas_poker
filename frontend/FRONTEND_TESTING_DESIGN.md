# Frontend Testing Development Guide

## 测试状态概览

🎉 **当前测试状态**: 100% 通过率 (411/411 测试)
📊 **测试覆盖**: 组件测试、服务测试、Hook测试、页面测试
🛠️ **基础设施**: 完善的Mock系统和测试工具链

## 目录结构说明

### 优化后的测试基础设施架构

```
frontend/__tests__/
├── helpers/                      # 日常测试辅助工具 (推荐入口)
│   ├── index.ts                 # 统一导出入口 
│   ├── test-utils.tsx           # React测试工具、Mock stores
│   └── mocks/                   # Mock工具集合
│       ├── useSocketMockFactory.ts  # useSocket Hook专用Mock
│       └── memory-test-utils.ts     # 内存检测工具
├── test-infrastructure/          # 高级测试基础设施
│   ├── index.ts                 # 高级工具统一导出
│   ├── async/                   # 异步测试工具
│   │   └── asyncTestUtils.ts    # 异步测试辅助函数
│   ├── memory/                  # 内存管理工具
│   │   └── memoryTestUtils.ts   # 内存泄漏检测和防护
│   ├── react/                   # React测试工具
│   │   ├── testWrappers.ts      # 组件测试包装器
│   │   └── mockStores.ts        # 状态管理Mock
│   ├── socket/                  # Socket.io测试工具
│   │   ├── SocketMockFactory.ts # 完整Socket.IO Mock工厂
│   │   └── socketTestUtils.ts   # Socket测试辅助函数
│   ├── types/                   # 通用类型定义
│   │   └── common.ts           # 测试相关类型
│   └── utils/                   # 通用工具函数
│       ├── mockDataFactory.ts   # 测试数据工厂
│       └── testLogger.ts        # 测试日志工具
├── components/                   # 组件测试 (17个测试文件)
├── services/                     # 服务层测试 (2个测试文件)
├── hooks/                        # 自定义Hook测试 (1个测试文件)
├── pages/                        # 页面测试 (1个测试文件)
├── fixtures/                     # 测试数据固件
├── integration/                  # 集成测试
└── setup.ts                      # 全局测试配置
```

## 推荐的测试工具使用方式

### 🌟 简化导入方式 (推荐)

**对于大多数组件和页面测试**，使用简化的helpers导入：

```typescript
// 推荐方式 - 一行导入所有常用工具
import { 
  render, 
  screen, 
  fireEvent, 
  waitFor, 
  act,
  createComponentTestSocketMock,
  userEvent 
} from '../helpers';

// 旧方式 - 分散导入 (不推荐)
import { render, screen } from '@testing-library/react';
import { createComponentTestSocketMock } from '../test-infrastructure/useSocketMockFactory';
import userEvent from '@testing-library/user-event';
```

### ⚙️ 高级测试工具 (复杂场景使用)

**对于服务测试和集成测试**，使用完整的test-infrastructure：

```typescript
import { 
  createSocketTestUtils, 
  AsyncTestUtils, 
  MockDataFactory 
} from '../test-infrastructure';
```

## 核心模块详细说明

### 1. 简化测试工具 (`helpers/`)

#### helpers/index.ts - 统一入口 ⭐
**用途**: 日常测试的一站式导入入口

**提供的功能**:
- React Testing Library 完整API
- useSocket Hook Mock工具
- 内存检测工具
- 用户交互工具 (userEvent)

**最佳实践**:
```typescript
// ✅ 推荐 - 组件测试标准模板
import { render, screen, fireEvent, createComponentTestSocketMock } from '../helpers';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

#### useSocketMockFactory.ts - Socket Hook Mock
**用途**: 专门用于模拟React useSocket Hook的返回值

**核心功能**:
- 完整的useSocket接口模拟
- 支持灵活的override配置
- 自动验证Mock接口完整性

**使用示例**:
```typescript
import { createComponentTestSocketMock } from '../helpers';

// 基础Mock - 连接状态良好
const mockSocket = createComponentTestSocketMock();

// 自定义Mock - 覆盖特定功能
const mockSocket = createComponentTestSocketMock({
  connected: false,
  connectionStatus: 'disconnected',
  quickStart: vi.fn().mockResolvedValue({ success: true, roomId: 'room-123' })
});

// 在测试中使用
vi.mock('../../src/hooks/useSocket', () => ({
  useSocket: vi.fn(() => mockSocket)
}));
```

### 2. 高级Socket测试基础设施 (`socket/`)

#### SocketMockFactory.ts - 完整Socket.IO Mock
**用途**: 提供完整的Socket.io客户端行为模拟

**核心功能**:
- 连接状态管理
- 事件注册和触发
- 延迟模拟
- 错误注入
- 调用历史跟踪

**使用场景**:
- Socket服务测试
- 复杂的连接状态测试
- 网络异常模拟

**使用示例**:
```typescript
import { SocketMockFactory } from '../test-infrastructure';

const factory = SocketMockFactory.getInstance();
const mockSocket = factory.createSocket({
  autoConnect: false,
  defaultLatency: 50,
  enableLogging: true
});

// 模拟连接成功
mockSocket.setConnectionState(true);
mockSocket.triggerEvent('connect');

// 模拟服务器响应
mockSocket.emit.mockImplementation((event, data, callback) => {
  if (event === 'ROOM_JOIN') {
    setTimeout(() => callback({ success: true }), 100);
  }
});
```

#### socketTestUtils.ts - Socket场景测试
**用途**: 高级Socket测试场景工具

**核心功能**:
- 预配置测试场景
- 事件序列测试
- 异步事件等待

**使用示例**:
```typescript
import { createSocketTestUtils } from '../test-infrastructure';

const socketUtils = createSocketTestUtils({
  autoConnect: false,
  defaultLatency: 10
});

// 运行复杂场景
await socketUtils.runScenario({
  initialState: { connected: true },
  events: [
    { event: 'ROOM_JOINED', data: roomData, delay: 100 },
    { event: 'GAME_STARTED', data: gameData, delay: 200 }
  ]
});
```

### 3. 内存管理工具

#### memory-test-utils.ts (简化版)
**位置**: `helpers/mocks/memory-test-utils.ts`
**用途**: 基础内存泄漏检测

```typescript
import { MemoryLeakDetector, createControllablePromise } from '../helpers';

// 检测内存泄漏
const detector = new MemoryLeakDetector();
detector.reset();
// ... 执行测试
const { hasLeaks, leaks } = detector.checkForLeaks();

// 可控制的Promise
const { promise, resolve } = createControllablePromise();
setTimeout(() => resolve('result'), 100);
const result = await promise;
```

#### memoryTestUtils.ts (高级版)
**位置**: `test-infrastructure/memory/memoryTestUtils.ts`
**用途**: 高级内存管理和泄漏防护

### 4. React测试工具

#### test-utils.tsx - React测试辅助
**用途**: React组件测试的基础工具

**核心功能**:
- 路由上下文包装器
- Store Mock管理
- 自定义渲染函数

**使用示例**:
```typescript
import { customRender, createMockUserStore } from '../helpers';

// 带路由的组件渲染
const { getByText } = customRender(<MyComponent />, {
  routerOptions: { initialEntries: ['/dashboard'] }
});

// Store Mock设置
const mockUserStore = createMockUserStore({
  user: { id: '123', username: 'testuser' },
  isAuthenticated: true
});
```

## 技术规范更新

### 1. 推荐的测试文件结构

```typescript
// ✅ 现代化测试文件模板
import { render, screen, fireEvent, createComponentTestSocketMock } from '../helpers';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyComponent from '../../src/components/MyComponent';

// Mock设置
vi.mock('../../src/hooks/useSocket', () => ({
  useSocket: vi.fn(() => createComponentTestSocketMock())
}));

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染组件', () => {
      render(<MyComponent />);
      expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });
  });

  describe('用户交互', () => {
    it('应该正确处理点击事件', () => {
      const mockClick = vi.fn();
      render(<MyComponent onClick={mockClick} />);
      
      fireEvent.click(screen.getByRole('button'));
      expect(mockClick).toHaveBeenCalledTimes(1);
    });
  });
});
```

### 2. Socket Mock使用规范

#### 组件测试 - 使用简化Mock
```typescript
// ✅ 组件测试推荐方式
const mockSocket = createComponentTestSocketMock({
  connected: true,
  quickStart: vi.fn().mockResolvedValue({ success: true })
});

vi.mock('../../src/hooks/useSocket', () => ({
  useSocket: vi.fn(() => mockSocket)
}));
```

#### 服务测试 - 使用完整Mock
```typescript
// ✅ 服务测试推荐方式
import { createSocketTestUtils } from '../test-infrastructure';

const socketUtils = createSocketTestUtils({
  autoConnect: false,
  enableLogging: true
});
```

### 3. 异步测试规范

#### React状态更新
```typescript
import { act } from '../helpers';

it('应该正确处理异步状态更新', () => {
  render(<MyComponent />);
  
  act(() => {
    fireEvent.click(screen.getByRole('button'));
  });
  
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

#### 异步操作等待
```typescript
import { waitFor } from '../helpers';

it('应该等待异步操作完成', async () => {
  render(<MyComponent />);
  
  fireEvent.click(screen.getByRole('button'));
  
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

## 测试类型和覆盖范围

### 1. 组件测试 (17个文件)
- ✅ Modal组件 (CreateRoomModal, JoinRoomModal等)
- ✅ 游戏组件 (GameTable, PlayerSeat, PokerCards等)
- ✅ UI组件 (ActionHistory, PotDisplay等)
- ✅ 响应式设计测试

### 2. 页面测试 (1个文件)
- ✅ LobbyPage - 完整的页面集成测试

### 3. 服务测试 (2个文件)
- ✅ socketService.test.ts - 基础Socket服务测试
- ✅ socketService.enhanced.test.ts - 增强Socket功能测试

### 4. Hook测试 (1个文件)
- ✅ useSocket.test.tsx - Socket Hook测试

## 最佳实践总结

### 1. 选择合适的工具层级

```typescript
// ✅ 组件/页面测试 - 使用简化helpers
import { render, screen, createComponentTestSocketMock } from '../helpers';

// ✅ 服务/集成测试 - 使用完整基础设施
import { createSocketTestUtils, AsyncTestUtils } from '../test-infrastructure';
```

### 2. Mock策略最佳实践

```typescript
// ✅ 推荐 - 使用工厂函数创建Mock
const mockSocket = createComponentTestSocketMock({
  connected: true,
  quickStart: vi.fn().mockResolvedValue({ success: true })
});

// ❌ 避免 - 手动创建不完整的Mock
const mockSocket = {
  connected: true,
  quickStart: vi.fn()
  // 缺少其他必需的接口函数
};
```

### 3. 测试清理规范

```typescript
describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 对于使用test-infrastructure的测试
    AsyncTestUtils.cleanup();
    testUtils?.cleanup();
  });
});
```

### 4. 导入路径规范

```typescript
// ✅ 推荐 - 日常测试使用helpers
import { render, screen } from '../helpers';

// ✅ 推荐 - 复杂测试使用test-infrastructure
import { createSocketTestUtils } from '../test-infrastructure';

// ❌ 避免 - 混合使用不同层级的工具
import { render } from '@testing-library/react';
import { createComponentTestSocketMock } from '../test-infrastructure/socket/useSocketMockFactory';
```

## 成功案例

### LobbyPage测试 - 完整页面测试示例

LobbyPage测试是当前最全面的页面测试实现，包含：
- ✅ 29个测试用例全部通过
- ✅ 完整的Socket集成测试
- ✅ 用户交互测试
- ✅ 异步操作测试
- ✅ 错误处理测试
- ✅ 响应式设计测试

**关键实现特点**:
1. 使用统一的helpers导入
2. 完整的useSocket Mock配置
3. 正确的React状态更新包装 (act)
4. 异步操作的正确等待 (waitFor)

这个测试文件可以作为其他页面测试的模板参考。

## 故障排除

### 1. Socket Mock相关问题

**问题**: `getCurrentRoomStatus is not a function`
**解决**: 使用`createComponentTestSocketMock()`确保接口完整性

**问题**: Mock函数没有被调用
**解决**: 检查Mock配置，确保正确模拟异步操作流程

### 2. React测试问题

**问题**: act() 警告
**解决**: 对所有状态更新操作使用`act()`包装

**问题**: 异步操作测试不稳定
**解决**: 使用`waitFor()`等待异步操作完成

### 3. 内存泄漏问题

**问题**: 测试运行时内存持续增长
**解决**: 在`afterEach`中使用清理函数

## 未来发展方向

1. **测试覆盖率扩展**: 继续增加集成测试和E2E测试
2. **性能测试**: 添加组件性能基准测试
3. **可视化回归测试**: 引入视觉对比测试
4. **测试自动化**: 优化CI/CD测试流程