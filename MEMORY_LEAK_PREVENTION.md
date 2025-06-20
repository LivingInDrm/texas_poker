# 前端测试内存泄漏防护指南

## 问题概述

在前端测试中发现内存持续增长导致死机的问题，主要原因包括：

1. **Never-resolving Promises** - 测试中创建了永远不会resolve的Promise
2. **Socket连接未清理** - Socket事件监听器在测试结束后没有正确移除
3. **组件未正确卸载** - React组件在测试结束后没有被unmount
4. **定时器泄漏** - setTimeout/setInterval没有被清理

## 已实施的修复措施

### 1. 修复Never-resolving Promises

**问题位置:**
- `frontend/__tests__/components/UserCurrentRoomStatus.test.tsx:201`
- `frontend/__tests__/pages/LobbyPage.test.tsx:287`

**修复方法:**
```typescript
// ❌ 错误的做法
mockFn.mockImplementation(() => new Promise(() => {})); // Never resolves

// ✅ 正确的做法
let resolvePromise: (value: any) => void;
const pendingPromise = new Promise((resolve) => {
  resolvePromise = resolve;
});
mockFn.mockImplementation(() => pendingPromise);

// 测试结束前必须resolve
resolvePromise({ success: true });
unmount(); // 并卸载组件
```

### 2. Socket清理优化

**在测试的afterEach中添加清理:**
```typescript
afterEach(() => {
  vi.clearAllMocks();
  // 确保Socket服务断开连接，防止事件监听器泄漏
  if (socketService.connected) {
    socketService.disconnect();
  }
});
```

**事件监听器清理:**
```typescript
const onQualityUpdate = (quality: any) => {
  // 处理逻辑...
  
  // 清理监听器
  socketService.off('network_quality_update', onQualityUpdate);
  done();
};
```

### 3. Vitest配置优化

**内存优化设置:**
```typescript
export default defineConfig({
  test: {
    // Memory optimization settings
    pool: 'forks',          // Use fork pool for better memory isolation
    poolOptions: {
      forks: {
        singleFork: true,   // Run tests in single fork to reduce memory usage
        isolate: true,      // Isolate each test file
      }
    },
    // Force garbage collection between tests
    sequence: {
      hooks: 'stack',       // Run hooks in stack order for better cleanup
    },
  },
});
```

### 4. 内存泄漏检测工具

**创建了内存检测工具 `memory-test-utils.ts`:**
- `MemoryLeakDetector` - 检测活跃的定时器和监听器
- `createControllablePromise` - 创建可控制的Promise
- `createSafeRenderHelper` - 安全的组件渲染工具

### 5. 全局内存泄漏防护

**在setup.ts中添加:**
```typescript
afterEach(() => {
  // 恢复原始console.warn
  if (originalConsoleWarn) {
    console.warn = originalConsoleWarn;
  }
  
  // 强制垃圾收集（如果可用）
  if (global.gc) {
    global.gc();
  }
});
```

## 最佳实践指南

### 1. 组件测试

```typescript
it('测试组件功能', async () => {
  const { unmount } = render(<Component />);
  
  // 执行测试...
  
  // 最后必须卸载组件
  unmount();
});
```

### 2. Hook测试

```typescript
it('测试Hook功能', async () => {
  const { unmount } = renderHook(() => useHook(), { wrapper });
  
  // 执行测试...
  
  // 卸载Hook
  unmount();
});
```

### 3. 定时器测试

```typescript
it('测试定时器功能', async () => {
  vi.useFakeTimers();
  const { unmount } = render(<Component />);
  
  // 执行测试...
  vi.advanceTimersByTime(1000);
  
  // 清理
  unmount();
  vi.useRealTimers();
});
```

### 4. 异步测试

```typescript
it('测试异步操作', async () => {
  const { promise, resolve } = createControllablePromise();
  mockFn.mockReturnValue(promise);
  
  const { unmount } = render(<Component />);
  
  // 执行测试...
  
  // 必须resolve Promise
  resolve({ success: true });
  await promise;
  
  unmount();
});
```

## 运行测试的建议

### 1. 监控内存使用
```bash
# 使用--reporter=verbose查看详细信息
npm run test -- --reporter=verbose

# 单独运行测试文件
npm run test -- UserCurrentRoomStatus.test.tsx
```

### 2. 分批运行测试
```bash
# 分别运行不同类型的测试
npm run test -- __tests__/components/
npm run test -- __tests__/hooks/
npm run test -- __tests__/services/
```

### 3. 开启垃圾回收
```bash
# 在Node.js中开启垃圾回收
node --expose-gc node_modules/.bin/vitest run
```

## 故障排除

### 如果仍然遇到内存问题：

1. **检查Never-resolving Promises**
   ```bash
   grep -r "new Promise(() => {})" __tests__/
   ```

2. **检查缺失的unmount调用**
   ```bash
   grep -L "unmount" __tests__/**/*.test.tsx
   ```

3. **检查未清理的定时器**
   ```bash
   grep -r "setTimeout\|setInterval" __tests__/ | grep -v "clearTimeout\|clearInterval"
   ```

4. **分析内存使用**
   ```bash
   # 使用Node.js内存分析工具
   node --inspect-brk node_modules/.bin/vitest run
   ```

## 预防措施

1. **代码审查时检查:**
   - 所有render调用后是否有unmount
   - 所有Promise是否最终会resolve
   - 定时器是否有对应的清理代码

2. **使用Lint规则:**
   - 考虑添加ESLint规则检测测试中的内存泄漏模式

3. **定期运行内存检测:**
   - 在CI/CD中添加内存使用监控
   - 定期运行完整测试套件并监控内存增长

通过这些修复措施，应该能够解决前端测试中的内存泄漏问题。如果问题仍然存在，建议逐个测试文件运行，找出具体的问题源头。