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
const prisma_1 = __importDefault(require("../prisma"));
const router = express_1.default.Router();
// 获取当前用户信息
router.get('/me', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const user = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                avatar: true,
                chips: true,
                gamesPlayed: true,
                winRate: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: 'User information retrieved successfully',
            user
        });
    }
    catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 更新用户信息
router.put('/me', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const updateData = req.body;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // 首先检查用户是否存在
        const existingUser = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true }
        });
        if (!existingUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // 验证允许更新的字段
        const allowedFields = ['avatar'];
        const filteredUpdateData = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                // 输入验证和清理
                if (field === 'avatar' && updateData[field]) {
                    // 清理XSS攻击
                    filteredUpdateData[field] = updateData[field]
                        .replace(/<script[^>]*>.*?<\/script>/gi, '')
                        .replace(/<[^>]*>/g, '');
                    // 验证avatar URL长度限制
                    if (filteredUpdateData[field].length > 500) {
                        return res.status(400).json({
                            error: 'Avatar URL too long (max 500 characters)'
                        });
                    }
                }
                else {
                    filteredUpdateData[field] = updateData[field];
                }
            }
        }
        // 检查是否有无效字段
        const invalidFields = Object.keys(updateData).filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            return res.status(400).json({
                error: `Invalid field(s): ${invalidFields.join(', ')}`
            });
        }
        // 更新用户信息
        const updatedUser = yield prisma_1.default.user.update({
            where: { id: userId },
            data: filteredUpdateData,
            select: {
                id: true,
                username: true,
                avatar: true,
                chips: true,
                gamesPlayed: true,
                winRate: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json({
            message: 'User information updated successfully',
            user: updatedUser
        });
    }
    catch (error) {
        console.error('Update user error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 获取用户公开资料
router.get('/profile/:userId', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        // 验证userId格式
        if (!userId || userId.length < 5 || userId === 'invalid-id-format') {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        const user = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                avatar: true,
                createdAt: true,
                chips: true,
                gamesPlayed: true,
                winRate: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: 'User profile retrieved successfully',
            user
        });
    }
    catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 获取排行榜
router.get('/leaderboard', auth_1.authenticateToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const minGames = parseInt(req.query.minGames) || 0;
        const offset = (page - 1) * limit;
        const users = yield prisma_1.default.user.findMany({
            where: minGames > 0 ? {
                gamesPlayed: { gte: minGames }
            } : {},
            select: {
                id: true,
                username: true,
                avatar: true,
                chips: true,
                gamesPlayed: true,
                winRate: true
            },
            take: limit,
            skip: offset,
            orderBy: [
                { winRate: 'desc' },
                { chips: 'desc' }
            ]
        });
        // 格式化排行榜数据
        const leaderboard = users.map(user => ({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            chips: user.chips,
            winRate: Number(user.winRate.toFixed(3)),
            gamesPlayed: user.gamesPlayed
        }));
        res.json({
            message: 'Leaderboard retrieved successfully',
            leaderboard,
            pagination: {
                page,
                limit,
                total: leaderboard.length
            }
        });
    }
    catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
exports.default = router;
