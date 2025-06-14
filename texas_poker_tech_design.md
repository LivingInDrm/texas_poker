# 🧱在线德州扑克网页游戏 - 技术设计文档 (MVP)

## 一、技术栏选

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | React + Vite + TypeScript | 快速开发，组件复用性高，支持响应式设计 |
| UI 库 | Tailwind CSS + Headless UI | 快速布局，兼容移动端 |
| 状态管理 | Zustand | 轻量级，适合游戏内状态同步 |
| 实时通信 | WebSocket (Socket.IO) | 满足多人实时对局需求 |
| 后端 | Node.js (Express) + TypeScript | 快速构建 API + WS 服务 |
| 数据库 | PostgreSQL | 支持交易，扩展性好 |
| 缓存 | Redis | 用于房间状态和用户会话 |
| 部署 | Docker + Nginx + PM2 | 支持容器化和分布式 |
| 认证 | JWT + Cookie | 前后端分离的认证框架 |

---

## 二、系统架构概览

```
Browser (React UI)
   |
WebSocket (Socket.IO) + REST API
   |
Backend (Node.js + Express)
   |
Redis (Room State, Session) + PostgreSQL (Persistent Data)
   |
Docker + Nginx
```

---

## 三、模块划分 (后端)

### 1. 用户模块
- `POST /api/auth/register` 注册
- `POST /api/auth/login` 登录，返回 JWT
- `GET /api/user/me` 获取当前用户

### 2. 房间模块
- `POST /api/room/create` 创建房间
- `GET /api/room/list` 房间列表
- `POST /api/room/join` 加入房间
- WS 事件:
  - `room:join`, `room:leave`
  - `room:state_update`
  - `room:chat`

### 3. 对局模块
- `game:start` 服务器发起发牌
- `game:action` 客户端操作
- `game:sync` 状态更新广播
- `game:end` 结算操作

### 4. 策略/算法模块
- 算策分析：计算主池/边池，加注规则
- 搜索最高牌型，进行比牌

---

## 四、数据库设计 (PostgreSQL)

### 用户表 `users`

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 主键 |
| username | TEXT | 用户名 |
| password_hash | TEXT | 密码加密值 |
| avatar | TEXT | 头像地址 |
| chips | INT | 当前筹码 |
| games_played | INT | 总场次 |
| win_rate | FLOAT | 胜率 |

### 房间表 `rooms`

| 字段 | 类型 | 描述 |
|------|------|------|
| id | UUID | 房间ID |
| owner_id | UUID | 创建者 |
| player_limit | INT | 最大人数 |
| password | TEXT | 加密储存 |
| status | ENUM | waiting / playing / ended |

---

## 五、Redis 状态管理

```json
room:{roomId} => {
  players: [...],
  dealerIndex: 3,
  smallBlindIndex: 4,
  turnIndex: 5,
  round: "flop",
  board: ["\u2660\ufe0f10", "\u2663\ufe0fJ", "\u2665\ufe0f5"],
  pot: 1200,
  actions: [...],
  timeout: 30
}
```

---

## 六、前端状态模型 (Zustand)

```ts
interface GameState {
  players: Player[],
  self: Player,
  board: string[],
  pot: number,
  actions: Action[],
  phase: "waiting" | "flop" | "turn" | "river" | "showdown",
  currentTurn: string,
  roomId: string
}
```

---

## 七、前端页面结构 (React Router)

| 页面 | 路径 | 描述 |
|------|------|------|
| 登录页 | `/login` | 用户登录/注册 |
| 大厅页 | `/lobby` | 快速开始/加入/创建房间 |
| 对局页 | `/game/:roomId` | 游戏操作页 |
| 结算弹窗 | `/game/:roomId/end` | 结果展示 |

---

---

## 八、部署 & 测试建议

- 本地开发：`Docker Compose`
- 单元测试：Jest + Supertest
- E2E 测试：Playwright
- 推荐部署:
  - Vercel (Web)
  - Fly.io / Railway / Render (Backend)
  - ElephantSQL
  - Upstash Redis

