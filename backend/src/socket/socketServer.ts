import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  AuthenticatedSocket,
  SOCKET_EVENTS,
  SOCKET_ERRORS
} from '../types/socket';
import { setupRoomHandlers } from './handlers/roomHandlers';
import { setupGameHandlers } from './handlers/gameHandlers';
import { setupSystemHandlers } from './handlers/systemHandlers';
import { userStateService } from '../services/userStateService';
import prisma from '../prisma';

// 创建Socket.IO服务器
export function createSocketServer(httpServer: HttpServer): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // JWT认证中间件
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      // 验证用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        return next(new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED));
      }

      // 设置socket数据
      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.authenticated = true;

      console.log(`User ${user.username} (${user.id}) authenticated for socket connection`);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error(SOCKET_ERRORS.AUTHENTICATION_FAILED));
    }
  });

  // 连接处理
  io.on(SOCKET_EVENTS.CONNECTION, (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.data.username})`);

    // 发送连接确认
    socket.emit(SOCKET_EVENTS.CONNECTED, {
      message: `Welcome ${socket.data.username}! You are connected to Texas Poker.`
    });

    // 设置各类事件处理器
    setupSystemHandlers(socket, io);
    setupRoomHandlers(socket, io);
    setupGameHandlers(socket, io);

    // 断开连接处理
    socket.on(SOCKET_EVENTS.DISCONNECT, async (reason) => {
      console.log(`Socket disconnected: ${socket.id} (User: ${socket.data.username}, Reason: ${reason})`);
      
      // 如果用户在房间中，处理离开房间逻辑
      if (socket.data.roomId) {
        try {
          await handlePlayerDisconnect(socket, io);
        } catch (error) {
          console.error('Error handling player disconnect:', error);
        }
      }
    });

    // 错误处理
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.data.username}:`, error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'An error occurred',
        code: SOCKET_ERRORS.INTERNAL_ERROR
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
async function handlePlayerDisconnect(
  socket: AuthenticatedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  const { roomId, userId } = socket.data;
  
  if (!roomId || !userId) return;

  try {
    // 从Redis获取房间状态
    const { redisClient } = require('../db');
    const roomData = await redisClient.get(`room:${roomId}`);
    
    if (roomData) {
      const roomState = JSON.parse(roomData);
      
      // 标记玩家为断开连接状态
      const playerIndex = roomState.players.findIndex((p: any) => p.id === userId);
      if (playerIndex !== -1) {
        roomState.players[playerIndex].isConnected = false;
        
        // 保存更新的房间状态
        await redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
        
        // 通知房间内其他玩家
        socket.to(roomId).emit(SOCKET_EVENTS.ROOM_STATE_UPDATE, {
          roomState
        });
        
        console.log(`Player ${socket.data.username} disconnected from room ${roomId}`);
        
        // 注意：我们不立即清除全局用户状态，因为用户可能会重连
        // 全局用户状态会在用户明确离开房间或重连超时后清除
      } else {
        // 如果用户不在房间中，清除全局状态
        await userStateService.clearUserCurrentRoom(userId);
        console.log(`Cleared orphaned user state for ${socket.data.username}`);
      }
    } else {
      // 如果房间不存在，清除全局用户状态
      await userStateService.clearUserCurrentRoom(userId);
      console.log(`Cleared user state for non-existent room ${roomId}`);
    }
  } catch (error) {
    console.error('Error handling player disconnect:', error);
    // 在错误情况下也尝试清除用户状态，防止状态泄漏
    try {
      await userStateService.clearUserCurrentRoom(userId);
    } catch (cleanupError) {
      console.error('Error cleaning up user state after disconnect error:', cleanupError);
    }
  }
}

// 获取房间内的socket数量
export function getRoomSocketCount(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  roomId: string
): number {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

// 获取用户的socket实例
export function getUserSocket(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  userId: string
): AuthenticatedSocket | null {
  for (const [socketId, socket] of io.sockets.sockets) {
    if ((socket as AuthenticatedSocket).data?.userId === userId) {
      return socket as AuthenticatedSocket;
    }
  }
  return null;
}

// 向房间内所有玩家广播消息
export function broadcastToRoom(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  roomId: string,
  event: keyof ServerToClientEvents,
  data: any
) {
  io.to(roomId).emit(event, data);
}

// 向特定用户发送消息
export function sendToUser(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  userId: string,
  event: keyof ServerToClientEvents,
  data: any
): boolean {
  const socket = getUserSocket(io, userId);
  if (socket) {
    socket.emit(event, data);
    return true;
  }
  return false;
}