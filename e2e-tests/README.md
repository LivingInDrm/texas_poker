# Texas Poker E2E Tests

德州扑克游戏的端到端测试套件，使用 Playwright 框架。

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
# 运行所有E2E测试
npm test

# 运行带界面的测试（可视化调试）
npm run test:headed

# 运行交互式UI模式
npm run test:ui

# 运行调试模式
npm run test:debug
```

### 针对特定浏览器运行

```bash
# 仅在Chromium中运行
npm run test:chromium

# 仅在Firefox中运行  
npm run test:firefox

# 仅在Webkit/Safari中运行
npm run test:webkit
```

### 查看测试报告

```bash
npm run report
```

## 📁 目录结构

```
e2e-tests/
├── package.json              # E2E测试依赖配置
├── playwright.config.ts      # Playwright配置文件
├── tests/                    # 测试文件目录
│   ├── auth.spec.ts          # 完整的认证流程测试
│   └── auth-simplified.spec.ts  # 简化版认证测试
├── playwright-report/        # HTML测试报告
├── test-results/            # 测试结果详情
└── README.md               # 本文档
```

## 🧪 测试用例

### 用户认证流程测试

**文件**: `tests/auth-simplified.spec.ts`

- ✅ 用户注册流程
- ✅ 登录/注册模式切换  
- ✅ 表单数据清空验证
- ✅ 表单验证（必填字段）
- ✅ 大厅页面基本功能
- ✅ 退出登录功能

**测试覆盖**:
- 前后端API通信
- JWT认证机制
- React组件交互
- 路由跳转和保护
- 数据库操作验证
- 用户状态管理

## ⚙️ 配置说明

### Playwright配置 (`playwright.config.ts`)

- **测试目录**: `./tests`
- **基础URL**: `http://localhost:5173` (前端开发服务器)
- **并行执行**: 启用
- **浏览器支持**: Chromium, Firefox, Webkit
- **自动启动**: 前端开发服务器

### 环境要求

在运行E2E测试前，请确保：

1. **后端服务运行中** (http://localhost:3001)
   ```bash
   cd ../backend && npm run dev
   ```

2. **数据库服务运行中** (PostgreSQL + Redis)
   ```bash
   cd .. && docker-compose up postgres redis
   ```

3. **前端服务会自动启动** (通过webServer配置)

## 🔧 开发指南

### 添加新测试

1. 在 `tests/` 目录下创建新的 `.spec.ts` 文件
2. 使用Playwright的测试API编写测试用例
3. 遵循现有的测试结构和命名约定

### 测试最佳实践

- 使用页面对象模式封装复杂交互
- 为每个测试生成唯一的测试数据
- 使用适当的等待策略避免flaky测试
- 添加清晰的测试描述和注释

### 调试测试失败

```bash
# 运行特定测试文件
npx playwright test tests/auth-simplified.spec.ts

# 运行特定测试用例
npx playwright test -g "用户注册流程"

# 开启调试模式
npm run test:debug
```

## 📊 测试结果

最近运行结果：
- **总测试数**: 6个
- **通过率**: 100%
- **执行时间**: ~1.4秒
- **覆盖浏览器**: Chromium

## 🔗 相关链接

- [Playwright 官方文档](https://playwright.dev/)
- [Texas Poker 项目架构文档](../codebase_architecture.md)
- [开发计划](../plan.md)