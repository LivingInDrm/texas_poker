import { Socket } from 'socket.io-client';

// Socket.IO 事件接口定义（与后端保持一致）
export interface ServerToClientEvents {
  // 房间相关事件
  'room:joined': (data: { roomId: string; players: RoomPlayer[] }) => void;
  'room:left': (data: { roomId: string; playerId: string }) => void;
  'room:player_joined': (data: { player: RoomPlayer }) => void;
  'room:player_left': (data: { playerId: string }) => void;
  'room:state_update': (data: { roomState: RoomState }) => void;
  
  // 游戏相关事件
  'game:started': (data: { gameState: GameState }) => void;
  'game:action_required': (data: { playerId: string; timeout: number; validActions: string[] }) => void;
  'game:action_made': (data: { playerId: string; action: PlayerAction; gameState: GameState }) => void;
  'game:phase_changed': (data: { phase: GamePhase; gameState: GameState }) => void;
  'game:ended': (data: { results: GameResult[]; gameState: GameState }) => void;
  'game:sync': (data: { gameState: GameState }) => void;
  
  // 系统相关事件
  'error': (data: { message: string; code?: string }) => void;
  'connected': (data: { message: string }) => void;
  'reconnected': (data: { roomId?: string; gameState?: GameState }) => void;
  'heartbeat': (timestamp: number) => void;
}

export interface ClientToServerEvents {
  // 房间相关事件
  'room:join': (data: { roomId: string; password?: string }, callback: (response: SocketResponse) => void) => void;
  'room:leave': (data: { roomId: string }, callback: (response: SocketResponse) => void) => void;
  'room:quick_start': (callback: (response: SocketResponse) => void) => void;
  
  // 游戏相关事件
  'game:action': (data: { roomId: string; action: PlayerAction }, callback: (response: SocketResponse) => void) => void;
  'game:ready': (data: { roomId: string }, callback: (response: SocketResponse) => void) => void;
  'game:restart': (data: { roomId: string }, callback: (response: SocketResponse) => void) => void;
  
  // 系统相关事件
  'ping': (callback: (response: number) => void) => void;
  'reconnect_attempt': (data: { roomId?: string }) => void;
  'heartbeat_response': (timestamp: number) => void;
}

// 房间玩家信息
export interface RoomPlayer {
  id: string;
  username: string;
  avatar?: string;
  chips: number;
  isReady: boolean;
  position: number;
  isConnected: boolean;
  lastAction?: PlayerAction;
}

// 房间状态
export interface RoomState {
  id: string;
  ownerId: string;
  players: RoomPlayer[];
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  maxPlayers: number;
  currentPlayerCount: number;
  hasPassword: boolean;
  bigBlind: number;
  smallBlind: number;
  gameStarted: boolean;
  gameState?: GameState;
}

// 游戏状态
export interface GameState {
  phase: GamePhase;
  players: GamePlayer[];
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number;
  board: string[];
  pot: number;
  sidePots: SidePot[];
  currentBet: number;
  roundBets: { [playerId: string]: number };
  history: GameAction[];
  timeout: number;
  gameId: string;
  roomId: string;
}

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

export interface GamePlayer {
  id: string;
  username: string;
  chips: number;
  cards: string[];
  status: 'active' | 'folded' | 'allin' | 'away';
  position: number;
  totalBet: number;
  isConnected: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayers: string[];
}

export interface PlayerAction {
  type: 'fold' | 'check' | 'call' | 'raise' | 'allin';
  amount?: number;
  timestamp: Date;
}

export interface GameAction {
  playerId: string;
  action: PlayerAction;
  phase: GamePhase;
  timestamp: Date;
}

export interface GameResult {
  playerId: string;
  username: string;
  finalCards: string[];
  handRank: string;
  chipsWon: number;
  chipsChange: number;
  isWinner: boolean;
}

// Socket 响应接口
export interface SocketResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

// 扩展的Socket类型
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// 连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

// 网络质量
export interface NetworkQuality {
  ping: number;
  status: 'excellent' | 'good' | 'poor' | 'offline';
}

// Socket事件常量
export const SOCKET_EVENTS = {
  // 连接相关
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_ERROR: 'reconnect_error',
  RECONNECT_FAILED: 'reconnect_failed',
  
  // 房间相关
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_JOINED: 'room:joined',
  ROOM_LEFT: 'room:left',
  ROOM_PLAYER_JOINED: 'room:player_joined',
  ROOM_PLAYER_LEFT: 'room:player_left',
  ROOM_STATE_UPDATE: 'room:state_update',
  ROOM_QUICK_START: 'room:quick_start',
  
  // 游戏相关
  GAME_STARTED: 'game:started',
  GAME_ACTION: 'game:action',
  GAME_ACTION_REQUIRED: 'game:action_required',
  GAME_ACTION_MADE: 'game:action_made',
  GAME_PHASE_CHANGED: 'game:phase_changed',
  GAME_ENDED: 'game:ended',
  GAME_SYNC: 'game:sync',
  GAME_READY: 'game:ready',
  GAME_RESTART: 'game:restart',
  
  // 系统相关
  ERROR: 'error',
  CONNECTED: 'connected',
  RECONNECTED: 'reconnected',
  PING: 'ping',
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_RESPONSE: 'heartbeat_response'
} as const;

// 错误代码常量
export const SOCKET_ERRORS = {
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  PLAYER_NOT_IN_ROOM: 'PLAYER_NOT_IN_ROOM',
  GAME_NOT_STARTED: 'GAME_NOT_STARTED',
  INVALID_ACTION: 'INVALID_ACTION',
  NOT_PLAYER_TURN: 'NOT_PLAYER_TURN',
  INSUFFICIENT_CHIPS: 'INSUFFICIENT_CHIPS',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;