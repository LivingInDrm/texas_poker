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
exports.userStateService = exports.UserStateService = void 0;
const db_1 = require("../db");
const socket_1 = require("../types/socket");
/**
 * 用户状态管理服务
 * 负责管理用户在房间中的状态，防止用户同时存在于多个房间
 */
class UserStateService {
    constructor() { }
    static getInstance() {
        if (!UserStateService.instance) {
            UserStateService.instance = new UserStateService();
        }
        return UserStateService.instance;
    }
    /**
     * 获取用户当前所在的房间ID
     */
    getUserCurrentRoom(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const roomId = yield db_1.redisClient.get(`user_room:${userId}`);
                return roomId;
            }
            catch (error) {
                console.error('Error getting user current room:', error);
                return null;
            }
        });
    }
    /**
     * 设置用户当前所在的房间
     */
    setUserCurrentRoom(userId, roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield db_1.redisClient.setEx(`user_room:${userId}`, 3600, roomId); // 1小时过期
                return true;
            }
            catch (error) {
                console.error('Error setting user current room:', error);
                return false;
            }
        });
    }
    /**
     * 清除用户当前房间状态
     */
    clearUserCurrentRoom(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield db_1.redisClient.del(`user_room:${userId}`);
                return true;
            }
            catch (error) {
                console.error('Error clearing user current room:', error);
                return false;
            }
        });
    }
    /**
     * 强制用户离开当前房间
     */
    forceLeaveCurrentRoom(userId_1, socket_2, io_1) {
        return __awaiter(this, arguments, void 0, function* (userId, socket, io, reason = 'Joining another room') {
            try {
                const currentRoomId = yield this.getUserCurrentRoom(userId);
                if (!currentRoomId) {
                    return { success: true }; // 用户不在任何房间中
                }
                // 获取当前房间状态
                const roomData = yield db_1.redisClient.get(`room:${currentRoomId}`);
                if (!roomData) {
                    // 房间不存在，清理用户状态
                    yield this.clearUserCurrentRoom(userId);
                    return { success: true, previousRoomId: currentRoomId };
                }
                const roomState = JSON.parse(roomData);
                // 查找用户在房间中的位置
                const playerIndex = roomState.players.findIndex(p => p.id === userId);
                if (playerIndex === -1) {
                    // 用户不在房间玩家列表中，清理状态
                    yield this.clearUserCurrentRoom(userId);
                    return { success: true, previousRoomId: currentRoomId };
                }
                // 从房间中移除用户
                const removedPlayer = roomState.players[playerIndex];
                roomState.players.splice(playerIndex, 1);
                roomState.currentPlayerCount = roomState.players.length;
                // 重新分配位置
                roomState.players.forEach((player, index) => {
                    player.position = index;
                });
                // 如果房间为空，删除房间状态
                if (roomState.players.length === 0) {
                    yield db_1.redisClient.del(`room:${currentRoomId}`);
                    // 如果房间在数据库中且没有正在进行的游戏，可以考虑删除
                    const prisma = require('../prisma').default;
                    const room = yield prisma.room.findUnique({ where: { id: currentRoomId } });
                    if (room && room.status === 'WAITING') {
                        yield prisma.room.delete({ where: { id: currentRoomId } });
                    }
                }
                else {
                    // 如果离开的是房主，转移房主权限给第一个玩家
                    if (roomState.ownerId === userId && roomState.players.length > 0) {
                        roomState.ownerId = roomState.players[0].id;
                        // 更新数据库中的房主
                        const prisma = require('../prisma').default;
                        yield prisma.room.update({
                            where: { id: currentRoomId },
                            data: { ownerId: roomState.ownerId }
                        });
                    }
                    // 保存房间状态
                    yield db_1.redisClient.setEx(`room:${currentRoomId}`, 3600, JSON.stringify(roomState));
                }
                // 清除用户当前房间状态
                yield this.clearUserCurrentRoom(userId);
                // 清除socket中的房间信息
                if (socket.data.roomId === currentRoomId) {
                    socket.data.roomId = undefined;
                    yield socket.leave(currentRoomId);
                }
                // 通知房间内其他玩家用户离开
                socket.to(currentRoomId).emit(socket_1.SOCKET_EVENTS.ROOM_PLAYER_LEFT, {
                    playerId: userId
                });
                if (roomState.players.length > 0) {
                    socket.to(currentRoomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState });
                }
                // 通知被强制离开的用户
                socket.emit(socket_1.SOCKET_EVENTS.ERROR, {
                    message: `You have been removed from room ${currentRoomId}. Reason: ${reason}`,
                    code: 'FORCED_ROOM_LEAVE'
                });
                console.log(`User ${userId} was forced to leave room ${currentRoomId}. Reason: ${reason}`);
                return { success: true, previousRoomId: currentRoomId };
            }
            catch (error) {
                console.error('Error forcing user to leave current room:', error);
                return {
                    success: false,
                    error: 'Failed to force leave current room'
                };
            }
        });
    }
    /**
     * 检查用户是否可以加入指定房间
     * 如果用户已在其他房间，将强制离开
     */
    checkAndHandleRoomConflict(userId, targetRoomId, socket, io) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const currentRoomId = yield this.getUserCurrentRoom(userId);
                // 如果用户不在任何房间中，或者就在目标房间中，直接允许
                if (!currentRoomId || currentRoomId === targetRoomId) {
                    return { canJoin: true };
                }
                // 强制离开当前房间
                const leaveResult = yield this.forceLeaveCurrentRoom(userId, socket, io, `Joining room ${targetRoomId}`);
                if (!leaveResult.success) {
                    return {
                        canJoin: false,
                        error: leaveResult.error || 'Failed to leave current room'
                    };
                }
                return {
                    canJoin: true,
                    previousRoomId: leaveResult.previousRoomId
                };
            }
            catch (error) {
                console.error('Error checking room conflict:', error);
                return {
                    canJoin: false,
                    error: 'Failed to check room conflict'
                };
            }
        });
    }
    /**
     * 验证房间状态一致性
     * 确保用户的全局状态与房间中的状态一致
     */
    validateRoomStateConsistency(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const issues = [];
            const fixedIssues = [];
            try {
                const userRoomId = yield this.getUserCurrentRoom(userId);
                if (!userRoomId) {
                    return { consistent: true, issues, fixedIssues };
                }
                // 检查房间是否存在
                const roomData = yield db_1.redisClient.get(`room:${userRoomId}`);
                if (!roomData) {
                    issues.push(`User ${userId} references non-existent room ${userRoomId}`);
                    yield this.clearUserCurrentRoom(userId);
                    fixedIssues.push(`Cleared invalid room reference for user ${userId}`);
                    return { consistent: false, issues, fixedIssues };
                }
                const roomState = JSON.parse(roomData);
                const playerInRoom = roomState.players.find(p => p.id === userId);
                if (!playerInRoom) {
                    issues.push(`User ${userId} not found in room ${userRoomId} player list`);
                    yield this.clearUserCurrentRoom(userId);
                    fixedIssues.push(`Cleared room reference for user ${userId} not in room`);
                    return { consistent: false, issues, fixedIssues };
                }
                return { consistent: true, issues, fixedIssues };
            }
            catch (error) {
                console.error('Error validating room state consistency:', error);
                issues.push(`Error validating consistency for user ${userId}: ${error}`);
                return { consistent: false, issues, fixedIssues };
            }
        });
    }
    /**
     * 获取房间中的所有在线用户
     */
    getRoomOnlineUsers(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const roomData = yield db_1.redisClient.get(`room:${roomId}`);
                if (!roomData) {
                    return [];
                }
                const roomState = JSON.parse(roomData);
                return roomState.players
                    .filter(p => p.isConnected)
                    .map(p => p.id);
            }
            catch (error) {
                console.error('Error getting room online users:', error);
                return [];
            }
        });
    }
    /**
     * 清理孤立的用户状态
     * 定期清理那些引用了不存在房间的用户状态
     */
    cleanupOrphanedUserStates() {
        return __awaiter(this, void 0, void 0, function* () {
            const errors = [];
            let cleaned = 0;
            try {
                // 获取所有用户房间状态键
                const userRoomKeys = yield db_1.redisClient.keys('user_room:*');
                for (const key of userRoomKeys) {
                    try {
                        const roomId = yield db_1.redisClient.get(key);
                        if (!roomId)
                            continue;
                        // 检查房间是否存在
                        const roomExists = yield db_1.redisClient.exists(`room:${roomId}`);
                        if (!roomExists) {
                            yield db_1.redisClient.del(key);
                            cleaned++;
                            console.log(`Cleaned orphaned user state: ${key} -> ${roomId}`);
                        }
                    }
                    catch (error) {
                        errors.push(`Error processing ${key}: ${error}`);
                    }
                }
            }
            catch (error) {
                errors.push(`Error during cleanup: ${error}`);
            }
            return { cleaned, errors };
        });
    }
}
exports.UserStateService = UserStateService;
// 导出单例实例
exports.userStateService = UserStateService.getInstance();
// 定期清理孤立状态（每5分钟执行一次）
setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield exports.userStateService.cleanupOrphanedUserStates();
        if (result.cleaned > 0 || result.errors.length > 0) {
            console.log('User state cleanup completed:', result);
        }
    }
    catch (error) {
        console.error('Error during scheduled user state cleanup:', error);
    }
}), 5 * 60 * 1000);
