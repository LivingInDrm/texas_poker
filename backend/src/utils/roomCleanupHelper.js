"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomCleanupHelper = exports.RoomCleanupHelper = void 0;
const socket_1 = require("../types/socket");
/**
 * 房间清理辅助工具
 * 处理房间清理时的Socket.IO广播通知
 */
class RoomCleanupHelper {
    constructor() {
        this.io = null;
    }
    static getInstance() {
        if (!RoomCleanupHelper.instance) {
            RoomCleanupHelper.instance = new RoomCleanupHelper();
        }
        return RoomCleanupHelper.instance;
    }
    /**
     * 设置Socket.IO实例
     */
    setSocketIOInstance(io) {
        this.io = io;
    }
    /**
     * 广播房间清理警告
     * 在房间即将被清理前通知房间内的用户
     */
    broadcastRoomCleanupWarning(roomId, timeLeftMs) {
        if (!this.io) {
            console.warn('Socket.IO instance not set, cannot broadcast cleanup warning');
            return;
        }
        try {
            this.io.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_CLEANUP_WARNING, {
                roomId,
                timeLeft: timeLeftMs
            });
            console.log(`Broadcast cleanup warning for room ${roomId}, time left: ${timeLeftMs}ms`);
        }
        catch (error) {
            console.error(`Error broadcasting cleanup warning for room ${roomId}:`, error);
        }
    }
    /**
     * 广播房间已被销毁的通知
     */
    broadcastRoomDestroyed(roomId, reason = 'No users online for 30 seconds') {
        if (!this.io) {
            console.warn('Socket.IO instance not set, cannot broadcast room destroyed');
            return;
        }
        try {
            this.io.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_DESTROYED, {
                roomId,
                reason
            });
            console.log(`Broadcast room destroyed for room ${roomId}, reason: ${reason}`);
        }
        catch (error) {
            console.error(`Error broadcasting room destroyed for room ${roomId}:`, error);
        }
    }
    /**
     * 获取房间内的Socket连接数量
     */
    getRoomSocketCount(roomId) {
        if (!this.io) {
            return 0;
        }
        try {
            const room = this.io.sockets.adapter.rooms.get(roomId);
            return room ? room.size : 0;
        }
        catch (error) {
            console.error(`Error getting socket count for room ${roomId}:`, error);
            return 0;
        }
    }
    /**
     * 获取房间内所有Socket的用户ID
     */
    getRoomSocketUserIds(roomId) {
        var _a;
        if (!this.io) {
            return [];
        }
        try {
            const userIds = [];
            const room = this.io.sockets.adapter.rooms.get(roomId);
            if (room) {
                for (const socketId of room) {
                    const socket = this.io.sockets.sockets.get(socketId);
                    if (socket && ((_a = socket.data) === null || _a === void 0 ? void 0 : _a.userId)) {
                        userIds.push(socket.data.userId);
                    }
                }
            }
            return userIds;
        }
        catch (error) {
            console.error(`Error getting socket user IDs for room ${roomId}:`, error);
            return [];
        }
    }
    /**
     * 断开房间内所有用户的连接（优雅关闭）
     */
    disconnectRoomSockets(roomId, reason = 'Room destroyed') {
        if (!this.io) {
            return;
        }
        try {
            const room = this.io.sockets.adapter.rooms.get(roomId);
            if (room) {
                for (const socketId of room) {
                    const socket = this.io.sockets.sockets.get(socketId);
                    if (socket) {
                        // 发送断连原因
                        socket.emit(socket_1.SOCKET_EVENTS.ERROR, {
                            message: `Disconnected: ${reason}`,
                            code: 'ROOM_DESTROYED'
                        });
                        // 让socket离开房间
                        socket.leave(roomId);
                        // 清理socket上的房间信息
                        if (socket.data) {
                            socket.data.roomId = undefined;
                        }
                    }
                }
            }
            console.log(`Disconnected all sockets from room ${roomId}`);
        }
        catch (error) {
            console.error(`Error disconnecting sockets from room ${roomId}:`, error);
        }
    }
    /**
     * 检查Socket.IO实例是否已设置
     */
    isReady() {
        return this.io !== null;
    }
}
exports.RoomCleanupHelper = RoomCleanupHelper;
// 导出单例实例
exports.roomCleanupHelper = RoomCleanupHelper.getInstance();
