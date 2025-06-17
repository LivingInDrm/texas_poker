# Texas Poker 测试运行指南

## 📋 测试架构概览

你的项目包含三个层次的测试：

1. **后端单元测试** (Jest)
2. **前端单元测试** (Vitest)  
3. **端到端测试** (Playwright)

---

## 🚀 快速开始测试

### 环境准备

首先确保开发环境正常运行：

```bash
# 1. 启动数据库服务
docker-compose up -d postgres redis

# 2. 启动开发环境
./dev-local.sh start

# 3. 检查环境状态
./dev-local.sh status
```

---

## 🔧 后端测试 (Jest)

### 基本命令

```bash
# 进入后端目录
cd backend

# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试（开发时推荐）
npm run test:watch
```

### 运行特定测试

```bash
# 运行特定测试文件
npm test -- tests/game/Card.test.ts

# 运行特定测试套件
npm test -- --testNamePattern="GameState"

# 运行新增的增强功能测试
npm test -- tests/socket/systemHandlers.enhanced.test.ts
```

### 测试分类

```bash
# 游戏逻辑测试
npm test -- tests/game/

# Socket通信测试  
npm test -- tests/socket/

# API路由测试
npm test -- tests/routes/

# Redis状态管理测试
npm test -- tests/redis/
```

### 调试后端测试

```bash
# 查看详细测试输出
npm test -- --verbose

# 运行失败的测试时停止
npm test -- --bail

# 检查测试配置
cat jest.config.js
```

---

## 🎨 前端测试 (Vitest)

### 基本命令

```bash
# 进入前端目录
cd frontend

# 运行所有测试
npm run test:run

# 交互模式运行测试
npm test

# 运行测试UI界面
npm run test:ui
```

### 运行特定测试

```bash
# 运行特定组件测试
npm test -- RoomSwitchConfirmModal

# 运行新增组件的所有测试
npm test -- src/components/__tests__/

# 运行服务测试
npm test -- src/services/__tests__/
```

### 新增功能测试

```bash
# 测试房间切换确认模态框
npm test -- RoomSwitchConfirmModal.test.tsx

# 测试用户当前房间状态组件
npm test -- UserCurrentRoomStatus.test.tsx

# 测试重连指示器组件
npm test -- ReconnectionIndicator.test.tsx

# 测试Socket服务增强功能
npm test -- socketService.enhanced.test.ts
```

### 调试前端测试

```bash
# 查看测试覆盖率
npm test -- --coverage

# 运行特定测试文件并输出详细信息
npm test -- --reporter=verbose UserCurrentRoomStatus

# 检查测试配置
cat vitest.config.ts
```

---

## 🎭 端到端测试 (Playwright)

### 环境准备

```bash
# 进入E2E测试目录
cd e2e-tests

# 安装Playwright浏览器
npm run install
```

### 基本命令

```bash
# 运行所有E2E测试
npm test

# 运行测试并显示浏览器界面
npm run test:headed

# 运行测试UI界面
npm run test:ui

# 调试模式运行测试
npm run test:debug
```

### 浏览器特定测试

```bash
# 只在Chromium中运行
npm run test:chromium

# 只在Firefox中运行  
npm run test:firefox

# 只在WebKit(Safari)中运行
npm run test:webkit
```

### 查看测试报告

```bash
# 查看最新的测试报告
npm run report

# 报告文件位置
open playwright-report/index.html
```

---

## 📊 完整测试流程

### 1. 开发中测试工作流

```bash
# 步骤1: 启动开发环境
./dev-local.sh start

# 步骤2: 运行后端测试（监听模式）
cd backend && npm run test:watch

# 步骤3: 在另一个终端运行前端测试
cd frontend && npm test

# 步骤4: 开发完成后运行E2E测试
cd e2e-tests && npm test
```

### 2. 提交前完整测试

```bash
# 后端完整测试
cd backend
npm test
npm run test:coverage

# 前端完整测试  
cd frontend
npm run test:run
npm run build  # 确保构建通过

# E2E测试
cd e2e-tests
npm test

# 检查所有测试结果
echo "✅ 所有测试完成"
```

### 3. CI/CD模拟测试

```bash
# 使用Docker环境测试
./dev.sh start

# 等待服务启动
sleep 10

# 运行所有测试
cd backend && npm test
cd ../frontend && npm run test:run  
cd ../e2e-tests && npm test

# 清理环境
./dev.sh stop
```

---

## 🛠️ 测试问题排查

### 常见问题解决

#### 1. 后端测试超时

```bash
# 检查数据库连接
docker-compose ps postgres redis

# 重启数据库服务
docker-compose restart postgres redis

# 检查测试环境变量
cat backend/.env
```

#### 2. 前端测试act()警告

基于 `test_err.md` 的问题，部分测试已修复，如果还有类似问题：

```bash
# 检查特定测试文件
npm test -- UserCurrentRoomStatus --reporter=verbose

# 查看修复后的测试示例
cat src/components/__tests__/UserCurrentRoomStatus.test.tsx
```

#### 3. E2E测试失败

```bash
# 确保前后端服务正常运行
curl http://localhost:3001/health
curl http://localhost:5173

# 检查浏览器安装
cd e2e-tests && npx playwright install

# 运行头模式查看问题
npm run test:headed
```

#### 4. Socket服务测试问题

```bash
# 检查Socket连接
cd backend && npm test -- socketServer.test.ts

# 检查Mock配置
grep -n "mock" tests/socket/socketServer.test.ts
```

---

## 📈 测试覆盖率和质量

### 查看测试覆盖率

```bash
# 后端覆盖率
cd backend && npm run test:coverage
open coverage/lcov-report/index.html

# 前端覆盖率  
cd frontend && npm test -- --coverage
```

### 新增功能测试状态

根据 `test_err.md` 的报告：

#### ✅ 已通过的测试
- RoomSwitchConfirmModal: 12个测试用例
- ReconnectionIndicator: 12个测试用例  
- UserCurrentRoomStatus: 12个测试用例 (已修复act()问题)

#### ⚠️ 需要关注的测试
- SocketService增强功能: 需要优化Mock策略
- 后端SystemHandlers: 需要修复Prisma配置

---

## 🔍 测试文件结构

```
texas_poker/
├── backend/tests/              # 后端测试
│   ├── game/                  # 游戏逻辑测试
│   ├── socket/                # Socket通信测试
│   │   └── systemHandlers.enhanced.test.ts  # 新增
│   └── routes/                # API路由测试
│
├── frontend/src/              # 前端测试
│   ├── components/__tests__/  # 组件测试
│   │   ├── RoomSwitchConfirmModal.test.tsx     # 新增
│   │   ├── UserCurrentRoomStatus.test.tsx      # 新增
│   │   └── ReconnectionIndicator.test.tsx      # 新增
│   └── services/__tests__/    # 服务测试
│       └── socketService.enhanced.test.ts      # 新增
│
└── e2e-tests/                 # E2E测试
    ├── tests/                 # 测试用例
    ├── playwright.config.ts   # Playwright配置
    └── test_plan.md          # 测试计划
```

---

## 🚀 快速测试命令汇总

```bash
# 🔥 最常用的测试命令

# 快速测试新增功能
cd frontend && npm test -- RoomSwitch  # 测试房间切换组件
cd frontend && npm test -- UserCurrent # 测试用户状态组件
cd frontend && npm test -- Reconnection # 测试重连组件

# 快速后端测试
cd backend && npm test -- systemHandlers.enhanced  # 测试后端增强功能

# 快速E2E测试
cd e2e-tests && npm run test:chromium  # 只测试Chrome

# 快速全量测试（约5分钟）
./test-all.sh  # 如果存在，或者手动执行上述流程
```

---

## 💡 测试最佳实践

1. **开发时**：使用 `--watch` 模式进行即时反馈
2. **提交前**：运行完整测试套件确保质量
3. **修复测试**：参考 `test_err.md` 中的已修复示例
4. **调试测试**：使用 `--verbose` 和 `--debug` 选项
5. **E2E测试**：确保开发环境完全启动后再运行

有任何测试问题，请参考 `test_err.md` 文件中的详细解决方案！