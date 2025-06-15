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
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// 用户注册
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, password, avatar } = req.body;
        // 验证必填字段
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        // 检查用户名是否已存在
        const existingUser = yield prisma_1.default.user.findUnique({
            where: { username }
        });
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        // 密码加密
        const saltRounds = 10;
        const passwordHash = yield bcrypt_1.default.hash(password, saltRounds);
        // 创建用户
        const user = yield prisma_1.default.user.create({
            data: {
                username,
                passwordHash,
                avatar: avatar || null
            },
            select: {
                id: true,
                username: true,
                avatar: true,
                createdAt: true
            }
        });
        // 生成 JWT token
        const token = (0, auth_1.generateToken)(user.id, user.username);
        res.status(201).json({
            message: 'User registered successfully',
            user,
            token
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// 用户登录
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, password } = req.body;
        // 验证必填字段
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        // 查找用户
        const user = yield prisma_1.default.user.findUnique({
            where: { username }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // 验证密码
        const isPasswordValid = yield bcrypt_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // 生成 JWT token
        const token = (0, auth_1.generateToken)(user.id, user.username);
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                createdAt: user.createdAt
            },
            token
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
exports.default = router;
