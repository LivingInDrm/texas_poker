# Texas Poker 开发环境指南

## 📋 概述

本项目提供了两种开发环境方案：

1. **Docker 开发环境**：完全容器化，环境一致性好
2. **本地开发环境**：启动快速，调试方便

## 🚀 快速开始

### 方案一：本地开发环境（推荐）

适合日常开发，启动快速，调试方便。

```bash
# 1. 启动数据库服务（只需要运行一次）
docker-compose up -d postgres redis

# 2. 安装依赖
./dev-local.sh install

# 3. 启动开发环境
./dev-local.sh start

# 4. 查看状态
./dev-local.sh status
```

### 方案二：Docker 开发环境

适合生产环境模拟，环境完全隔离。

```bash
# 构建并启动
./dev.sh start

# 查看状态
./dev.sh status
```

## 📊 当前环境状态

### 检测到的问题
- ✅ PostgreSQL: 运行正常
- ✅ Redis: 运行正常  
- ⚠️ Backend: 当前有本地进程运行在端口3001
- ⚠️ Frontend: 当前有本地进程运行在端口5173

### 建议操作
1. 如果想使用Docker环境：运行 `./dev.sh start`
2. 如果想继续本地开发：运行 `./dev-local.sh start`

## 🛠️ 开发脚本使用指南

### dev-local.sh（本地开发脚本）

```bash
# 基本操作
./dev-local.sh start      # 启动本地开发环境
./dev-local.sh stop       # 停止本地开发环境
./dev-local.sh restart    # 重启本地开发环境
./dev-local.sh status     # 查看服务状态

# 日志查看
./dev-local.sh logs              # 查看所有日志
./dev-local.sh logs backend      # 查看后端日志
./dev-local.sh logs frontend     # 查看前端日志

# 其他操作
./dev-local.sh install    # 安装依赖
./dev-local.sh test       # 测试连接
```

### dev.sh（Docker开发脚本）

```bash
# 基本操作
./dev.sh build      # 构建开发环境
./dev.sh start      # 启动开发环境
./dev.sh stop       # 停止开发环境
./dev.sh restart    # 重启开发环境
./dev.sh rebuild    # 重建并重启

# 状态和日志
./dev.sh status             # 查看服务状态
./dev.sh logs               # 查看所有日志
./dev.sh logs backend       # 查看后端日志

# 容器操作
./dev.sh shell backend      # 进入后端容器
./dev.sh shell postgres     # 进入数据库
./dev.sh shell redis        # 进入Redis

# 清理
./dev.sh clean              # 清理开发环境
```

## 🌐 访问地址

### 开发环境
- 📱 **前端应用**: http://localhost:5173
- 🔧 **后端API**: http://localhost:3001
- 🗄️ **数据库**: postgresql://postgres:password@localhost:5432/texas_poker
- 🔴 **Redis**: redis://localhost:6379

### API测试
```bash
# 健康检查
curl http://localhost:3001/health

# 用户注册
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

## 🔧 环境配置

### 环境变量
开发环境的环境变量在以下位置配置：
- `backend/.env` - 后端环境变量
- `docker-compose.yml` - Docker环境变量

### 数据库配置
```bash
# 运行数据库迁移
cd backend && npm run db:migrate

# 重置数据库
cd backend && npm run db:reset

# 查看数据库
cd backend && npm run db:studio
```

## 🐛 常见问题解决

### 1. 端口被占用
```bash
# 查看端口占用
lsof -i :3001
lsof -i :5173

# 停止占用进程
./dev-local.sh stop
# 或
./dev.sh stop
```

### 2. Docker服务无法启动
```bash
# 检查Docker状态
docker info

# 重启Docker服务
./dev.sh restart

# 强制重建
./dev.sh rebuild
```

### 3. 数据库连接失败
```bash
# 检查数据库容器
docker-compose ps postgres

# 重启数据库
docker-compose restart postgres

# 查看数据库日志
docker-compose logs postgres
```

### 4. 前端编译错误
```bash
# 清理node_modules并重新安装
cd frontend
rm -rf node_modules package-lock.json
npm install

# 查看详细错误
./dev-local.sh logs frontend
```

### 5. 后端启动失败
```bash
# 检查TypeScript编译
cd backend && npm run build

# 查看详细错误
./dev-local.sh logs backend

# 检查环境变量
cat backend/.env
```

## 📝 开发工作流

### 1. 日常开发
```bash
# 启动开发环境
./dev-local.sh start

# 进行开发...

# 查看日志
./dev-local.sh logs

# 测试功能
./dev-local.sh test
```

### 2. 测试新功能
```bash
# 🔥 快速测试所有功能
./test-all.sh

# 🧪 只测试新增功能
./test-all.sh new

# 📊 分类测试
./test-all.sh backend    # 后端测试
./test-all.sh frontend   # 前端测试
./test-all.sh e2e        # E2E测试

# 💫 单独测试特定功能
cd backend && npm test -- tests/socket/systemHandlers.enhanced.test.ts
cd frontend && npm test -- RoomSwitchConfirmModal.test.tsx
```

### 3. 提交代码前
```bash
# 🚀 一键运行完整测试套件
./test-all.sh

# 📊 查看测试覆盖率
cd backend && npm run test:coverage
cd frontend && npm test -- --coverage

# 🏗️ 测试构建
./test-all.sh build

# 🔍 检查测试报告
cat test_report.md
cat test_err.md  # 查看已知问题
```

## 🚀 部署相关

### 开发环境 → 生产环境
```bash
# 1. 测试生产构建
docker-compose -f docker-compose.prod.yml build

# 2. 配置生产环境变量
cp .env.prod.example .env.prod
# 编辑 .env.prod 填入生产配置

# 3. 部署到生产环境
./deploy.sh
```

## 📚 更多资源

- [技术设计文档](./texas_poker_tech_design.md)
- [产品设计文档](./texas_poker_product_design.md)
- [代码架构文档](./codebase_architecture.md)
- [开发计划](./plan.md)
- [测试运行指南](./TEST_GUIDE.md) ⭐ **NEW**
- [测试问题报告](./test_err.md) ⭐ **NEW**

## 🆘 获取帮助

如果遇到问题：

1. 查看本文档的常见问题解决部分
2. 运行 `./dev-local.sh help` 或 `./dev.sh help` 查看命令帮助
3. 检查日志文件：`backend_dev.log` 和 `frontend_dev.log`
4. 查看Docker容器日志：`docker-compose logs [service]`
5. **测试相关问题**：
   - 查看 `./TEST_GUIDE.md` 了解如何运行测试
   - 查看 `./test_err.md` 了解已知测试问题和解决方案
   - 运行 `./test-all.sh help` 查看测试命令帮助