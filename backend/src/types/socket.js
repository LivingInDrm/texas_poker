"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_ERRORS = exports.SOCKET_EVENTS = void 0;
// Socket 事件常量
exports.SOCKET_EVENTS = {
    // 连接相关
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    // 房间相关
    ROOM_JOIN: 'room:join',
    ROOM_LEAVE: 'room:leave',
    ROOM_JOINED: 'room:joined',
    ROOM_LEFT: 'room:left',
    ROOM_PLAYER_JOINED: 'room:player_joined',
    ROOM_PLAYER_LEFT: 'room:player_left',
    ROOM_STATE_UPDATE: 'room:state_update',
    ROOM_QUICK_START: 'room:quick_start',
    ROOM_READY_STATE_CHANGED: 'room:ready_state_changed',
    // 游戏相关
    GAME_STARTED: 'game:started',
    GAME_ACTION: 'game:action',
    GAME_ACTION_REQUIRED: 'game:action_required',
    GAME_ACTION_MADE: 'game:action_made',
    GAME_PHASE_CHANGED: 'game:phase_changed',
    GAME_ENDED: 'game:ended',
    GAME_SYNC: 'game:sync',
    GAME_READY: 'game:ready',
    GAME_START: 'game:start',
    GAME_RESTART: 'game:restart',
    // 系统相关
    ERROR: 'error',
    CONNECTED: 'connected',
    RECONNECTED: 'reconnected',
    PING: 'ping',
    RECONNECT_ATTEMPT: 'reconnect_attempt'
};
// 错误代码常量
exports.SOCKET_ERRORS = {
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
    ROOM_FULL: 'ROOM_FULL',
    INVALID_PASSWORD: 'INVALID_PASSWORD',
    PLAYER_NOT_IN_ROOM: 'PLAYER_NOT_IN_ROOM',
    GAME_NOT_STARTED: 'GAME_NOT_STARTED',
    INVALID_ACTION: 'INVALID_ACTION',
    NOT_PLAYER_TURN: 'NOT_PLAYER_TURN',
    INSUFFICIENT_CHIPS: 'INSUFFICIENT_CHIPS',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    FORCED_ROOM_LEAVE: 'FORCED_ROOM_LEAVE'
};
