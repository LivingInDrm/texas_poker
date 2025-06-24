import { Server as SocketIOServer } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  SOCKET_EVENTS
} from '../types/socket';

/**
 * 房间清理辅助工具
 * 处理房间清理时的Socket.IO广播通知
 */
export class RoomCleanupHelper {
  private static instance: RoomCleanupHelper;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

  private constructor() {}

  public static getInstance(): RoomCleanupHelper {
    if (!RoomCleanupHelper.instance) {
      RoomCleanupHelper.instance = new RoomCleanupHelper();
    }
    return RoomCleanupHelper.instance;
  }

  /**
   * 设置Socket.IO实例
   */
  setSocketIOInstance(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): void {
    this.io = io;
  }

  /**
   * 广播房间清理警告
   * 在房间即将被清理前通知房间内的用户
   */
  broadcastRoomCleanupWarning(roomId: string, timeLeftMs: number): void {
    if (!this.io) {
      console.warn('Socket.IO instance not set, cannot broadcast cleanup warning');
      return;
    }

    try {
      this.io.to(roomId).emit(SOCKET_EVENTS.ROOM_CLEANUP_WARNING, {
        roomId,
        timeLeft: timeLeftMs
      });

      console.log(`Broadcast cleanup warning for room ${roomId}, time left: ${timeLeftMs}ms`);
    } catch (error) {
      console.error(`Error broadcasting cleanup warning for room ${roomId}:`, error);
    }
  }

  /**
   * 广播房间已被销毁的通知
   */
  broadcastRoomDestroyed(roomId: string, reason: string = 'No users online for 30 seconds'): void {
    if (!this.io) {
      console.warn('Socket.IO instance not set, cannot broadcast room destroyed');
      return;
    }

    try {
      this.io.to(roomId).emit(SOCKET_EVENTS.ROOM_DESTROYED, {
        roomId,
        reason
      });

      console.log(`Broadcast room destroyed for room ${roomId}, reason: ${reason}`);
    } catch (error) {
      console.error(`Error broadcasting room destroyed for room ${roomId}:`, error);
    }
  }

  /**
   * 获取房间内的Socket连接数量
   */
  getRoomSocketCount(roomId: string): number {
    if (!this.io) {
      return 0;
    }

    try {
      const room = this.io.sockets.adapter.rooms.get(roomId);
      return room ? room.size : 0;
    } catch (error) {
      console.error(`Error getting socket count for room ${roomId}:`, error);
      return 0;
    }
  }

  /**
   * 获取房间内所有Socket的用户ID
   */
  getRoomSocketUserIds(roomId: string): string[] {
    if (!this.io) {
      return [];
    }

    try {
      const userIds: string[] = [];
      const room = this.io.sockets.adapter.rooms.get(roomId);
      
      if (room) {
        room.forEach(socketId => {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket && socket.data?.userId) {
            userIds.push(socket.data.userId);
          }
        });
      }

      return userIds;
    } catch (error) {
      console.error(`Error getting socket user IDs for room ${roomId}:`, error);
      return [];
    }
  }

  /**
   * 断开房间内所有用户的连接（优雅关闭）
   */
  disconnectRoomSockets(roomId: string, reason: string = 'Room destroyed'): void {
    if (!this.io) {
      return;
    }

    try {
      const room = this.io.sockets.adapter.rooms.get(roomId);
      
      if (room) {
        room.forEach(socketId => {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            // 发送断连原因
            socket.emit(SOCKET_EVENTS.ERROR, {
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
        });
      }

      console.log(`Disconnected all sockets from room ${roomId}`);
    } catch (error) {
      console.error(`Error disconnecting sockets from room ${roomId}:`, error);
    }
  }

  /**
   * 检查Socket.IO实例是否已设置
   */
  isReady(): boolean {
    return this.io !== null;
  }
}

// 导出单例实例
export const roomCleanupHelper = RoomCleanupHelper.getInstance();