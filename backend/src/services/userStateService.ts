import { redisClient } from '../db';
import { RoomState, RoomPlayer, AuthenticatedSocket } from '../types/socket';
import { Server as SocketIOServer } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  SOCKET_EVENTS
} from '../types/socket';

/**
 * 用户状态管理服务
 * 负责管理用户在房间中的状态，防止用户同时存在于多个房间
 */
export class UserStateService {
  private static instance: UserStateService;
  
  private constructor() {}
  
  public static getInstance(): UserStateService {
    if (!UserStateService.instance) {
      UserStateService.instance = new UserStateService();
    }
    return UserStateService.instance;
  }

  /**
   * 获取用户当前所在的房间ID
   */
  async getUserCurrentRoom(userId: string): Promise<string | null> {
    try {
      const roomId = await redisClient.get(`user_room:${userId}`);
      return roomId ? roomId.toString() : null;
    } catch (error) {
      console.error('Error getting user current room:', error);
      return null;
    }
  }

  /**
   * 设置用户当前所在的房间
   */
  async setUserCurrentRoom(userId: string, roomId: string): Promise<boolean> {
    try {
      await redisClient.setEx(`user_room:${userId}`, 3600, roomId); // 1小时过期
      return true;
    } catch (error) {
      console.error('Error setting user current room:', error);
      return false;
    }
  }

  /**
   * 清除用户当前房间状态
   */
  async clearUserCurrentRoom(userId: string): Promise<boolean> {
    try {
      await redisClient.del(`user_room:${userId}`);
      return true;
    } catch (error) {
      console.error('Error clearing user current room:', error);
      return false;
    }
  }

  /**
   * 强制用户离开当前房间
   */
  async forceLeaveCurrentRoom(
    userId: string,
    socket: AuthenticatedSocket,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    reason: string = 'Joining another room'
  ): Promise<{ success: boolean; previousRoomId?: string; error?: string }> {
    try {
      const currentRoomId = await this.getUserCurrentRoom(userId);
      
      if (!currentRoomId) {
        return { success: true }; // 用户不在任何房间中
      }

      // 获取当前房间状态
      const roomData = await redisClient.get(`room:${currentRoomId}`);
      if (!roomData) {
        // 房间不存在，清理用户状态
        await this.clearUserCurrentRoom(userId);
        return { success: true, previousRoomId: currentRoomId };
      }

      const roomState: RoomState = JSON.parse(roomData.toString());
      
      // 查找用户在房间中的位置
      const playerIndex = roomState.players.findIndex(p => p.id === userId);
      if (playerIndex === -1) {
        // 用户不在房间玩家列表中，清理状态
        await this.clearUserCurrentRoom(userId);
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
        await redisClient.del(`room:${currentRoomId}`);
        
        // 如果房间在数据库中且没有正在进行的游戏，可以考虑删除
        const prisma = require('../prisma').default;
        const room = await prisma.room.findUnique({ where: { id: currentRoomId } });
        if (room && room.status === 'WAITING') {
          await prisma.room.delete({ where: { id: currentRoomId } });
        }
      } else {
        // 如果离开的是房主，转移房主权限给第一个玩家
        if (roomState.ownerId === userId && roomState.players.length > 0) {
          roomState.ownerId = roomState.players[0].id;
          
          // 更新数据库中的房主
          const prisma = require('../prisma').default;
          await prisma.room.update({
            where: { id: currentRoomId },
            data: { ownerId: roomState.ownerId }
          });
        }
        
        // 保存房间状态
        await redisClient.setEx(`room:${currentRoomId}`, 3600, JSON.stringify(roomState));
      }

      // 清除用户当前房间状态
      await this.clearUserCurrentRoom(userId);
      
      // 清除socket中的房间信息
      if (socket.data.roomId === currentRoomId) {
        socket.data.roomId = undefined;
        await socket.leave(currentRoomId);
      }

      // 通知房间内其他玩家用户离开
      socket.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_PLAYER_LEFT, {
        playerId: userId
      });

      if (roomState.players.length > 0) {
        socket.to(currentRoomId).emit(SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState });
      }

      // 通知被强制离开的用户
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: `You have been removed from room ${currentRoomId}. Reason: ${reason}`,
        code: 'FORCED_ROOM_LEAVE'
      });

      console.log(`User ${userId} was forced to leave room ${currentRoomId}. Reason: ${reason}`);
      
      return { success: true, previousRoomId: currentRoomId };
    } catch (error) {
      console.error('Error forcing user to leave current room:', error);
      return { 
        success: false, 
        error: 'Failed to force leave current room' 
      };
    }
  }

  /**
   * 检查用户是否可以加入指定房间
   * 如果用户已在其他房间，将强制离开
   */
  async checkAndHandleRoomConflict(
    userId: string,
    targetRoomId: string,
    socket: AuthenticatedSocket,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  ): Promise<{ canJoin: boolean; previousRoomId?: string; error?: string }> {
    try {
      const currentRoomId = await this.getUserCurrentRoom(userId);
      
      // 如果用户不在任何房间中，或者就在目标房间中，直接允许
      if (!currentRoomId || currentRoomId === targetRoomId) {
        return { canJoin: true };
      }

      // 强制离开当前房间
      const leaveResult = await this.forceLeaveCurrentRoom(
        userId,
        socket,
        io,
        `Joining room ${targetRoomId}`
      );

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
    } catch (error) {
      console.error('Error checking room conflict:', error);
      return {
        canJoin: false,
        error: 'Failed to check room conflict'
      };
    }
  }

  /**
   * 验证房间状态一致性
   * 确保用户的全局状态与房间中的状态一致
   */
  async validateRoomStateConsistency(userId: string): Promise<{
    consistent: boolean;
    issues: string[];
    fixedIssues: string[];
  }> {
    const issues: string[] = [];
    const fixedIssues: string[] = [];

    try {
      const userRoomId = await this.getUserCurrentRoom(userId);
      
      if (!userRoomId) {
        return { consistent: true, issues, fixedIssues };
      }

      // 检查房间是否存在
      const roomData = await redisClient.get(`room:${userRoomId}`);
      if (!roomData) {
        issues.push(`User ${userId} references non-existent room ${userRoomId}`);
        await this.clearUserCurrentRoom(userId);
        fixedIssues.push(`Cleared invalid room reference for user ${userId}`);
        return { consistent: false, issues, fixedIssues };
      }

      const roomState: RoomState = JSON.parse(roomData.toString());
      const playerInRoom = roomState.players.find(p => p.id === userId);
      
      if (!playerInRoom) {
        issues.push(`User ${userId} not found in room ${userRoomId} player list`);
        await this.clearUserCurrentRoom(userId);
        fixedIssues.push(`Cleared room reference for user ${userId} not in room`);
        return { consistent: false, issues, fixedIssues };
      }

      return { consistent: true, issues, fixedIssues };
    } catch (error) {
      console.error('Error validating room state consistency:', error);
      issues.push(`Error validating consistency for user ${userId}: ${error}`);
      return { consistent: false, issues, fixedIssues };
    }
  }

  /**
   * 获取房间中的所有在线用户
   */
  async getRoomOnlineUsers(roomId: string): Promise<string[]> {
    try {
      const roomData = await redisClient.get(`room:${roomId}`);
      if (!roomData) {
        return [];
      }

      const roomState: RoomState = JSON.parse(roomData.toString());
      return roomState.players
        .filter(p => p.isConnected)
        .map(p => p.id);
    } catch (error) {
      console.error('Error getting room online users:', error);
      return [];
    }
  }

  /**
   * 清理孤立的用户状态
   * 定期清理那些引用了不存在房间的用户状态
   */
  async cleanupOrphanedUserStates(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = [];
    let cleaned = 0;

    try {
      // 获取所有用户房间状态键
      const userRoomKeys = await redisClient.keys('user_room:*');
      
      for (const key of userRoomKeys) {
        try {
          const roomId = await redisClient.get(key);
          if (!roomId) continue;

          // 检查房间是否存在
          const roomExists = await redisClient.exists(`room:${roomId}`);
          if (!roomExists) {
            await redisClient.del(key);
            cleaned++;
            console.log(`Cleaned orphaned user state: ${key} -> ${roomId}`);
          }
        } catch (error) {
          errors.push(`Error processing ${key}: ${error}`);
        }
      }
    } catch (error) {
      errors.push(`Error during cleanup: ${error}`);
    }

    return { cleaned, errors };
  }
}

// 导出单例实例
export const userStateService = UserStateService.getInstance();

// 定期清理孤立状态（每5分钟执行一次）
setInterval(async () => {
  try {
    const result = await userStateService.cleanupOrphanedUserStates();
    if (result.cleaned > 0 || result.errors.length > 0) {
      console.log('User state cleanup completed:', result);
    }
  } catch (error) {
    console.error('Error during scheduled user state cleanup:', error);
  }
}, 5 * 60 * 1000);