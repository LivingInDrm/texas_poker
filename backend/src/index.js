"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./db");
const prisma_1 = __importDefault(require("./prisma"));
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
const room_1 = __importDefault(require("./routes/room"));
const socketServer_1 = require("./socket/socketServer");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API 路由
app.use('/api/auth', auth_1.default);
app.use('/api/user', user_1.default);
app.use('/api/room', room_1.default);
app.get('/api/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pgResult = yield db_1.pgClient.query('SELECT NOW()');
        const redisResult = yield db_1.redisClient.ping();
        // 测试 Prisma 连接
        yield prisma_1.default.$connect();
        const userCount = yield prisma_1.default.user.count();
        res.json({
            status: 'ok',
            message: 'Texas Poker Backend is running!',
            timestamp: new Date().toISOString(),
            databases: {
                postgres: pgResult.rows[0],
                redis: redisResult,
                prisma: {
                    connected: true,
                    userCount
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
// 添加 Prisma CRUD 测试端点
app.get('/api/test/prisma', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 创建测试用户
        const testUser = yield prisma_1.default.user.create({
            data: {
                username: `test_user_${Date.now()}`,
                passwordHash: 'hashed_password_test',
                avatar: 'https://example.com/avatar.jpg'
            }
        });
        // 查询用户
        const foundUser = yield prisma_1.default.user.findUnique({
            where: { id: testUser.id }
        });
        // 创建测试房间
        const testRoom = yield prisma_1.default.room.create({
            data: {
                ownerId: testUser.id,
                playerLimit: 6,
                password: 'test123'
            }
        });
        // 查询房间及关联用户
        const roomWithOwner = yield prisma_1.default.room.findUnique({
            where: { id: testRoom.id },
            include: { owner: true }
        });
        // 创建游戏记录
        const gameRecord = yield prisma_1.default.gameRecord.create({
            data: {
                roomId: testRoom.id,
                userId: testUser.id,
                chipsBefore: 5000,
                chipsAfter: 5500,
                chipsChange: 500,
                handResult: 'Pair of Aces',
                isWinner: true,
                gameData: {
                    cards: ['AH', 'AS'],
                    board: ['KD', 'QC', '7S', '3H', '2D'],
                    actions: ['bet', 'call', 'raise']
                }
            }
        });
        // 清理测试数据
        yield prisma_1.default.gameRecord.delete({ where: { id: gameRecord.id } });
        yield prisma_1.default.room.delete({ where: { id: testRoom.id } });
        yield prisma_1.default.user.delete({ where: { id: testUser.id } });
        res.json({
            status: 'success',
            message: 'Prisma CRUD operations completed successfully',
            testResults: {
                userCreated: !!testUser,
                userFound: !!foundUser,
                roomCreated: !!testRoom,
                roomWithOwner: !!(roomWithOwner === null || roomWithOwner === void 0 ? void 0 : roomWithOwner.owner),
                gameRecordCreated: !!gameRecord,
                cleanupCompleted: true
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Prisma test failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.connectDatabases)();
        // 初始化Socket.IO服务器
        const io = (0, socketServer_1.createSocketServer)(httpServer);
        console.log('🔌 Socket.IO server initialized');
        httpServer.listen(PORT, () => {
            console.log(`🃏 Texas Poker Server running on port ${PORT}`);
            console.log(`🌐 HTTP server: http://localhost:${PORT}`);
            console.log(`⚡ WebSocket server: ws://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
});
startServer();
