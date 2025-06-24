import { redisClient } from '../db';
import { RoomState } from '../types/socket';
import prisma from '../prisma';
import { roomCleanupHelper } from '../utils/roomCleanupHelper';

/**
 * 房间清理服务
 * 负责监控房间活动并自动销毁空闲房间
 */
export class RoomCleanupService {
  private static instance: RoomCleanupService;
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly CLEANUP_DELAY_MS: number;
  private isEnabled: boolean = true;

  private constructor() {
    this.CLEANUP_DELAY_MS = parseInt(process.env.ROOM_CLEANUP_DELAY_MS || '30000');
    this.isEnabled = process.env.ENABLE_ROOM_CLEANUP !== 'false';
    
    console.log(`RoomCleanupService initialized with cleanup delay: ${this.CLEANUP_DELAY_MS}ms, enabled: ${this.isEnabled}`);
  }

  public static getInstance(): RoomCleanupService {
    if (!RoomCleanupService.instance) {
      RoomCleanupService.instance = new RoomCleanupService();
    }
    return RoomCleanupService.instance;
  }

  /**
   * 安排房间清理
   * 当房间没有在线用户时调用
   */
  async scheduleRoomCleanup(roomId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      // 首先检查房间是否真的没有在线用户
      const onlineUserCount = await this.getRoomOnlineUserCount(roomId);
      
      if (onlineUserCount > 0) {
        console.log(`Room ${roomId} has ${onlineUserCount} online users, skipping cleanup scheduling`);
        return;
      }

      // 取消之前的清理定时器（如果存在）
      this.cancelRoomCleanup(roomId);

      // 创建新的清理定时器，包含警告机制
      const warningTime = Math.max(5000, this.CLEANUP_DELAY_MS * 0.2); // 至少5秒或总时间的20%作为警告时间
      const cleanupTime = this.CLEANUP_DELAY_MS - warningTime;
      
      // 发送警告的定时器
      const warningTimer = setTimeout(() => {
        roomCleanupHelper.broadcastRoomCleanupWarning(roomId, warningTime);
      }, cleanupTime);
      
      // 实际清理的定时器
      const timer = setTimeout(async () => {
        try {
          await this.performRoomCleanup(roomId);
        } catch (error) {
          console.error(`Error during scheduled cleanup of room ${roomId}:`, error);
        }
      }, this.CLEANUP_DELAY_MS);

      this.cleanupTimers.set(roomId, timer);
      
      console.log(`Scheduled cleanup for room ${roomId} in ${this.CLEANUP_DELAY_MS}ms`);
    } catch (error) {
      console.error(`Error scheduling cleanup for room ${roomId}:`, error);
    }
  }

  /**
   * 取消房间清理
   * 当有用户加入房间时调用
   */
  cancelRoomCleanup(roomId: string): void {
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
      console.log(`Cancelled cleanup for room ${roomId}`);
    }
  }

  /**
   * 立即执行房间清理
   */
  async performRoomCleanup(roomId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Starting cleanup for room ${roomId}`);

      // 再次检查房间是否有在线用户（防止竞态条件）
      const onlineUserCount = await this.getRoomOnlineUserCount(roomId);
      if (onlineUserCount > 0) {
        console.log(`Room ${roomId} has ${onlineUserCount} online users, aborting cleanup`);
        this.cleanupTimers.delete(roomId);
        return { success: false, error: 'Room has online users' };
      }

      // 广播房间即将被销毁的通知
      roomCleanupHelper.broadcastRoomDestroyed(roomId, 'No users online for 30 seconds');
      
      // 断开房间内所有Socket连接
      roomCleanupHelper.disconnectRoomSockets(roomId, 'Room automatically destroyed due to inactivity');
      
      // 从Redis删除房间状态
      const roomDeleted = await redisClient.del(`room:${roomId}`);
      
      // 从数据库删除房间记录（如果状态允许）
      let dbDeleted = false;
      try {
        const room = await prisma.room.findUnique({ 
          where: { id: roomId },
          select: { id: true, status: true }
        });
        
        if (room && room.status === 'WAITING') {
          await prisma.room.delete({ where: { id: roomId } });
          dbDeleted = true;
          console.log(`Deleted room ${roomId} from database`);
        } else if (room) {
          console.log(`Room ${roomId} has status ${room.status}, keeping in database`);
        }
      } catch (dbError) {
        console.error(`Error deleting room ${roomId} from database:`, dbError);
        // 数据库删除失败不影响Redis清理
      }

      // 清理定时器
      this.cleanupTimers.delete(roomId);

      const result = {
        success: true,
        redisDeleted: roomDeleted > 0,
        dbDeleted,
        roomId
      };

      console.log(`Room cleanup completed for ${roomId}:`, result);
      return { success: true };

    } catch (error) {
      console.error(`Error performing cleanup for room ${roomId}:`, error);
      this.cleanupTimers.delete(roomId);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 获取房间在线用户数量
   */
  async getRoomOnlineUserCount(roomId: string): Promise<number> {
    try {
      const roomData = await redisClient.get(`room:${roomId}`);
      if (!roomData) {
        return 0;
      }

      const roomState: RoomState = JSON.parse(roomData.toString());
      return roomState.players.filter(p => p.isConnected).length;
    } catch (error) {
      console.error(`Error getting online user count for room ${roomId}:`, error);
      return 0;
    }
  }

  /**
   * 获取房间是否存在
   */
  async roomExists(roomId: string): Promise<boolean> {
    try {
      const exists = await redisClient.exists(`room:${roomId}`);
      return exists === 1;
    } catch (error) {
      console.error(`Error checking if room ${roomId} exists:`, error);
      return false;
    }
  }

  /**
   * 获取所有活跃的清理定时器
   */
  getActiveCleanupTimers(): string[] {
    return Array.from(this.cleanupTimers.keys());
  }

  /**
   * 清理所有定时器（服务关闭时调用）
   */
  shutdown(): void {
    console.log(`Shutting down RoomCleanupService, clearing ${this.cleanupTimers.size} timers`);
    
    this.cleanupTimers.forEach((timer, roomId) => {
      clearTimeout(timer);
      console.log(`Cleared cleanup timer for room ${roomId}`);
    });
    
    this.cleanupTimers.clear();
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    enabled: boolean;
    cleanupDelayMs: number;
    activeTimers: number;
    activeRooms: string[];
  } {
    return {
      enabled: this.isEnabled,
      cleanupDelayMs: this.CLEANUP_DELAY_MS,
      activeTimers: this.cleanupTimers.size,
      activeRooms: Array.from(this.cleanupTimers.keys())
    };
  }

  /**
   * 启用/禁用服务
   */
  setEnabled(enabled: boolean): void {
    const wasEnabled = this.isEnabled;
    this.isEnabled = enabled;
    
    if (wasEnabled && !enabled) {
      // 如果从启用变为禁用，清理所有定时器
      this.shutdown();
    }
    
    console.log(`RoomCleanupService ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// 导出单例实例
export const roomCleanupService = RoomCleanupService.getInstance();

// 进程退出时清理定时器
process.on('SIGINT', () => {
  roomCleanupService.shutdown();
});

process.on('SIGTERM', () => {
  roomCleanupService.shutdown();
});