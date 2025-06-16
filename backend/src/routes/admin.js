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
const auth_1 = require("../middleware/auth");
const userStateService_1 = require("../services/userStateService");
const db_1 = require("../db");
const prisma_1 = __importDefault(require("../prisma"));
const router = express_1.default.Router();
// 管理员权限检查中间件
const requireAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const authReq = req;
        const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = yield prisma_1.default.user.findUnique({
            where: { id: userId }
        });
        // Note: This assumes you have a role field in your user model
        // If not, you can check by userId or another method
        // For now, we'll use a simple user ID check for admin users
        const adminUserIds = ['admin-user-id']; // Replace with actual admin user IDs
        if (!adminUserIds.includes(userId)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    }
    catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// 获取用户状态概览
router.get('/user-states', auth_1.authenticateToken, requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const keys = yield db_1.redisClient.keys('user_room:*');
        const userStates = [];
        for (const key of keys) {
            const userId = key.replace('user_room:', '');
            const roomId = yield db_1.redisClient.get(key);
            if (roomId) {
                // 验证房间是否存在
                const roomExists = yield db_1.redisClient.exists(`room:${roomId}`);
                userStates.push({
                    userId,
                    roomId,
                    roomExists: !!roomExists,
                    key
                });
            }
        }
        res.json({
            totalUsers: userStates.length,
            userStates,
            summary: {
                validStates: userStates.filter(s => s.roomExists).length,
                orphanedStates: userStates.filter(s => !s.roomExists).length
            }
        });
    }
    catch (error) {
        console.error('Error getting user states:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 获取特定用户的状态
router.get('/user-states/:userId', auth_1.authenticateToken, requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const currentRoom = yield userStateService_1.userStateService.getUserCurrentRoom(userId);
        const consistency = yield userStateService_1.userStateService.validateRoomStateConsistency(userId);
        let roomDetails = null;
        if (currentRoom) {
            const roomData = yield db_1.redisClient.get(`room:${currentRoom}`);
            if (roomData) {
                const roomState = JSON.parse(roomData);
                const player = roomState.players.find((p) => p.id === userId);
                roomDetails = {
                    roomState,
                    playerInRoom: !!player,
                    playerDetails: player
                };
            }
        }
        res.json({
            userId,
            currentRoom,
            consistency,
            roomDetails
        });
    }
    catch (error) {
        console.error('Error getting user state:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 清理孤立的用户状态
router.post('/cleanup-orphaned-states', auth_1.authenticateToken, requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield userStateService_1.userStateService.cleanupOrphanedUserStates();
        res.json(Object.assign({ message: 'Cleanup completed' }, result));
    }
    catch (error) {
        console.error('Error cleaning up orphaned states:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 强制清除用户状态
router.delete('/user-states/:userId', auth_1.authenticateToken, requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const cleared = yield userStateService_1.userStateService.clearUserCurrentRoom(userId);
        res.json({
            message: cleared ? 'User state cleared successfully' : 'Failed to clear user state',
            userId,
            success: cleared
        });
    }
    catch (error) {
        console.error('Error clearing user state:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 获取房间状态和用户一致性报告
router.get('/room-consistency/:roomId', auth_1.authenticateToken, requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { roomId } = req.params;
        // 获取房间状态
        const roomData = yield db_1.redisClient.get(`room:${roomId}`);
        if (!roomData) {
            return res.status(404).json({ error: 'Room not found' });
        }
        const roomState = JSON.parse(roomData);
        const issues = [];
        const players = roomState.players || [];
        // 检查每个玩家的全局状态
        for (const player of players) {
            const userCurrentRoom = yield userStateService_1.userStateService.getUserCurrentRoom(player.id);
            if (userCurrentRoom !== roomId) {
                issues.push({
                    playerId: player.id,
                    playerName: player.username,
                    issue: 'User global state does not match room',
                    userCurrentRoom,
                    expectedRoom: roomId
                });
            }
        }
        // 检查是否有用户引用了这个房间但不在玩家列表中
        const userRoomKeys = yield db_1.redisClient.keys('user_room:*');
        for (const key of userRoomKeys) {
            const userId = key.replace('user_room:', '');
            const userRoomId = yield db_1.redisClient.get(key);
            if (userRoomId === roomId) {
                const playerInRoom = players.find((p) => p.id === userId);
                if (!playerInRoom) {
                    issues.push({
                        playerId: userId,
                        issue: 'User references room but not in player list',
                        userCurrentRoom: userRoomId,
                        expectedRoom: roomId
                    });
                }
            }
        }
        res.json({
            roomId,
            roomState,
            consistencyCheck: {
                consistent: issues.length === 0,
                issues,
                playersCount: players.length,
                checkedUsers: players.length + userRoomKeys.length
            }
        });
    }
    catch (error) {
        console.error('Error checking room consistency:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 获取系统统计信息
router.get('/stats', auth_1.authenticateToken, requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 获取用户状态统计
        const userRoomKeys = yield db_1.redisClient.keys('user_room:*');
        const roomKeys = yield db_1.redisClient.keys('room:*');
        // 获取数据库统计
        const dbStats = yield prisma_1.default.$transaction([
            prisma_1.default.room.count(),
            prisma_1.default.room.count({ where: { status: 'WAITING' } }),
            prisma_1.default.room.count({ where: { status: 'PLAYING' } }),
            prisma_1.default.user.count(),
        ]);
        res.json({
            redis: {
                userStates: userRoomKeys.length,
                rooms: roomKeys.length
            },
            database: {
                totalRooms: dbStats[0],
                waitingRooms: dbStats[1],
                playingRooms: dbStats[2],
                totalUsers: dbStats[3]
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
exports.default = router;
