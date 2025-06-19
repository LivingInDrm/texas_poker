# Texas Poker Backend 开发指南

**版本**: 1.0  
**更新日期**: 2025-06-19  
**适用对象**: 新加入的后端开发人员  

---

## 📋 目录

- [1. 项目概览](#1-项目概览)
- [2. 技术栈与架构](#2-技术栈与架构)
- [3. 开发环境设置](#3-开发环境设置)
- [4. 代码组织规范](#4-代码组织规范)
- [5. 开发规范与最佳实践](#5-开发规范与最佳实践)
- [6. 核心模块详解](#6-核心模块详解)
- [7. 扩展开发指南](#7-扩展开发指南)
- [8. 测试规范](#8-测试规范)
- [9. 部署与维护](#9-部署与维护)
- [10. 常见问题与解决方案](#10-常见问题与解决方案)

---

## 1. 项目概览

### 1.1 项目描述
Texas Poker Backend 是一个基于 Node.js + TypeScript 的实时多人德州扑克游戏后端服务，支持 HTTP REST API 和 WebSocket 实时通信。

### 1.2 核心功能
- 🔐 **用户认证系统** - JWT 认证、注册登录
- 🏠 **房间管理** - 创建、加入、离开房间
- 🎮 **游戏引擎** - 完整德州扑克逻辑
- ⚡ **实时通信** - Socket.IO 实时事件
- 💾 **数据持久化** - PostgreSQL + Redis

### 1.3 架构特点
- **分层架构** - 表现层、控制层、业务逻辑层、数据访问层
- **模块化设计** - 功能域分离，职责清晰
- **类型安全** - 100% TypeScript，严格类型检查
- **实时性能** - 毫秒级响应，支持高并发

---

## 2. 技术栈与架构

### 2.1 核心技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | 18+ | 运行时环境 |
| **TypeScript** | 5.0+ | 开发语言 |
| **Express.js** | 4.x | HTTP 服务器框架 |
| **Socket.IO** | 4.x | 实时通信 |
| **Prisma** | 5.x | ORM 和数据库访问 |
| **PostgreSQL** | 15+ | 主数据库 |
| **Redis** | 7+ | 缓存和状态存储 |
| **JWT** | - | 身份认证 |

### 2.2 分层架构

```
┌─────────────────────────────────────┐
│     REST API & Socket.IO Routes     │  ← 表现层 (routes/, socket/)
├─────────────────────────────────────┤
│        Socket Event Handlers        │  ← 控制层 (socket/handlers/)
├─────────────────────────────────────┤
│     Services & Game Engine          │  ← 业务逻辑层 (services/, game/)
├─────────────────────────────────────┤
│    Prisma ORM & Redis & Database    │  ← 数据访问层 (prisma.ts, db.ts)
└─────────────────────────────────────┘
```

### 2.3 目录结构概览

```
src/
├── index.ts             # 应用入口点
├── db.ts               # Redis 配置
├── prisma.ts           # Prisma ORM 客户端
├── healthcheck.ts      # 健康检查端点
├── routes/             # HTTP REST API 路由
│   ├── auth.ts         # 认证相关 API
│   ├── user.ts         # 用户管理 API
│   ├── room.ts         # 房间管理 API
│   └── admin.ts        # 管理员 API
├── socket/             # Socket.IO 实时通信
│   ├── socketServer.ts # Socket 服务器配置
│   ├── handlers/       # 事件处理器
│   │   ├── gameHandlers.ts    # 游戏事件处理
│   │   ├── roomHandlers.ts    # 房间事件处理
│   │   └── systemHandlers.ts  # 系统事件处理
│   └── middleware/     # Socket 中间件
│       └── validation.ts      # 验证中间件
├── game/               # 游戏引擎核心
│   ├── Card.ts         # 扑克牌类
│   ├── Deck.ts         # 牌堆类
│   ├── GameState.ts    # 游戏状态管理
│   ├── HandRank.ts     # 牌型判断
│   ├── PositionManager.ts     # 位置管理
│   └── PotManager.ts          # 奖池管理
├── services/           # 业务服务层
│   └── userStateService.ts   # 用户状态服务
├── middleware/         # Express 中间件
│   └── auth.ts         # JWT 认证中间件
└── types/              # TypeScript 类型定义
    ├── express.d.ts    # Express 扩展类型
    └── socket.ts       # Socket.IO 类型定义
```

---

## 3. 开发环境设置

### 3.1 环境要求
- Node.js 18+
- npm 或 yarn
- Docker 和 Docker Compose
- PostgreSQL 15+
- Redis 7+

### 3.2 项目启动

```bash
# 1. 克隆项目
git clone <repository-url>
cd texas_poker/backend

# 2. 安装依赖
npm install

# 3. 环境配置
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 4. 启动数据库服务
cd .. && docker-compose up -d postgres redis

# 5. 数据库初始化
npx prisma migrate dev
npx prisma generate

# 6. 启动开发服务器
npm run dev
```

### 3.3 开发工具配置

#### TypeScript 配置 (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

#### 环境变量 (`.env`)
```env
# 数据库
DATABASE_URL="postgresql://username:password@localhost:5432/texas_poker"
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key"

# 服务配置
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

---

## 4. 代码组织规范

### 4.1 文件命名规范

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| **类文件** | PascalCase | `GameState.ts`, `PotManager.ts` |
| **服务文件** | camelCase | `userStateService.ts` |
| **路由文件** | 小写 | `auth.ts`, `room.ts` |
| **类型文件** | camelCase | `socket.ts`, `express.d.ts` |

### 4.2 导入导出规范

```typescript
// ✅ 推荐：命名导出 + 默认导出
export class GameState { ... }
export const GAME_PHASES = { ... };
export default GameState;

// ✅ 推荐：单例服务
export const userStateService = UserStateService.getInstance();

// ✅ 推荐：类型集中导出
export {
  ServerToClientEvents,
  ClientToServerEvents,
  RoomState,
  GameState
} from './types/socket';
```

### 4.3 目录职责分工

| 目录 | 职责 | 包含内容 |
|------|------|----------|
| **routes/** | REST API 端点 | HTTP 路由处理，请求响应 |
| **socket/** | 实时通信 | Socket.IO 服务器，事件处理器 |
| **game/** | 游戏引擎 | 游戏逻辑，规则计算 |
| **services/** | 业务服务 | 跨模块业务逻辑 |
| **middleware/** | 中间件 | 认证，验证，日志等 |
| **types/** | 类型定义 | TypeScript 接口和类型 |

---

## 5. 开发规范与最佳实践

### 5.1 TypeScript 编码规范

#### 5.1.1 类型定义
```typescript
// ✅ 推荐：明确的接口定义
export interface RoomPlayer {
  id: string;
  username: string;
  chips: number;
  position: number;
  isReady: boolean;
  status: PlayerStatus;
}

// ✅ 推荐：枚举使用 PascalCase
export enum PlayerAction {
  FOLD = 'fold',
  CHECK = 'check',
  CALL = 'call',
  RAISE = 'raise',
  ALL_IN = 'all_in'
}

// ✅ 推荐：常量对象类型安全
export const SOCKET_EVENTS = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  GAME_ACTION: 'game:action'
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
```

#### 5.1.2 函数和类设计
```typescript
// ✅ 推荐：明确的返回类型
export async function createRoom(
  userId: string, 
  options: RoomCreateOptions
): Promise<{ success: boolean; room?: Room; error?: string }> {
  try {
    const room = await prisma.room.create({
      data: {
        ownerId: userId,
        ...options
      }
    });
    
    return { success: true, room };
  } catch (error) {
    console.error('Failed to create room:', error);
    return { success: false, error: 'Failed to create room' };
  }
}

// ✅ 推荐：类的职责单一化
export class PotManager {
  private mainPot: number = 0;
  private sidePots: SidePot[] = [];

  public addToPot(amount: number): void {
    this.mainPot += amount;
  }

  public distributePots(winners: GamePlayer[]): PotDistribution[] {
    // 奖池分配逻辑
  }
}
```

### 5.2 错误处理规范

#### 5.2.1 API 错误处理
```typescript
// ✅ 推荐：统一的错误响应格式
export const handleApiError = (res: Response, error: unknown, message: string) => {
  console.error(message, error);
  
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  
  return res.status(500).json({ error: 'Internal server error' });
};

// 使用示例
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const room = await createRoom(req.user.id, req.body);
    res.status(201).json({ message: 'Room created', room });
  } catch (error) {
    handleApiError(res, error, 'Failed to create room');
  }
});
```

#### 5.2.2 Socket 错误处理
```typescript
// ✅ 推荐：Socket 回调错误处理
socket.on('room:join', async (data, callback) => {
  try {
    const result = await joinRoom(socket.data.userId, data.roomId);
    
    callback({
      success: true,
      message: 'Joined room successfully',
      data: result
    });
  } catch (error) {
    console.error('Failed to join room:', error);
    
    callback({
      success: false,
      error: 'Failed to join room',
      message: SOCKET_ERRORS.ROOM_JOIN_FAILED
    });
  }
});
```

### 5.3 数据库操作规范

#### 5.3.1 Prisma 最佳实践
```typescript
// ✅ 推荐：使用事务处理复杂操作
export async function transferChips(
  fromUserId: string,
  toUserId: string,
  amount: number
): Promise<TransferResult> {
  return await prisma.$transaction(async (tx) => {
    // 1. 检查余额
    const fromUser = await tx.user.findUnique({ where: { id: fromUserId } });
    if (!fromUser || fromUser.chips < amount) {
      throw new Error('Insufficient chips');
    }

    // 2. 执行转账
    await tx.user.update({
      where: { id: fromUserId },
      data: { chips: { decrement: amount } }
    });

    await tx.user.update({
      where: { id: toUserId },
      data: { chips: { increment: amount } }
    });

    // 3. 记录交易
    const transaction = await tx.chipTransaction.create({
      data: {
        fromUserId,
        toUserId,
        amount,
        type: 'TRANSFER'
      }
    });

    return { success: true, transaction };
  });
}

// ✅ 推荐：合理使用 include 和 select
const room = await prisma.room.findUnique({
  where: { id: roomId },
  include: {
    owner: {
      select: { id: true, username: true, avatar: true }
    }
  }
});
```

#### 5.3.2 Redis 缓存策略
```typescript
// ✅ 推荐：状态缓存模式
export class RoomStateManager {
  private static readonly CACHE_TTL = 3600; // 1小时

  async getRoomState(roomId: string): Promise<RoomState | null> {
    const cached = await redisClient.get(`room:${roomId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // 从数据库加载
    const roomState = await this.loadRoomFromDatabase(roomId);
    if (roomState) {
      await this.setRoomState(roomId, roomState);
    }
    
    return roomState;
  }

  async setRoomState(roomId: string, state: RoomState): Promise<void> {
    await redisClient.setEx(
      `room:${roomId}`,
      RoomStateManager.CACHE_TTL,
      JSON.stringify(state)
    );
  }
}
```

### 5.4 安全性规范

#### 5.4.1 输入验证
```typescript
import { z } from 'zod';

// ✅ 推荐：使用 Zod 进行输入验证
const CreateRoomSchema = z.object({
  playerLimit: z.number().min(2).max(9),
  password: z.string().optional(),
  bigBlind: z.number().positive(),
  smallBlind: z.number().positive()
}).refine(data => data.bigBlind > data.smallBlind, {
  message: "Big blind must be greater than small blind"
});

export const validateCreateRoom = (data: unknown) => {
  return CreateRoomSchema.safeParse(data);
};
```

#### 5.4.2 速率限制
```typescript
// ✅ 推荐：实现速率限制
export class RateLimiter {
  private static readonly ACTION_LIMIT = 10; // 每分钟10次操作
  private static readonly WINDOW_MS = 60000; // 1分钟

  async checkActionLimit(userId: string, action: string): Promise<boolean> {
    const key = `rate_limit:${userId}:${action}`;
    const current = await redisClient.get(key);
    
    if (!current) {
      await redisClient.setEx(key, Math.ceil(RateLimiter.WINDOW_MS / 1000), '1');
      return true;
    }
    
    const count = parseInt(current);
    if (count >= RateLimiter.ACTION_LIMIT) {
      return false;
    }
    
    await redisClient.incr(key);
    return true;
  }
}
```

---

## 6. 核心模块详解

### 6.1 游戏引擎模块 (`game/`)

#### 6.1.1 GameState - 游戏状态管理器
```typescript
// src/game/GameState.ts
export class GameState {
  private gameId: string;
  private phase: GamePhase = GamePhase.WAITING;
  private players: Map<string, GamePlayer> = new Map();
  private deck: Deck;
  private communityCards: Card[] = [];
  private potManager: PotManager;
  private positionManager: PositionManager;

  constructor(gameId: string, smallBlind: number, bigBlind: number) {
    this.gameId = gameId;
    this.deck = new Deck();
    this.potManager = new PotManager();
    this.positionManager = new PositionManager();
  }

  // 核心游戏逻辑
  public startNewHand(): boolean {
    if (!this.canStartGame()) return false;

    this.resetForNewHand();
    this.dealHoleCards();
    this.postBlinds();
    this.phase = GamePhase.PRE_FLOP;
    
    return true;
  }

  public executePlayerAction(playerId: string, action: PlayerAction, amount?: number): boolean {
    if (!this.isValidAction(playerId, action, amount)) {
      return false;
    }

    this.processAction(playerId, action, amount);
    
    if (this.isBettingRoundComplete()) {
      this.nextPhase();
    } else {
      this.setNextPlayer();
    }

    return true;
  }
}
```

#### 6.1.2 游戏引擎使用模式
```typescript
// 典型的游戏流程
const gameState = new GameState('game-123', 10, 20);

// 添加玩家
gameState.addPlayer('player1', 'Alice', 5000);
gameState.addPlayer('player2', 'Bob', 5000);

// 开始游戏
if (gameState.canStartGame()) {
  gameState.startNewHand();
}

// 处理玩家动作
const actionResult = gameState.executePlayerAction('player1', PlayerAction.RAISE, 40);
if (actionResult) {
  // 广播游戏状态更新
  io.to(roomId).emit('game:state_update', gameState.getGameSnapshot());
}
```

### 6.2 Socket.IO 实时通信模块 (`socket/`)

#### 6.2.1 事件处理器架构
```typescript
// src/socket/handlers/gameHandlers.ts
export function setupGameHandlers(socket: AuthenticatedSocket, io: SocketIOServer) {
  socket.on(SOCKET_EVENTS.GAME_ACTION, async (data, callback) => {
    try {
      // 1. 验证用户权限
      const validation = await validationMiddleware.validatePlayerAction(
        socket.data.userId, 
        data.roomId, 
        data.action
      );
      
      if (!validation.valid) {
        return callback({
          success: false,
          error: validation.error
        });
      }

      // 2. 获取游戏状态
      const gameState = await getGameState(data.roomId);
      if (!gameState) {
        return callback({
          success: false,
          error: 'Game not found'
        });
      }

      // 3. 执行游戏动作
      const actionResult = gameState.executePlayerAction(
        socket.data.userId,
        data.action.type,
        data.action.amount
      );

      if (!actionResult) {
        return callback({
          success: false,
          error: 'Invalid action'
        });
      }

      // 4. 保存状态并广播
      await saveGameState(data.roomId, gameState);
      
      io.to(data.roomId).emit(SOCKET_EVENTS.GAME_STATE_UPDATE, {
        gameState: gameState.getGameSnapshot(),
        lastAction: {
          playerId: socket.data.userId,
          action: data.action,
          timestamp: Date.now()
        }
      });

      callback({
        success: true,
        message: 'Action processed successfully'
      });

    } catch (error) {
      console.error('Game action error:', error);
      callback({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}
```

#### 6.2.2 类型安全的事件定义
```typescript
// src/types/socket.ts
export interface ServerToClientEvents {
  'room:state_update': (data: { roomState: RoomState }) => void;
  'game:state_update': (data: { gameState: GameSnapshot; lastAction?: ActionInfo }) => void;
  'game:hand_complete': (data: { winners: WinnerInfo[]; pots: PotDistribution[] }) => void;
  'player:disconnected': (data: { playerId: string; username: string }) => void;
}

export interface ClientToServerEvents {
  'room:join': (data: { roomId: string; password?: string }, callback: SocketCallback) => void;
  'room:leave': (data: { roomId: string }, callback: SocketCallback) => void;
  'game:action': (data: { roomId: string; action: PlayerActionData }, callback: SocketCallback) => void;
  'game:ready': (data: { roomId: string }, callback: SocketCallback) => void;
}

export type SocketCallback = (response: SocketResponse) => void;

export interface SocketResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}
```

### 6.3 REST API 模块 (`routes/`)

#### 6.3.1 认证路由示例
```typescript
// src/routes/auth.ts
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { validateCreateRoom } from '../utils/validation';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 输入验证
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        chips: 5000 // 默认筹码
      },
      select: {
        id: true,
        username: true,
        chips: true,
        createdAt: true
      }
    });

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

### 6.4 服务层模块 (`services/`)

#### 6.4.1 用户状态服务
```typescript
// src/services/userStateService.ts
export class UserStateService {
  private static instance: UserStateService;
  private readonly USER_ROOM_TTL = 3600; // 1小时

  public static getInstance(): UserStateService {
    if (!UserStateService.instance) {
      UserStateService.instance = new UserStateService();
    }
    return UserStateService.instance;
  }

  // 获取用户当前房间
  async getUserCurrentRoom(userId: string): Promise<string | null> {
    try {
      return await redisClient.get(`user_room:${userId}`);
    } catch (error) {
      console.error('Failed to get user current room:', error);
      return null;
    }
  }

  // 设置用户当前房间
  async setUserCurrentRoom(userId: string, roomId: string): Promise<ServiceResult> {
    try {
      await redisClient.setEx(`user_room:${userId}`, this.USER_ROOM_TTL, roomId);
      return { success: true };
    } catch (error) {
      console.error('Failed to set user current room:', error);
      return { success: false, error: 'Failed to update user state' };
    }
  }

  // 强制离开当前房间
  async forceLeaveCurrentRoom(userId: string, reason: string): Promise<ServiceResult> {
    try {
      const currentRoom = await this.getUserCurrentRoom(userId);
      if (!currentRoom) {
        return { success: true }; // 用户不在任何房间
      }

      // 从房间状态中移除用户
      await this.removeUserFromRoom(userId, currentRoom, reason);
      
      // 清除用户房间状态
      await redisClient.del(`user_room:${userId}`);

      return { success: true };
    } catch (error) {
      console.error('Failed to force leave room:', error);
      return { success: false, error: 'Failed to leave room' };
    }
  }
}

// 导出单例实例
export const userStateService = UserStateService.getInstance();
```

---

## 7. 扩展开发指南

### 7.1 添加新的 REST API 端点

#### 步骤 1: 创建路由文件
```typescript
// src/routes/tournament.ts
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../prisma';

const router = express.Router();

// 创建锦标赛
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, buyIn, maxPlayers } = req.body;
    const { id: organizerId } = req.user;

    const tournament = await prisma.tournament.create({
      data: {
        name,
        buyIn,
        maxPlayers,
        organizerId,
        status: 'REGISTRATION'
      }
    });

    res.status(201).json({
      message: 'Tournament created successfully',
      tournament
    });
  } catch (error) {
    console.error('Tournament creation error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

export default router;
```

#### 步骤 2: 注册路由
```typescript
// src/index.ts
import tournamentRoutes from './routes/tournament';

// 注册路由
app.use('/api/tournament', tournamentRoutes);
```

#### 步骤 3: 更新数据库模型 (如需要)
```prisma
// prisma/schema.prisma
model Tournament {
  id           String @id @default(cuid())
  name         String
  buyIn        Int
  maxPlayers   Int
  organizerId  String
  status       TournamentStatus
  createdAt    DateTime @default(now())
  
  organizer    User @relation("TournamentOrganizer", fields: [organizerId], references: [id])
  participants TournamentPlayer[]
}

model TournamentPlayer {
  id           String @id @default(cuid())
  userId       String
  tournamentId String
  position     Int?
  eliminated   Boolean @default(false)
  
  user         User @relation(fields: [userId], references: [id])
  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  
  @@unique([userId, tournamentId])
}

enum TournamentStatus {
  REGISTRATION
  RUNNING
  FINISHED
  CANCELLED
}
```

### 7.2 添加新的 Socket 事件处理器

#### 步骤 1: 更新类型定义
```typescript
// src/types/socket.ts
export interface ClientToServerEvents {
  // ... 现有事件
  'tournament:join': (data: { tournamentId: string }, callback: SocketCallback) => void;
  'tournament:leave': (data: { tournamentId: string }, callback: SocketCallback) => void;
}

export interface ServerToClientEvents {
  // ... 现有事件
  'tournament:player_joined': (data: { tournamentId: string; player: TournamentPlayer }) => void;
  'tournament:started': (data: { tournamentId: string; tables: GameTable[] }) => void;
}
```

#### 步骤 2: 创建事件处理器
```typescript
// src/socket/handlers/tournamentHandlers.ts
export function setupTournamentHandlers(socket: AuthenticatedSocket, io: SocketIOServer) {
  socket.on('tournament:join', async (data, callback) => {
    try {
      const { tournamentId } = data;
      const userId = socket.data.userId;

      // 1. 验证锦标赛状态
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { participants: true }
      });

      if (!tournament) {
        return callback({
          success: false,
          error: 'Tournament not found'
        });
      }

      if (tournament.status !== 'REGISTRATION') {
        return callback({
          success: false,
          error: 'Tournament registration is closed'
        });
      }

      // 2. 检查是否已经参加
      const existingParticipant = tournament.participants.find(p => p.userId === userId);
      if (existingParticipant) {
        return callback({
          success: false,
          error: 'Already registered for this tournament'
        });
      }

      // 3. 加入锦标赛
      const participant = await prisma.tournamentPlayer.create({
        data: {
          userId,
          tournamentId
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true }
          }
        }
      });

      // 4. 加入 Socket 房间
      socket.join(`tournament:${tournamentId}`);

      // 5. 广播新参与者
      io.to(`tournament:${tournamentId}`).emit('tournament:player_joined', {
        tournamentId,
        player: participant
      });

      callback({
        success: true,
        message: 'Successfully joined tournament'
      });

    } catch (error) {
      console.error('Tournament join error:', error);
      callback({
        success: false,
        error: 'Failed to join tournament'
      });
    }
  });
}
```

#### 步骤 3: 注册处理器
```typescript
// src/socket/socketServer.ts
import { setupTournamentHandlers } from './handlers/tournamentHandlers';

io.use(authenticateSocket);

io.on('connection', (socket: AuthenticatedSocket) => {
  // ... 现有处理器
  setupTournamentHandlers(socket, io);
});
```

### 7.3 添加新的游戏功能

#### 示例：添加旁牌 (Side Bet) 功能

#### 步骤 1: 扩展游戏状态
```typescript
// src/game/GameState.ts
export interface SideBet {
  playerId: string;
  type: SideBetType;
  amount: number;
  odds: number;
}

export enum SideBetType {
  PAIR_PLUS = 'pair_plus',
  FLUSH_BONUS = 'flush_bonus'
}

export class GameState {
  private sideBets: Map<string, SideBet[]> = new Map();

  // 添加旁牌下注
  public placeSideBet(playerId: string, betType: SideBetType, amount: number): boolean {
    if (!this.isValidSideBet(playerId, betType, amount)) {
      return false;
    }

    const playerBets = this.sideBets.get(playerId) || [];
    playerBets.push({
      playerId,
      type: betType,
      amount,
      odds: this.getSideBetOdds(betType)
    });
    
    this.sideBets.set(playerId, playerBets);
    return true;
  }

  // 结算旁牌
  public settleSideBets(): SideBetResult[] {
    const results: SideBetResult[] = [];
    
    for (const [playerId, bets] of this.sideBets) {
      const player = this.players.get(playerId);
      if (!player) continue;

      for (const bet of bets) {
        const won = this.evaluateSideBet(player, bet);
        results.push({
          playerId,
          bet,
          won,
          payout: won ? bet.amount * bet.odds : 0
        });
      }
    }
    
    return results;
  }
}
```

#### 步骤 2: 添加 Socket 事件
```typescript
// 在 gameHandlers.ts 中添加
socket.on('game:side_bet', async (data, callback) => {
  try {
    const { roomId, betType, amount } = data;
    const userId = socket.data.userId;

    const gameState = await getGameState(roomId);
    if (!gameState) {
      return callback({ success: false, error: 'Game not found' });
    }

    const result = gameState.placeSideBet(userId, betType, amount);
    if (!result) {
      return callback({ success: false, error: 'Invalid side bet' });
    }

    await saveGameState(roomId, gameState);
    
    io.to(roomId).emit('game:side_bet_placed', {
      playerId: userId,
      betType,
      amount
    });

    callback({ success: true, message: 'Side bet placed' });
  } catch (error) {
    console.error('Side bet error:', error);
    callback({ success: false, error: 'Failed to place side bet' });
  }
});
```

---

## 8. 测试规范

### 8.1 测试架构
详细的测试规范请参考 [`BACKEND_TESTING_GUIDE.md`](./BACKEND_TESTING_GUIDE.md)

### 8.2 测试运行命令
```bash
# 运行所有测试
npm test

# 运行特定模块测试
npm test -- --testPathPattern="game"

# 运行测试覆盖率
npm run test:coverage

# 运行监视模式
npm run test:watch
```

### 8.3 编写测试的基本要求
```typescript
// 示例：游戏状态测试
describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState('test-game', 10, 20, 30000);
  });

  describe('Player Management', () => {
    test('should add players correctly', () => {
      expect(gameState.addPlayer('player1', 'Alice', 1000)).toBe(true);
      expect(gameState.addPlayer('player2', 'Bob', 1000)).toBe(true);
      expect(gameState.addPlayer('player1', 'Alice', 1000)).toBe(false); // 重复
    });

    test('should start game with sufficient players', () => {
      gameState.addPlayer('player1', 'Alice', 1000);
      gameState.addPlayer('player2', 'Bob', 1000);
      gameState.setPlayerReady('player1', true);
      gameState.setPlayerReady('player2', true);

      expect(gameState.canStartGame()).toBe(true);
      expect(gameState.startNewHand()).toBe(true);
    });
  });
});
```

---

## 9. 部署与维护

### 9.1 生产环境配置
```typescript
// 生产环境环境变量
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://prod_user:password@db_server:5432/texas_poker_prod"
REDIS_URL="redis://redis_server:6379"
JWT_SECRET="your-production-jwt-secret-key"
FRONTEND_URL="https://your-production-domain.com"
```

### 9.2 Docker 部署
```dockerfile
# Dockerfile.prod
FROM node:18-alpine

WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY src ./src
COPY tsconfig.json ./

# 构建应用
RUN npm run build
RUN npx prisma generate

# 暴露端口
EXPOSE 3001

# 启动应用
CMD ["npm", "start"]
```

### 9.3 监控和日志
```typescript
// 建议添加的监控代码
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// 游戏事件监控
export const logGameEvent = (event: string, data: any) => {
  logger.info('Game Event', {
    event,
    data,
    timestamp: new Date().toISOString()
  });
};
```

---

## 10. 常见问题与解决方案

### 10.1 开发环境问题

#### Q: Prisma 连接数据库失败
```bash
# 检查数据库服务
docker-compose ps postgres

# 重启数据库
docker-compose restart postgres

# 检查连接字符串
echo $DATABASE_URL
```

#### Q: Redis 连接问题
```bash
# 检查 Redis 服务
docker-compose ps redis

# 测试 Redis 连接
redis-cli -h localhost -p 6379 ping
```

#### Q: TypeScript 编译错误
```bash
# 清理编译缓存
npm run clean

# 重新生成 Prisma 客户端
npx prisma generate

# 重新构建
npm run build
```

### 10.2 运行时问题

#### Q: Socket.IO 连接问题
```typescript
// 检查 CORS 配置
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 检查认证中间件
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    // 验证逻辑...
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

#### Q: 游戏状态不同步
```typescript
// 确保状态保存
await redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));

// 确保广播到正确的房间
io.to(roomId).emit('game:state_update', gameState.getGameSnapshot());

// 检查房间成员
const members = await io.in(roomId).fetchSockets();
console.log('Room members:', members.length);
```

### 10.3 性能优化

#### Q: 数据库查询慢
```typescript
// 使用索引
// 在 Prisma schema 中添加索引
model Room {
  id     String @id @default(cuid())
  status String
  
  @@index([status])
}

// 使用连接池
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?connection_limit=10"
    }
  }
});
```

#### Q: Redis 内存使用高
```typescript
// 设置合适的 TTL
await redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));

// 定期清理过期数据
setInterval(async () => {
  const expiredKeys = await redisClient.keys('room:*');
  // 清理逻辑
}, 300000); // 5分钟
```

---

## 📚 参考资源

### 技术文档
- [Express.js 官方文档](https://expressjs.com/)
- [Socket.IO 官方文档](https://socket.io/docs/)
- [Prisma 官方文档](https://www.prisma.io/docs/)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)

### 项目相关文档
- [BACKEND_TESTING_GUIDE.md](./BACKEND_TESTING_GUIDE.md) - 测试开发指南
- [Prisma Schema](./prisma/schema.prisma) - 数据库模型定义
- [API 文档](./docs/) - API 接口文档

---

**文档维护者**: Texas Poker 开发团队  
**最后更新**: 2025-06-19  
**文档版本**: 1.0

如有问题或建议，请创建 Issue 或联系开发团队。