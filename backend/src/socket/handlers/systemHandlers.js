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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSystemHandlers = setupSystemHandlers;
const socket_1 = require("../../types/socket");
const validation_1 = require("../middleware/validation");
const userStateService_1 = require("../../services/userStateService");
function setupSystemHandlers(socket, io) {
    // 添加通用消息速率验证
    const originalEmit = socket.emit;
    socket.emit = function (...args) {
        if (!validation_1.validationMiddleware.validateMessageRate(socket.data.userId)) {
            console.warn(`Rate limit exceeded for user ${socket.data.username}`);
            return false;
        }
        return originalEmit.apply(this, args);
    };
    // Ping处理
    socket.on(socket_1.SOCKET_EVENTS.PING, (callback) => {
        const startTime = Date.now();
        callback(startTime);
    });
    // 重连尝试处理
    socket.on(socket_1.SOCKET_EVENTS.RECONNECT_ATTEMPT, (data) => __awaiter(this, void 0, void 0, function* () {
        const { roomId } = data;
        const { userId, username } = socket.data;
        console.log(`Reconnect attempt from ${username} for room ${roomId || 'none'}`);
        try {
            if (roomId) {
                // 检查用户是否仍在房间中
                const { redisClient } = require('../../db');
                const roomData = yield redisClient.get(`room:${roomId}`);
                if (roomData) {
                    const roomState = JSON.parse(roomData);
                    const player = roomState.players.find((p) => p.id === userId);
                    if (player) {
                        // 重新加入房间
                        yield socket.join(roomId);
                        socket.data.roomId = roomId;
                        // 更新全局用户状态
                        yield userStateService_1.userStateService.setUserCurrentRoom(userId, roomId);
                        // 标记为已连接
                        player.isConnected = true;
                        yield redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
                        // 发送重连成功消息
                        socket.emit(socket_1.SOCKET_EVENTS.RECONNECTED, {
                            roomId,
                            gameState: roomState.gameState
                        });
                        // 通知房间内其他玩家
                        socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_PLAYER_JOINED, {
                            player: {
                                id: player.id,
                                username: player.username,
                                avatar: player.avatar,
                                chips: player.chips,
                                isReady: player.isReady,
                                position: player.position,
                                isConnected: true,
                                lastAction: player.lastAction
                            }
                        });
                        // 发送房间状态更新
                        socket.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, {
                            roomState
                        });
                        console.log(`User ${username} successfully reconnected to room ${roomId}`);
                    }
                    else {
                        // 用户不在房间中
                        socket.emit(socket_1.SOCKET_EVENTS.ERROR, {
                            message: 'You are not a member of this room',
                            code: 'ROOM_ACCESS_DENIED'
                        });
                    }
                }
                else {
                    // 房间不存在
                    socket.emit(socket_1.SOCKET_EVENTS.ERROR, {
                        message: 'Room not found',
                        code: 'ROOM_NOT_FOUND'
                    });
                }
            }
            else {
                // 没有指定房间，发送通用重连确认
                socket.emit(socket_1.SOCKET_EVENTS.RECONNECTED, {
                    roomId: roomId
                });
            }
        }
        catch (error) {
            console.error('Error handling reconnect attempt:', error);
            socket.emit(socket_1.SOCKET_EVENTS.ERROR, {
                message: 'Reconnection failed',
                code: 'RECONNECT_FAILED'
            });
        }
    }));
    // 心跳检测
    const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
            // socket.emit('heartbeat', Date.now()); // 暂时注释掉非标准事件
        }
        else {
            clearInterval(heartbeatInterval);
        }
    }, 30000); // 每30秒发送一次心跳
    // 监听心跳响应
    // socket.on('heartbeat_response', (timestamp: number) => {
    //   const latency = Date.now() - timestamp;
    //   console.log(`Heartbeat from ${socket.data.username}: ${latency}ms`);
    // });
    // 断开连接时清理心跳
    socket.on(socket_1.SOCKET_EVENTS.DISCONNECT, () => {
        clearInterval(heartbeatInterval);
    });
}
