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
exports.createSocketServer = createSocketServer;
exports.getRoomSocketCount = getRoomSocketCount;
exports.getUserSocket = getUserSocket;
exports.broadcastToRoom = broadcastToRoom;
exports.sendToUser = sendToUser;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socket_1 = require("../types/socket");
const roomHandlers_1 = require("./handlers/roomHandlers");
const gameHandlers_1 = require("./handlers/gameHandlers");
const systemHandlers_1 = require("./handlers/systemHandlers");
const prisma_1 = __importDefault(require("../prisma"));
// 创建Socket.IO服务器
function createSocketServer(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });
    // JWT认证中间件
    io.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const token = socket.handshake.auth.token || ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
            if (!token) {
                return next(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
            }
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            // 验证用户是否存在
            const user = yield prisma_1.default.user.findUnique({
                where: { id: decoded.userId }
            });
            if (!user) {
                return next(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
            }
            // 设置socket数据
            socket.data.userId = user.id;
            socket.data.username = user.username;
            socket.data.authenticated = true;
            console.log(`User ${user.username} (${user.id}) authenticated for socket connection`);
            next();
        }
        catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error(socket_1.SOCKET_ERRORS.AUTHENTICATION_FAILED));
        }
    }));
    // 连接处理
    io.on(socket_1.SOCKET_EVENTS.CONNECTION, (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.data.username})`);
        // 发送连接确认
        socket.emit(socket_1.SOCKET_EVENTS.CONNECTED, {
            message: `Welcome ${socket.data.username}! You are connected to Texas Poker.`
        });
        // 设置各类事件处理器
        (0, systemHandlers_1.setupSystemHandlers)(socket, io);
        (0, roomHandlers_1.setupRoomHandlers)(socket, io);
        (0, gameHandlers_1.setupGameHandlers)(socket, io);
        // 断开连接处理
        socket.on(socket_1.SOCKET_EVENTS.DISCONNECT, (reason) => __awaiter(this, void 0, void 0, function* () {
            console.log(`Socket disconnected: ${socket.id} (User: ${socket.data.username}, Reason: ${reason})`);
            // 如果用户在房间中，处理离开房间逻辑
            if (socket.data.roomId) {
                try {
                    yield handlePlayerDisconnect(socket, io);
                }
                catch (error) {
                    console.error('Error handling player disconnect:', error);
                }
            }
        }));
        // 错误处理
        socket.on('error', (error) => {
            console.error(`Socket error for ${socket.data.username}:`, error);
            socket.emit(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'An error occurred',
                code: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        });
    });
    // 全局错误处理
    io.engine.on('connection_error', (err) => {
        console.error('Socket.IO connection error:', err);
    });
    return io;
}
// 处理玩家断开连接
function handlePlayerDisconnect(socket, io) {
    return __awaiter(this, void 0, void 0, function* () {
        const { roomId, userId } = socket.data;
        if (!roomId)
            return;
        try {
            // 从Redis获取房间状态
            const { redisClient } = require('../db');
            const roomData = yield redisClient.get(`room:${roomId}`);
            if (roomData) {
                const roomState = JSON.parse(roomData);
                // 标记玩家为断开连接状态
                const playerIndex = roomState.players.findIndex((p) => p.id === userId);
                if (playerIndex !== -1) {
                    roomState.players[playerIndex].isConnected = false;
                    // 保存更新的房间状态
                    yield redisClient.set(`room:${roomId}`, JSON.stringify(roomState), 'EX', 3600);
                    // 通知房间内其他玩家
                    socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, {
                        roomState
                    });
                    console.log(`Player ${socket.data.username} disconnected from room ${roomId}`);
                }
            }
        }
        catch (error) {
            console.error('Error handling player disconnect:', error);
        }
    });
}
// 获取房间内的socket数量
function getRoomSocketCount(io, roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    return room ? room.size : 0;
}
// 获取用户的socket实例
function getUserSocket(io, userId) {
    var _a;
    for (const [socketId, socket] of io.sockets.sockets) {
        if (((_a = socket.data) === null || _a === void 0 ? void 0 : _a.userId) === userId) {
            return socket;
        }
    }
    return null;
}
// 向房间内所有玩家广播消息
function broadcastToRoom(io, roomId, event, data) {
    io.to(roomId).emit(event, data);
}
// 向特定用户发送消息
function sendToUser(io, userId, event, data) {
    const socket = getUserSocket(io, userId);
    if (socket) {
        socket.emit(event, data);
        return true;
    }
    return false;
}
