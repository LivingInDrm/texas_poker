import { io } from 'socket.io-client';
import { 
  AppSocket, 
  ServerToClientEvents, 
  ClientToServerEvents,
  ConnectionStatus,
  NetworkQuality,
  RoomState,
  GameState,
  PlayerAction,
  GameResult,
  SOCKET_EVENTS,
  SocketResponse
} from '../types/socket';

// Socket连接配置
const SOCKET_CONFIG = {
  url: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  options: {
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
    transports: ['websocket', 'polling']
  }
};

// 事件监听器类型
type EventListener<T = any> = (data: T) => void;
type ErrorListener = (error: { message: string; code?: string }) => void;

class SocketService {
  private socket: AppSocket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private networkQuality: NetworkQuality = { ping: 0, status: 'offline' };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  
  // 事件监听器存储
  private listeners: Map<string, Set<EventListener>> = new Map();
  private errorListeners: Set<ErrorListener> = new Set();
  
  // 当前房间和游戏状态
  private currentRoomId: string | null = null;
  private currentGameState: GameState | null = null;
  private isInGame: boolean = false;

  constructor() {
    this.initializeEventMaps();
  }

  private initializeEventMaps() {
    // 初始化事件监听器映射
    Object.values(SOCKET_EVENTS).forEach(event => {
      this.listeners.set(event, new Set());
    });
  }

  // 连接到服务器
  async connect(token: string): Promise<boolean> {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return true;
    }

    try {
      this.connectionStatus = 'connecting';
      this.notifyStatusChange();

      // 创建socket连接
      this.socket = io(SOCKET_CONFIG.url, {
        ...SOCKET_CONFIG.options,
        auth: {
          token
        }
      });

      // 设置连接事件监听器
      this.setupConnectionHandlers();
      
      // 设置游戏事件监听器
      this.setupGameEventHandlers();
      
      // 设置房间事件监听器
      this.setupRoomEventHandlers();
      
      // 设置系统事件监听器
      this.setupSystemEventHandlers();

      // 连接到服务器
      this.socket.connect();

      // 等待连接完成
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, SOCKET_CONFIG.options.timeout);

        this.socket!.once(SOCKET_EVENTS.CONNECT, () => {
          clearTimeout(timeout);
          this.connectionStatus = 'connected';
          this.notifyStatusChange();
          this.startPingMonitoring();
          console.log('Socket connected successfully');
          resolve(true);
        });

        this.socket!.once(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
          clearTimeout(timeout);
          this.connectionStatus = 'error';
          this.notifyStatusChange();
          console.error('Socket connection error:', error);
          reject(error);
        });
      });

    } catch (error) {
      this.connectionStatus = 'error';
      this.notifyStatusChange();
      console.error('Failed to connect socket:', error);
      return false;
    }
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionStatus = 'disconnected';
    this.currentRoomId = null;
    this.currentGameState = null;
    this.isInGame = false;
    
    this.clearTimers();
    this.notifyStatusChange();
    
    console.log('Socket disconnected');
  }

  // 设置连接事件处理器
  private setupConnectionHandlers() {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      this.connectionStatus = 'connected';
      this.notifyStatusChange();
      console.log('Connected to server');
    });

    this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      this.connectionStatus = 'disconnected';
      this.notifyStatusChange();
      console.log('Disconnected from server:', reason);
      
      if (reason === 'io server disconnect') {
        // 服务器主动断开连接，不自动重连
        this.socket?.connect();
      }
    });

    this.socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attemptNumber) => {
      this.connectionStatus = 'reconnecting';
      this.notifyStatusChange();
      console.log(`Reconnection attempt ${attemptNumber}`);
    });

    this.socket.on(SOCKET_EVENTS.RECONNECT, (attemptNumber) => {
      this.connectionStatus = 'connected';
      this.notifyStatusChange();
      console.log(`Reconnected after ${attemptNumber} attempts`);
      
      // 重连后尝试恢复房间状态
      if (this.currentRoomId) {
        this.attemptRoomReconnection();
      }
    });

    this.socket.on(SOCKET_EVENTS.RECONNECT_ERROR, (error) => {
      console.error('Reconnection error:', error);
    });

    this.socket.on(SOCKET_EVENTS.RECONNECT_FAILED, () => {
      this.connectionStatus = 'error';
      this.notifyStatusChange();
      console.error('Failed to reconnect after maximum attempts');
    });
  }

  // 设置房间事件处理器
  private setupRoomEventHandlers() {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.ROOM_JOINED, (data) => {
      console.log('Joined room:', data.roomId);
      this.emit(SOCKET_EVENTS.ROOM_JOINED, data);
    });

    this.socket.on(SOCKET_EVENTS.ROOM_PLAYER_JOINED, (data) => {
      console.log('Player joined room:', data.player.username);
      this.emit(SOCKET_EVENTS.ROOM_PLAYER_JOINED, data);
    });

    this.socket.on(SOCKET_EVENTS.ROOM_PLAYER_LEFT, (data) => {
      console.log('Player left room:', data.playerId);
      this.emit(SOCKET_EVENTS.ROOM_PLAYER_LEFT, data);
    });

    this.socket.on(SOCKET_EVENTS.ROOM_STATE_UPDATE, (data) => {
      this.currentRoomId = data.roomState.id;
      console.log('Room state updated:', data.roomState);
      this.emit(SOCKET_EVENTS.ROOM_STATE_UPDATE, data);
    });
  }

  // 设置游戏事件处理器
  private setupGameEventHandlers() {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.GAME_STARTED, (data) => {
      this.currentGameState = data.gameState;
      this.isInGame = true;
      console.log('Game started:', data.gameState.gameId);
      this.emit(SOCKET_EVENTS.GAME_STARTED, data);
    });

    this.socket.on(SOCKET_EVENTS.GAME_ACTION_REQUIRED, (data) => {
      console.log('Action required for player:', data.playerId);
      this.emit(SOCKET_EVENTS.GAME_ACTION_REQUIRED, data);
    });

    this.socket.on(SOCKET_EVENTS.GAME_ACTION_MADE, (data) => {
      this.currentGameState = data.gameState;
      console.log('Player action:', data.playerId, data.action.type);
      this.emit(SOCKET_EVENTS.GAME_ACTION_MADE, data);
    });

    this.socket.on(SOCKET_EVENTS.GAME_PHASE_CHANGED, (data) => {
      this.currentGameState = data.gameState;
      console.log('Game phase changed:', data.phase);
      this.emit(SOCKET_EVENTS.GAME_PHASE_CHANGED, data);
    });

    this.socket.on(SOCKET_EVENTS.GAME_ENDED, (data) => {
      this.currentGameState = data.gameState;
      this.isInGame = false;
      console.log('Game ended');
      this.emit(SOCKET_EVENTS.GAME_ENDED, data);
    });

    this.socket.on(SOCKET_EVENTS.GAME_SYNC, (data) => {
      this.currentGameState = data.gameState;
      console.log('Game state synced');
      this.emit(SOCKET_EVENTS.GAME_SYNC, data);
    });
  }

  // 设置系统事件处理器
  private setupSystemEventHandlers() {
    if (!this.socket) return;

    this.socket.on(SOCKET_EVENTS.ERROR, (data) => {
      console.error('Socket error:', data.message, data.code);
      this.emitError(data);
    });

    this.socket.on(SOCKET_EVENTS.RECONNECTED, (data) => {
      console.log('Reconnected to server');
      if (data.roomId) {
        this.currentRoomId = data.roomId;
      }
      if (data.gameState) {
        this.currentGameState = data.gameState;
        this.isInGame = true;
      }
      this.emit(SOCKET_EVENTS.RECONNECTED, data);
    });

    this.socket.on(SOCKET_EVENTS.HEARTBEAT, (timestamp) => {
      // 响应心跳
      this.socket?.emit(SOCKET_EVENTS.HEARTBEAT_RESPONSE, timestamp);
    });
  }

  // 房间操作方法
  async joinRoom(roomId: string, password?: string): Promise<SocketResponse> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId, password }, (response) => {
        if (response.success) {
          this.currentRoomId = roomId;
          console.log('Successfully joined room:', roomId);
        }
        resolve(response);
      });

      // 设置超时
      setTimeout(() => {
        reject(new Error('Join room timeout'));
      }, 10000);
    });
  }

  async leaveRoom(roomId: string): Promise<SocketResponse> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId }, (response) => {
        if (response.success) {
          this.currentRoomId = null;
          this.currentGameState = null;
          this.isInGame = false;
          console.log('Successfully left room:', roomId);
        }
        resolve(response);
      });

      setTimeout(() => {
        reject(new Error('Leave room timeout'));
      }, 10000);
    });
  }

  async quickStart(): Promise<SocketResponse> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(SOCKET_EVENTS.ROOM_QUICK_START, (response) => {
        if (response.success && response.data?.roomId) {
          this.currentRoomId = response.data.roomId;
          console.log('Quick start successful, joined room:', response.data.roomId);
        }
        resolve(response);
      });

      setTimeout(() => {
        reject(new Error('Quick start timeout'));
      }, 10000);
    });
  }

  // 游戏操作方法
  async makeGameAction(roomId: string, action: PlayerAction): Promise<SocketResponse> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(SOCKET_EVENTS.GAME_ACTION, { roomId, action }, (response) => {
        console.log('Game action response:', response);
        resolve(response);
      });

      setTimeout(() => {
        reject(new Error('Game action timeout'));
      }, 10000);
    });
  }

  async setReady(roomId: string): Promise<SocketResponse> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(SOCKET_EVENTS.GAME_READY, { roomId }, (response) => {
        console.log('Set ready response:', response);
        resolve(response);
      });

      setTimeout(() => {
        reject(new Error('Set ready timeout'));
      }, 5000);
    });
  }

  async restartGame(roomId: string): Promise<SocketResponse> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit(SOCKET_EVENTS.GAME_RESTART, { roomId }, (response) => {
        console.log('Restart game response:', response);
        resolve(response);
      });

      setTimeout(() => {
        reject(new Error('Restart game timeout'));
      }, 5000);
    });
  }

  // 事件监听方法
  on<T = any>(event: string, listener: EventListener<T>) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<T = any>(event: string, listener: EventListener<T>) {
    this.listeners.get(event)?.delete(listener);
  }

  onError(listener: ErrorListener) {
    this.errorListeners.add(listener);
  }

  offError(listener: ErrorListener) {
    this.errorListeners.delete(listener);
  }

  // 事件触发方法
  private emit<T = any>(event: string, data: T) {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  private emitError(error: { message: string; code?: string }) {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error listener error:', err);
      }
    });
  }

  // 网络监控方法
  private startPingMonitoring() {
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        const startTime = Date.now();
        this.socket.emit(SOCKET_EVENTS.PING, (timestamp) => {
          const ping = Date.now() - startTime;
          this.updateNetworkQuality(ping);
        });
      }
    }, 5000); // 每5秒ping一次
  }

  private updateNetworkQuality(ping: number) {
    this.networkQuality = {
      ping,
      status: ping < 100 ? 'excellent' : ping < 300 ? 'good' : ping < 1000 ? 'poor' : 'offline'
    };
    this.emit('network_quality_update', this.networkQuality);
  }

  // 断线重连处理
  private attemptRoomReconnection() {
    if (this.currentRoomId && this.socket?.connected) {
      this.socket.emit(SOCKET_EVENTS.RECONNECT_ATTEMPT, { 
        roomId: this.currentRoomId 
      });
    }
  }

  // 工具方法
  private clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private notifyStatusChange() {
    this.emit('connection_status_change', this.connectionStatus);
  }

  // Getter方法
  get connected(): boolean {
    return this.socket?.connected || false;
  }

  get status(): ConnectionStatus {
    return this.connectionStatus;
  }

  get quality(): NetworkQuality {
    return this.networkQuality;
  }

  get roomId(): string | null {
    return this.currentRoomId;
  }

  get gameState(): GameState | null {
    return this.currentGameState;
  }

  get inGame(): boolean {
    return this.isInGame;
  }
}

// 导出单例实例
export const socketService = new SocketService();
export default socketService;