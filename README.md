# 🃏 Texas Poker

一个基于现代Web技术栈的在线德州扑克游戏，支持多人实时对战。

## 📁 项目结构

```
texas_poker/
├── 📁 backend/          # 后端服务 (Node.js + Express + TypeScript)
├── 📁 frontend/         # 前端应用 (React + Vite + TypeScript)  
├── 📁 e2e-tests/        # 端到端测试 (Playwright)
├── 📄 docker-compose.yml    # 开发环境编排
├── 📄 plan.md               # 开发计划和进度
└── 📄 codebase_architecture.md  # 架构文档
```

## 🚀 快速开始

### 开发环境启动

```bash
# 使用开发脚本一键启动
./dev.sh start

# 或者手动启动各服务
docker-compose up postgres redis  # 启动数据库
cd backend && npm run dev         # 启动后端
cd frontend && npm run dev        # 启动前端
```

### 运行测试

```bash
# 后端单元测试
cd backend && npm test

# 前端单元测试  
cd frontend && npm test

# E2E测试
cd e2e-tests && npm test
```

## 🧪 测试覆盖

- **后端**: 145个单元测试用例，100%通过
- **前端**: 86个组件测试用例，98.8%通过  
- **E2E**: 6个端到端测试用例，100%通过

## 📖 文档

- [开发计划](plan.md) - 详细的开发进度和任务
- [架构文档](codebase_architecture.md) - 技术架构说明
- [E2E测试文档](e2e-tests/README.md) - 端到端测试指南

## 🛠️ 技术栈

### 后端
- Node.js + Express + TypeScript
- PostgreSQL + Redis  
- Socket.IO + Prisma ORM
- JWT认证 + bcrypt

### 前端
- React 19 + TypeScript
- Vite 6 + Tailwind CSS 4
- Zustand + React Router 7
- Socket.IO Client

### 测试
- Jest (后端单元测试)
- Vitest + React Testing Library (前端测试)
- Playwright (E2E测试)

## 🎮 功能特性

- ✅ 用户注册/登录系统
- ✅ 房间创建和管理
- ✅ 完整的德州扑克游戏逻辑
- ✅ 实时多人对战 (WebSocket)
- ✅ 响应式UI设计
- ✅ 完整的测试覆盖

## 📊 开发进度

**总体进度**: ~60% 完成

- **基础架构**: ✅ 100% 完成
- **用户系统**: ✅ 100% 完成  
- **房间系统**: ✅ 100% 完成
- **游戏逻辑**: ✅ 100% 完成
- **前端UI**: ✅ 100% 完成
- **实时通信**: ✅ 100% 完成
- **集成测试**: 🔄 进行中

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目！
