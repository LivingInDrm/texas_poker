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
exports.setupRoomHandlers = setupRoomHandlers;
const bcrypt_1 = __importDefault(require("bcrypt"));
const socket_1 = require("../../types/socket");
const db_1 = require("../../db");
const prisma_1 = __importDefault(require("../../prisma"));
const validation_1 = require("../middleware/validation");
function setupRoomHandlers(socket, io) {
    // 加入房间
    socket.on(socket_1.SOCKET_EVENTS.ROOM_JOIN, (data, callback) => __awaiter(this, void 0, void 0, function* () {
        const { roomId, password } = data;
        const { userId, username } = socket.data;
        try {
            // 验证房间加入请求
            const validationResult = yield validation_1.validationMiddleware.validateRoomJoin(socket, roomId, password);
            if (!validationResult.valid) {
                return callback({
                    success: false,
                    error: validationResult.error || 'Invalid join request',
                    message: validationResult.error || 'Validation failed'
                });
            }
            // 检查房间是否存在
            const room = yield prisma_1.default.room.findUnique({
                where: { id: roomId },
                include: { owner: true }
            });
            if (!room) {
                return callback({
                    success: false,
                    error: 'Room not found',
                    message: socket_1.SOCKET_ERRORS.ROOM_NOT_FOUND
                });
            }
            // 验证密码（如果有）
            if (room.password) {
                if (!password) {
                    return callback({
                        success: false,
                        error: 'Password required',
                        message: 'This room requires a password'
                    });
                }
                const passwordMatch = yield bcrypt_1.default.compare(password, room.password);
                if (!passwordMatch) {
                    return callback({
                        success: false,
                        error: 'Invalid password',
                        message: socket_1.SOCKET_ERRORS.INVALID_PASSWORD
                    });
                }
            }
            // 获取当前房间状态
            let roomState;
            const existingRoomData = yield db_1.redisClient.get(`room:${roomId}`);
            if (existingRoomData) {
                roomState = JSON.parse(existingRoomData);
            }
            else {
                // 初始化房间状态
                roomState = {
                    id: roomId,
                    ownerId: room.ownerId,
                    players: [],
                    status: 'WAITING',
                    maxPlayers: room.playerLimit,
                    currentPlayerCount: 0,
                    hasPassword: !!room.password,
                    bigBlind: room.bigBlind,
                    smallBlind: room.smallBlind,
                    gameStarted: false
                };
            }
            // 检查玩家是否已在房间中
            const existingPlayerIndex = roomState.players.findIndex(p => p.id === userId);
            if (existingPlayerIndex !== -1) {
                // 玩家重新连接
                roomState.players[existingPlayerIndex].isConnected = true;
                yield socket.join(roomId);
                socket.data.roomId = roomId;
                // 保存房间状态
                yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
                // 发送成功响应
                callback({
                    success: true,
                    message: 'Reconnected to room successfully',
                    data: { roomState }
                });
                // 通知其他玩家
                socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_PLAYER_JOINED, {
                    player: roomState.players[existingPlayerIndex]
                });
                socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState });
                console.log(`Player ${username} reconnected to room ${roomId}`);
                return;
            }
            // 检查房间是否已满
            if (roomState.players.length >= roomState.maxPlayers) {
                return callback({
                    success: false,
                    error: 'Room is full',
                    message: socket_1.SOCKET_ERRORS.ROOM_FULL
                });
            }
            // 获取用户信息
            const user = yield prisma_1.default.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                return callback({
                    success: false,
                    error: 'User not found',
                    message: 'Invalid user'
                });
            }
            // 创建新玩家
            const newPlayer = {
                id: userId,
                username: user.username,
                avatar: user.avatar || undefined,
                chips: user.chips,
                isReady: false,
                position: roomState.players.length,
                isConnected: true
            };
            // 加入房间
            yield socket.join(roomId);
            socket.data.roomId = roomId;
            // 更新房间状态
            roomState.players.push(newPlayer);
            roomState.currentPlayerCount = roomState.players.length;
            // 保存房间状态
            yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
            // 发送成功响应
            callback({
                success: true,
                message: 'Joined room successfully',
                data: { roomState }
            });
            // 通知房间内其他玩家
            socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_PLAYER_JOINED, {
                player: newPlayer
            });
            // 广播房间状态更新
            io.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState });
            console.log(`Player ${username} joined room ${roomId}`);
        }
        catch (error) {
            console.error('Error joining room:', error);
            callback({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }
    }));
    // 离开房间
    socket.on(socket_1.SOCKET_EVENTS.ROOM_LEAVE, (data, callback) => __awaiter(this, void 0, void 0, function* () {
        const { roomId } = data;
        const { userId, username } = socket.data;
        try {
            // 获取房间状态
            const roomData = yield db_1.redisClient.get(`room:${roomId}`);
            if (!roomData) {
                return callback({
                    success: false,
                    error: 'Room not found',
                    message: socket_1.SOCKET_ERRORS.ROOM_NOT_FOUND
                });
            }
            const roomState = JSON.parse(roomData);
            // 查找玩家
            const playerIndex = roomState.players.findIndex(p => p.id === userId);
            if (playerIndex === -1) {
                return callback({
                    success: false,
                    error: 'Player not in room',
                    message: socket_1.SOCKET_ERRORS.PLAYER_NOT_IN_ROOM
                });
            }
            // 离开socket房间
            yield socket.leave(roomId);
            socket.data.roomId = undefined;
            // 移除玩家
            const removedPlayer = roomState.players[playerIndex];
            roomState.players.splice(playerIndex, 1);
            roomState.currentPlayerCount = roomState.players.length;
            // 重新分配位置
            roomState.players.forEach((player, index) => {
                player.position = index;
            });
            // 如果房间为空，删除房间状态
            if (roomState.players.length === 0) {
                yield db_1.redisClient.del(`room:${roomId}`);
                // 如果房间在数据库中且没有正在进行的游戏，可以考虑删除
                const room = yield prisma_1.default.room.findUnique({ where: { id: roomId } });
                if (room && room.status === 'WAITING') {
                    yield prisma_1.default.room.delete({ where: { id: roomId } });
                }
            }
            else {
                // 如果离开的是房主，转移房主权限给第一个玩家
                if (roomState.ownerId === userId && roomState.players.length > 0) {
                    roomState.ownerId = roomState.players[0].id;
                    // 更新数据库中的房主
                    yield prisma_1.default.room.update({
                        where: { id: roomId },
                        data: { ownerId: roomState.ownerId }
                    });
                }
                // 保存房间状态
                yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
            }
            // 发送成功响应
            callback({
                success: true,
                message: 'Left room successfully'
            });
            // 通知房间内其他玩家
            socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_PLAYER_LEFT, {
                playerId: userId
            });
            if (roomState.players.length > 0) {
                socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState });
            }
            console.log(`Player ${username} left room ${roomId}`);
        }
        catch (error) {
            console.error('Error leaving room:', error);
            callback({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }
    }));
    // 快速开始
    socket.on(socket_1.SOCKET_EVENTS.ROOM_QUICK_START, (callback) => __awaiter(this, void 0, void 0, function* () {
        const { userId, username } = socket.data;
        try {
            // 查找可用的房间
            const availableRooms = yield prisma_1.default.room.findMany({
                where: {
                    status: 'WAITING',
                    password: null // 只查找没有密码的房间
                },
                include: { owner: true }
            });
            let targetRoom = null;
            let roomState = null;
            // 查找有空位的房间
            for (const room of availableRooms) {
                const roomData = yield db_1.redisClient.get(`room:${room.id}`);
                if (roomData) {
                    const state = JSON.parse(roomData);
                    if (state.players.length < state.maxPlayers) {
                        targetRoom = room;
                        roomState = state;
                        break;
                    }
                }
            }
            // 如果没有找到合适的房间，创建新房间
            if (!targetRoom) {
                const newRoom = yield prisma_1.default.room.create({
                    data: {
                        ownerId: userId,
                        playerLimit: 6,
                        status: 'WAITING',
                        bigBlind: 20,
                        smallBlind: 10
                    }
                });
                const user = yield prisma_1.default.user.findUnique({
                    where: { id: userId }
                });
                if (!user) {
                    return callback({
                        success: false,
                        error: 'User not found',
                        message: 'Invalid user'
                    });
                }
                // 初始化新房间状态
                roomState = {
                    id: newRoom.id,
                    ownerId: userId,
                    players: [{
                            id: userId,
                            username: user.username,
                            avatar: user.avatar || undefined,
                            chips: user.chips,
                            isReady: false,
                            position: 0,
                            isConnected: true
                        }],
                    status: 'WAITING',
                    maxPlayers: 6,
                    currentPlayerCount: 1,
                    hasPassword: false,
                    bigBlind: 20,
                    smallBlind: 10,
                    gameStarted: false
                };
                targetRoom = newRoom;
            }
            else {
                // 加入现有房间
                const user = yield prisma_1.default.user.findUnique({
                    where: { id: userId }
                });
                if (!user) {
                    return callback({
                        success: false,
                        error: 'User not found',
                        message: 'Invalid user'
                    });
                }
                const newPlayer = {
                    id: userId,
                    username: user.username,
                    avatar: user.avatar || undefined,
                    chips: user.chips,
                    isReady: false,
                    position: roomState.players.length,
                    isConnected: true
                };
                roomState.players.push(newPlayer);
                roomState.currentPlayerCount = roomState.players.length;
            }
            // 加入socket房间
            yield socket.join(targetRoom.id);
            socket.data.roomId = targetRoom.id;
            // 保存房间状态
            yield db_1.redisClient.setEx(`room:${targetRoom.id}`, 3600, JSON.stringify(roomState));
            // 发送成功响应
            callback({
                success: true,
                message: 'Quick start successful',
                data: { roomState, roomId: targetRoom.id }
            });
            // 如果是加入现有房间，通知其他玩家
            if (roomState.players.length > 1) {
                socket.to(targetRoom.id).emit(socket_1.SOCKET_EVENTS.ROOM_PLAYER_JOINED, {
                    player: roomState.players[roomState.players.length - 1]
                });
                socket.to(targetRoom.id).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState: roomState });
            }
            console.log(`Player ${username} quick started into room ${targetRoom.id}`);
        }
        catch (error) {
            console.error('Error in quick start:', error);
            callback({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }
    }));
}
