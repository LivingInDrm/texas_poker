# 德州扑克项目测试编写规范

> 基于项目测试架构重构后的统一测试编写标准

---

## 📋 目录

- [1. 核心原则](#1-核心原则)
- [2. 目录结构规范](#2-目录结构规范)
- [3. 命名规范](#3-命名规范)
- [4. 测试分类和要求](#4-测试分类和要求)
- [5. 编写规范](#5-编写规范)
- [6. 质量标准](#6-质量标准)
- [7. 工具和配置](#7-工具和配置)
- [8. 维护指南](#8-维护指南)
- [9. 快速参考](#9-快速参考)

---

## 1. 核心原则

### 1.1 测试哲学
- **可读性优先**: 测试即文档，应该清晰表达意图
- **独立性**: 每个测试独立运行，不依赖其他测试
- **快速反馈**: 单元测试应该快速执行，提供即时反馈
- **覆盖关键路径**: 重点测试核心逻辑和边界情况

### 1.2 三层测试策略
```
🔺 E2E Tests (少量)        # 关键用户流程
🔲 Integration Tests (适量) # 模块间交互
🔳 Unit Tests (大量)       # 单个函数/组件
```

---

## 2. 目录结构规范

### 2.1 统一的测试目录结构

```
项目根目录/
├── backend/__tests__/
│   ├── game/          # 🎮 游戏引擎测试
│   │   ├── Card.test.ts
│   │   ├── Deck.test.ts
│   │   ├── GameState.test.ts
│   │   └── ...
│   ├── api/           # 🔌 HTTP API测试
│   │   ├── room.test.ts
│   │   ├── auth.test.ts
│   │   └── ...
│   ├── realtime/      # 📡 实时通信测试
│   │   ├── socketServer.test.ts
│   │   ├── roomHandlers.test.ts
│   │   └── ...
│   ├── storage/       # 💾 数据存储测试
│   │   ├── roomState.test.ts
│   │   ├── userStateService.test.ts
│   │   └── ...
│   └── shared/        # 🔧 共享资源
│       ├── gameData.ts     # 测试数据
│       ├── testUtils.ts    # 测试工具
│       └── setup.ts        # 全局配置
│
├── frontend/__tests__/
│   ├── components/    # 组件测试
│   ├── pages/         # 页面测试
│   ├── hooks/         # Hook测试
│   ├── services/      # 服务测试
│   ├── integration/   # 集成测试
│   ├── fixtures/      # 测试数据
│   ├── helpers/       # 测试工具
│   └── setup.ts       # 测试配置
│
└── e2e-tests/         # 端到端测试
    ├── tests/
    ├── fixtures/
    └── playwright.config.ts
```

### 2.2 文件组织原则
- **按功能域分组**: 相关测试按业务功能集中管理
- **职责清晰**: 每个目录对应明确的功能域
- **共享资源集中**: fixtures、helpers和配置统一在shared目录
- **扩展性好**: 新功能容易找到合适的归类

### 2.3 后端测试分类说明

| 目录 | 职责范围 | 包含内容 | 测试特点 |
|-----|---------|---------|---------|
| **game/** | 游戏引擎核心逻辑 | Card, Deck, GameState, HandRank, Position, Pot | 纯算法测试，快速执行 |
| **api/** | HTTP API接口 | 路由测试，中间件测试，请求响应 | 集成测试，使用supertest |
| **realtime/** | 实时通信 | Socket.io服务器，事件处理，消息验证 | 异步测试，事件驱动 |
| **storage/** | 数据存储 | 数据库操作，Redis缓存，状态管理 | 数据层测试，需要清理 |
| **shared/** | 公共资源 | 测试数据，工具函数，全局配置 | 支持其他测试 |

### 2.4 目录选择指南

**什么时候放在 game/ ?**
- 纯游戏逻辑算法
- 不依赖外部服务的类和函数
- 扑克牌相关的数据结构

**什么时候放在 api/ ?**
- REST API端点测试
- HTTP中间件测试
- 请求验证和响应格式测试

**什么时候放在 realtime/ ?**
- Socket.io相关功能
- 实时事件处理
- WebSocket通信测试

**什么时候放在 storage/ ?**
- 数据库模型测试
- Redis缓存测试
- 数据持久化测试

---

## 3. 命名规范

### 3.1 文件命名
| 类型 | 格式 | 示例 |
|-----|------|------|
| **单元测试** | `*.test.ts` | `GameState.test.ts` |
| **组件测试** | `*.test.tsx` | `GameTable.test.tsx` |
| **E2E测试** | `*.spec.ts` | `auth.spec.ts` |
| **测试工具** | `*.ts` | `testUtils.ts` |
| **测试数据** | `*.ts` | `gameData.ts` |

### 3.2 测试套件命名
```typescript
// ✅ 好的命名
describe('GameState', () => {})
describe('GameState - Player Management', () => {})
describe('PlayerSeat Component', () => {})

// ❌ 避免的命名  
describe('Test GameState', () => {})
describe('gameState tests', () => {})
```

### 3.3 测试用例命名
```typescript
// ✅ 描述期望行为
test('should add player when room has space', () => {})
test('should throw error when room is full', () => {})
test('renders loading state correctly', () => {})

// ❌ 不够具体
test('adds player', () => {})
test('test error', () => {})
```

---

## 4. 测试分类和要求

### 4.1 单元测试
**范围**: 单个函数、类、组件  
**特点**: 快速、隔离、专注  
**工具**: Jest (后端), Vitest (前端)

**重点测试**:
- 游戏逻辑算法
- 工具函数
- 组件渲染和交互
- 边界条件和错误处理

### 4.2 集成测试
**范围**: 模块间交互  
**特点**: 真实环境、数据流  
**工具**: Jest + 测试数据库, React Testing Library

**重点测试**:
- API路由完整流程
- Socket通信
- 数据库操作
- 前端页面流程

### 4.3 E2E测试
**范围**: 完整用户流程  
**特点**: 真实浏览器、端到端  
**工具**: Playwright

**重点测试**:
- 用户注册登录
- 创建加入房间
- 游戏完整流程
- 错误场景处理

---

## 5. 编写规范

### 5.1 测试结构 - AAA模式
```typescript
test('should calculate correct pot distribution', () => {
  // Arrange - 准备测试数据
  const gameState = new GameState('room123', 10, 20);
  const players = [createPlayer('p1'), createPlayer('p2')];
  
  // Act - 执行被测试的操作
  const result = gameState.distributePot(players);
  
  // Assert - 验证结果
  expect(result).toHaveLength(2);
  expect(result[0].amount).toBe(100);
});
```

### 5.2 Mock使用原则
- **适度Mock**: 只Mock必要的外部依赖
- **接近真实**: Mock行为应该接近真实实现
- **集中管理**: 复用的Mock放在helpers中

### 5.3 断言标准
```typescript
// ✅ 明确的断言
expect(result).toBe(true)                 // 精确值
expect(result).toEqual(expectedObject)    // 对象比较
expect(array).toHaveLength(3)            // 数组长度
expect(mockFn).toHaveBeenCalledWith(arg) // Mock调用

// ✅ DOM断言
expect(element).toBeInTheDocument()
expect(element).toHaveClass('active')
expect(element).toHaveTextContent('Hello')
```

### 5.4 异步测试
```typescript
// Promise
test('should handle async operation', async () => {
  await expect(asyncFunction()).resolves.toBe(result);
});

// 回调
test('should handle callback', (done) => {
  callback((result) => {
    expect(result).toBeDefined();
    done();
  });
});
```

---

## 6. 质量标准

### 6.1 覆盖率要求
| 模块类型 | 行覆盖率 | 函数覆盖率 | 分支覆盖率 |
|---------|---------|----------|----------|
| **游戏逻辑** | ≥95% | ≥95% | ≥90% |
| **API路由** | ≥90% | ≥90% | ≥85% |
| **UI组件** | ≥85% | ≥85% | ≥80% |
| **工具函数** | ≥95% | ≥95% | ≥90% |

### 6.2 性能要求
- **单元测试**: 每个测试 < 5秒
- **集成测试**: 每个测试 < 30秒  
- **E2E测试**: 每个测试 < 2分钟
- **组件渲染**: 初始渲染 < 100ms

### 6.3 代码质量
- **可读性**: 清晰的变量名和注释
- **维护性**: 避免重复代码，使用helpers
- **稳定性**: 避免随机失败的测试
- **相关性**: 测试应该测试有意义的行为

---

## 7. 工具和配置

### 7.1 测试工具栈
| 层级 | 工具 | 配置文件 |
|-----|------|---------|
| **后端** | Jest + ts-jest | `jest.config.js` |
| **前端** | Vitest + React Testing Library | `vitest.config.ts` |
| **E2E** | Playwright | `playwright.config.ts` |

### 7.2 关键配置
- **超时设置**: 合理的超时时间
- **并行执行**: 提高测试效率
- **覆盖率报告**: HTML + LCOV格式
- **失败重试**: CI环境重试机制

### 7.3 测试数据管理
- **Fixtures**: 标准测试数据集
- **Factories**: 动态生成测试数据
- **Helpers**: 常用测试工具函数
- **Setup/Teardown**: 环境准备和清理

---

## 8. 维护指南

### 8.1 定期维护任务
- **每周**: 检查测试执行时间和失败率
- **每月**: 审查测试覆盖率和质量
- **每季度**: 清理过时测试和重构

### 8.2 持续改进
- **监控指标**: 测试执行时间、通过率、覆盖率
- **反馈循环**: 团队定期讨论测试实践
- **工具升级**: 保持测试工具的最新版本

### 8.3 问题处理
- **不稳定测试**: 立即修复随机失败的测试
- **慢速测试**: 优化或移至适当分类
- **过时测试**: 及时清理无效测试

---

## 9. 快速参考

### 9.1 常用命令
```bash
# 后端测试
npm test                          # 运行所有测试
npm run test:coverage            # 覆盖率测试
npm test -- --watch             # 监视模式
npm test -- --testPathPattern=unit  # 只运行单元测试

# 前端测试
npm test                         # 运行所有测试  
npm run test:coverage           # 覆盖率测试
npm test -- --watch            # 监视模式

# E2E测试
npm test                        # 运行E2E测试
npm test -- --headed           # 有界面模式

# 全部测试
./test-all.sh all              # 运行所有测试
```

### 9.2 编写检查清单
- [ ] 测试文件位置和命名正确
- [ ] 测试描述清晰具体
- [ ] 使用AAA模式组织代码
- [ ] Mock使用合理
- [ ] 断言准确明确
- [ ] 覆盖边界情况和错误处理
- [ ] 测试执行快速稳定
- [ ] 代码清晰易读

### 9.3 常见问题
**Q: 什么时候需要Mock?**
A: 外部依赖(API、数据库、文件系统)、随机性、时间相关逻辑

**Q: 如何提高测试执行速度?**
A: 减少不必要的异步操作、使用浅渲染、并行执行、合理分组

**Q: 测试覆盖率达到100%是必要的吗?**
A: 不是，应该关注质量而非数量，重点覆盖核心逻辑和边界情况

### 9.4 资源链接
- [Jest官方文档](https://jestjs.io/)
- [Vitest官方文档](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright官方文档](https://playwright.dev/)

---

**文档版本**: v2.1  
**最后更新**: 2025-06-17  
**维护者**: 德州扑克开发团队

**变更记录**:
- v2.1: 更新后端测试目录结构，采用功能域分类方案
- v2.0: 简化文档结构，减少冗余代码，增强实用性
- v1.0: 初始版本，详细代码示例

---

## 附录: 示例模板

### A.1 单元测试模板
```typescript
import { YourClass } from '../../src/path/to/YourClass';

describe('YourClass', () => {
  describe('methodName', () => {
    test('should handle normal case', () => {
      // Arrange
      const instance = new YourClass();
      
      // Act
      const result = instance.methodName(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
    
    test('should handle edge case', () => {
      // Test edge case
    });
    
    test('should throw error for invalid input', () => {
      // Test error case
    });
  });
});
```

### A.2 组件测试模板
```typescript
import { render, screen } from '@testing-library/react';
import YourComponent from '../../src/components/YourComponent';

describe('YourComponent', () => {
  test('renders with required props', () => {
    render(<YourComponent prop="value" />);
    
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
  
  test('handles user interaction', () => {
    const handleClick = vi.fn();
    render(<YourComponent onClick={handleClick} />);
    
    // Simulate interaction and test
  });
});
```