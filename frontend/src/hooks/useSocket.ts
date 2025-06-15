import { useEffect, useState, useCallback, useRef } from 'react';
import { useUserStore } from '../stores/userStore';
import { useGameStore } from '../stores/gameStore';
import socketService from '../services/socketService';
import {
  ConnectionStatus,
  NetworkQuality,
  RoomState,
  GameState,
  PlayerAction,
  GameResult,
  SOCKET_EVENTS
} from '../types/socket';

interface UseSocketReturn {
  // 连接状态
  connected: boolean;
  connectionStatus: ConnectionStatus;
  networkQuality: NetworkQuality;
  
  // 方法
  connect: () => Promise<boolean>;
  disconnect: () => void;
  joinRoom: (roomId: string, password?: string) => Promise<any>;
  leaveRoom: (roomId: string) => Promise<any>;
  quickStart: () => Promise<any>;
  makeGameAction: (action: PlayerAction) => Promise<any>;
  setReady: () => Promise<any>;
  restartGame: () => Promise<any>;
  
  // 状态
  currentRoomId: string | null;
  gameState: GameState | null;
  inGame: boolean;
}

export function useSocket(): UseSocketReturn {
  const { user, token } = useUserStore();
  const { 
    setRoomState, 
    setGameState, 
    updatePlayerAction,
    endGame,
    currentRoom,
    gameState: storeGameState 
  } = useGameStore();

  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({ ping: 0, status: 'offline' });

  // 使用ref来避免重复设置监听器
  const listenersSetup = useRef(false);

  // 连接到Socket服务器
  const connect = useCallback(async (): Promise<boolean> => {
    if (!token) {
      console.error('No authentication token available');
      return false;
    }

    try {
      const success = await socketService.connect(token);
      if (success) {
        setConnected(true);
        setConnectionStatus('connected');
      }
      return success;
    } catch (error) {
      console.error('Failed to connect to socket:', error);
      setConnectionStatus('error');
      return false;
    }
  }, [token]);

  // 断开连接
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setConnected(false);
    setConnectionStatus('disconnected');
    setNetworkQuality({ ping: 0, status: 'offline' });
  }, []);

  // 房间操作
  const joinRoom = useCallback(async (roomId: string, password?: string) => {
    try {
      const response = await socketService.joinRoom(roomId, password);
      if (response.success && response.data?.roomState) {
        setRoomState(response.data.roomState);
      }
      return response;
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }, [setRoomState]);

  const leaveRoom = useCallback(async (roomId: string) => {
    try {
      const response = await socketService.leaveRoom(roomId);
      if (response.success) {
        setRoomState(null);
        setGameState(null);
      }
      return response;
    } catch (error) {
      console.error('Failed to leave room:', error);
      throw error;
    }
  }, [setRoomState, setGameState]);

  const quickStart = useCallback(async () => {
    try {
      const response = await socketService.quickStart();
      if (response.success && response.data?.roomState) {
        setRoomState(response.data.roomState);
      }
      return response;
    } catch (error) {
      console.error('Failed to quick start:', error);
      throw error;
    }
  }, [setRoomState]);

  // 游戏操作
  const makeGameAction = useCallback(async (action: PlayerAction) => {
    if (!socketService.roomId) {
      throw new Error('Not in a room');
    }

    try {
      const response = await socketService.makeGameAction(socketService.roomId, action);
      return response;
    } catch (error) {
      console.error('Failed to make game action:', error);
      throw error;
    }
  }, []);

  const setReady = useCallback(async () => {
    if (!socketService.roomId) {
      throw new Error('Not in a room');
    }

    try {
      const response = await socketService.setReady(socketService.roomId);
      return response;
    } catch (error) {
      console.error('Failed to set ready:', error);
      throw error;
    }
  }, []);

  const restartGame = useCallback(async () => {
    if (!socketService.roomId) {
      throw new Error('Not in a room');
    }

    try {
      const response = await socketService.restartGame(socketService.roomId);
      return response;
    } catch (error) {
      console.error('Failed to restart game:', error);
      throw error;
    }
  }, []);

  // 设置事件监听器
  useEffect(() => {
    if (listenersSetup.current) return;

    // 连接状态监听
    socketService.on('connection_status_change', (status: ConnectionStatus) => {
      setConnectionStatus(status);
      setConnected(status === 'connected');
    });

    // 网络质量监听
    socketService.on('network_quality_update', (quality: NetworkQuality) => {
      setNetworkQuality(quality);
    });

    // 房间事件监听
    socketService.on(SOCKET_EVENTS.ROOM_STATE_UPDATE, (data: { roomState: RoomState }) => {
      setRoomState(data.roomState);
    });

    socketService.on(SOCKET_EVENTS.ROOM_PLAYER_JOINED, (data: { player: any }) => {
      console.log('Player joined:', data.player.username);
      // 可以在这里显示通知或更新UI
    });

    socketService.on(SOCKET_EVENTS.ROOM_PLAYER_LEFT, (data: { playerId: string }) => {
      console.log('Player left:', data.playerId);
      // 可以在这里显示通知或更新UI
    });

    // 游戏事件监听
    socketService.on(SOCKET_EVENTS.GAME_STARTED, (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      console.log('Game started');
    });

    socketService.on(SOCKET_EVENTS.GAME_ACTION_REQUIRED, (data: { playerId: string; timeout: number; validActions: string[] }) => {
      console.log('Action required for:', data.playerId);
      // 可以在这里显示行动提示
    });

    socketService.on(SOCKET_EVENTS.GAME_ACTION_MADE, (data: { playerId: string; action: PlayerAction; gameState: GameState }) => {
      setGameState(data.gameState);
      updatePlayerAction(data.playerId, data.action);
      console.log('Player action:', data.playerId, data.action.type);
    });

    socketService.on(SOCKET_EVENTS.GAME_PHASE_CHANGED, (data: { phase: string; gameState: GameState }) => {
      setGameState(data.gameState);
      console.log('Game phase changed to:', data.phase);
    });

    socketService.on(SOCKET_EVENTS.GAME_ENDED, (data: { results: GameResult[]; gameState: GameState }) => {
      setGameState(data.gameState);
      endGame(data.results);
      console.log('Game ended');
    });

    socketService.on(SOCKET_EVENTS.GAME_SYNC, (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      console.log('Game state synced');
    });

    // 系统事件监听
    socketService.on(SOCKET_EVENTS.RECONNECTED, (data: { roomId?: string; gameState?: GameState }) => {
      console.log('Reconnected to server');
      if (data.gameState) {
        setGameState(data.gameState);
      }
    });

    socketService.onError((error) => {
      console.error('Socket error:', error.message);
      // 可以在这里显示错误通知
    });

    listenersSetup.current = true;

    // 清理函数
    return () => {
      // 注意：由于socketService是单例，这里不清理监听器
      // 监听器会在组件重新挂载时避免重复设置
    };
  }, [setRoomState, setGameState, updatePlayerAction, endGame]);

  // 自动连接（如果有token且未连接）
  useEffect(() => {
    if (token && !connected && connectionStatus === 'disconnected') {
      connect();
    }
  }, [token, connected, connectionStatus, connect]);

  // 当用户登出时断开连接
  useEffect(() => {
    if (!user && connected) {
      disconnect();
    }
  }, [user, connected, disconnect]);

  return {
    // 连接状态
    connected,
    connectionStatus,
    networkQuality,
    
    // 方法
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    quickStart,
    makeGameAction,
    setReady,
    restartGame,
    
    // 状态
    currentRoomId: socketService.roomId,
    gameState: socketService.gameState,
    inGame: socketService.inGame
  };
}