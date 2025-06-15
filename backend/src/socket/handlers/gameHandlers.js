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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGameHandlers = setupGameHandlers;
const socket_1 = require("../../types/socket");
const db_1 = require("../../db");
const prisma_1 = __importDefault(require("../../prisma"));
const GameState_1 = require("../../game/GameState");
const validation_1 = require("../middleware/validation");
function setupGameHandlers(socket, io) {
    // 玩家准备
    socket.on(socket_1.SOCKET_EVENTS.GAME_READY, (data, callback) => __awaiter(this, void 0, void 0, function* () {
        const { roomId } = data;
        const { userId, username } = socket.data;
        try {
            // 获取房间状态
            const roomData = yield db_1.redisClient.get(`room:${roomId}`);
            if (!roomData) {
                return callback({
                    success: false,
                    error: 'Room not found',
                    message: socket_1.SOCKET_ERRORS.ROOM_NOT_FOUND
                });
            }
            const roomState = JSON.parse(roomData);
            // 查找玩家
            const playerIndex = roomState.players.findIndex(p => p.id === userId);
            if (playerIndex === -1) {
                return callback({
                    success: false,
                    error: 'Player not in room',
                    message: socket_1.SOCKET_ERRORS.PLAYER_NOT_IN_ROOM
                });
            }
            // 切换准备状态
            roomState.players[playerIndex].isReady = !roomState.players[playerIndex].isReady;
            // 检查是否所有玩家都准备好了
            const allReady = roomState.players.length >= 2 &&
                roomState.players.every(p => p.isReady && p.isConnected);
            if (allReady && !roomState.gameStarted) {
                // 开始游戏
                const gameEngine = new GameState_1.GameState(roomId);
                // 添加玩家到游戏引擎
                for (const player of roomState.players) {
                    gameEngine.addPlayer(player.id, player.username, player.chips);
                    gameEngine.setPlayerReady(player.id, true);
                }
                // 开始新一手牌
                const gameStarted = gameEngine.startNewHand();
                if (!gameStarted) {
                    return callback({
                        success: false,
                        error: 'Failed to start game',
                        message: 'Could not start new hand'
                    });
                }
                // 转换游戏状态为WebSocket格式
                const gameState = convertGameEngineToWebSocketState(gameEngine, roomId);
                roomState.gameStarted = true;
                roomState.status = 'PLAYING';
                roomState.gameState = gameState;
                // 保存房间状态
                yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
                // 通知所有玩家游戏开始
                io.to(roomId).emit(socket_1.SOCKET_EVENTS.GAME_STARTED, { gameState });
                // 通知当前玩家需要行动
                const currentPlayerId = gameEngine.getCurrentPlayerId();
                const currentPlayer = currentPlayerId ? roomState.players.find(p => p.id === currentPlayerId) : null;
                if (currentPlayer) {
                    const validActions = gameEngine.getValidActions(currentPlayerId);
                    io.to(roomId).emit(socket_1.SOCKET_EVENTS.GAME_ACTION_REQUIRED, {
                        playerId: currentPlayerId,
                        timeout: gameState.timeout,
                        validActions
                    });
                }
                console.log(`Game started in room ${roomId}`);
            }
            else {
                // 保存房间状态
                yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
            }
            // 发送响应
            callback({
                success: true,
                message: roomState.players[playerIndex].isReady ? 'Ready for game' : 'Not ready',
                data: { isReady: roomState.players[playerIndex].isReady }
            });
            // 广播房间状态更新
            io.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState });
        }
        catch (error) {
            console.error('Error handling game ready:', error);
            callback({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }
    }));
    // 玩家行动
    socket.on(socket_1.SOCKET_EVENTS.GAME_ACTION, (data, callback) => __awaiter(this, void 0, void 0, function* () {
        const { roomId, action } = data;
        const { userId, username } = socket.data;
        try {
            // 验证玩家行动
            const validationResult = yield validation_1.validationMiddleware.validatePlayerAction(socket, roomId, action);
            if (!validationResult.valid) {
                return callback({
                    success: false,
                    error: validationResult.error || 'Invalid action',
                    message: validationResult.error || socket_1.SOCKET_ERRORS.INVALID_ACTION
                });
            }
            // 获取房间状态
            const roomData = yield db_1.redisClient.get(`room:${roomId}`);
            if (!roomData) {
                return callback({
                    success: false,
                    error: 'Room not found',
                    message: socket_1.SOCKET_ERRORS.ROOM_NOT_FOUND
                });
            }
            const roomState = JSON.parse(roomData);
            if (!roomState.gameState) {
                return callback({
                    success: false,
                    error: 'Game not started',
                    message: socket_1.SOCKET_ERRORS.GAME_NOT_STARTED
                });
            }
            // 重建游戏引擎状态
            const gameEngine = reconstructGameEngine(roomState.gameState);
            // 验证是否轮到该玩家
            const currentPlayer = gameEngine.getCurrentPlayer();
            if (!currentPlayer || currentPlayer.id !== userId) {
                return callback({
                    success: false,
                    error: 'Not your turn',
                    message: socket_1.SOCKET_ERRORS.NOT_PLAYER_TURN
                });
            }
            // 转换action.type到PlayerAction枚举
            const playerAction = convertStringToPlayerAction(action.type);
            if (!playerAction) {
                return callback({
                    success: false,
                    error: 'Invalid action type',
                    message: socket_1.SOCKET_ERRORS.INVALID_ACTION
                });
            }
            // 验证行动是否有效
            const validActions = gameEngine.getValidActions(userId);
            if (!validActions.includes(playerAction)) {
                return callback({
                    success: false,
                    error: 'Invalid action',
                    message: socket_1.SOCKET_ERRORS.INVALID_ACTION
                });
            }
            // 执行行动
            const actionSuccess = gameEngine.makeAction(userId, playerAction, action.amount);
            if (!actionSuccess) {
                return callback({
                    success: false,
                    error: 'Action failed',
                    message: socket_1.SOCKET_ERRORS.INVALID_ACTION
                });
            }
            // 更新游戏状态
            const newGameState = convertGameEngineToWebSocketState(gameEngine, roomId);
            roomState.gameState = newGameState;
            // 保存房间状态
            yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
            // 发送成功响应
            callback({
                success: true,
                message: 'Action executed successfully',
                data: { action, gameState: newGameState }
            });
            // 广播行动结果
            io.to(roomId).emit(socket_1.SOCKET_EVENTS.GAME_ACTION_MADE, {
                playerId: userId,
                action,
                gameState: newGameState
            });
            // 检查游戏阶段是否改变
            if (gameEngine.hasPhaseChanged()) {
                io.to(roomId).emit(socket_1.SOCKET_EVENTS.GAME_PHASE_CHANGED, {
                    phase: newGameState.phase,
                    gameState: newGameState
                });
            }
            // 检查游戏是否结束
            if (newGameState.phase === 'ended') {
                const results = generateGameResults(gameEngine);
                // 更新玩家筹码
                yield updatePlayerChips(results);
                // 记录游戏结果
                yield recordGameResult(roomId, results);
                // 通知游戏结束
                io.to(roomId).emit(socket_1.SOCKET_EVENTS.GAME_ENDED, {
                    results,
                    gameState: newGameState
                });
                // 重置房间状态
                roomState.gameStarted = false;
                roomState.status = 'WAITING';
                roomState.gameState = undefined;
                roomState.players.forEach(p => p.isReady = false);
                yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
                console.log(`Game ended in room ${roomId}`);
            }
            else {
                // 通知下一个玩家行动
                const nextPlayer = gameEngine.getCurrentPlayer();
                if (nextPlayer) {
                    const validActions = gameEngine.getValidActions(nextPlayer.id);
                    io.to(roomId).emit(socket_1.SOCKET_EVENTS.GAME_ACTION_REQUIRED, {
                        playerId: nextPlayer.id,
                        timeout: newGameState.timeout,
                        validActions
                    });
                }
            }
            console.log(`Player ${username} made action ${action.type} in room ${roomId}`);
        }
        catch (error) {
            console.error('Error handling game action:', error);
            callback({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }
    }));
    // 重新开始游戏
    socket.on(socket_1.SOCKET_EVENTS.GAME_RESTART, (data, callback) => __awaiter(this, void 0, void 0, function* () {
        const { roomId } = data;
        const { userId } = socket.data;
        try {
            // 获取房间状态
            const roomData = yield db_1.redisClient.get(`room:${roomId}`);
            if (!roomData) {
                return callback({
                    success: false,
                    error: 'Room not found',
                    message: socket_1.SOCKET_ERRORS.ROOM_NOT_FOUND
                });
            }
            const roomState = JSON.parse(roomData);
            // 检查是否是房主
            if (roomState.ownerId !== userId) {
                return callback({
                    success: false,
                    error: 'Only room owner can restart game',
                    message: 'Permission denied'
                });
            }
            // 重置房间状态
            roomState.gameStarted = false;
            roomState.status = 'WAITING';
            roomState.gameState = undefined;
            roomState.players.forEach(p => p.isReady = false);
            // 保存房间状态
            yield db_1.redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
            // 发送成功响应
            callback({
                success: true,
                message: 'Game restarted successfully'
            });
            // 广播房间状态更新
            io.to(roomId).emit(socket_1.SOCKET_EVENTS.ROOM_STATE_UPDATE, { roomState });
            console.log(`Game restarted in room ${roomId} by ${socket.data.username}`);
        }
        catch (error) {
            console.error('Error restarting game:', error);
            callback({
                success: false,
                error: 'Internal server error',
                message: socket_1.SOCKET_ERRORS.INTERNAL_ERROR
            });
        }
    }));
}
// 将游戏引擎状态转换为WebSocket格式
function convertGameEngineToWebSocketState(gameEngine, roomId) {
    const engineState = gameEngine.getState();
    return {
        phase: engineState.phase,
        players: engineState.players.map((p) => ({
            id: p.id,
            username: p.username,
            chips: p.chips,
            cards: p.cards.map((card) => card.toString()),
            status: p.status,
            position: p.position,
            totalBet: p.totalBet,
            isConnected: true // 这里假设所有玩家都连接，实际应该从房间状态获取
        })),
        dealerIndex: engineState.dealerIndex,
        smallBlindIndex: engineState.smallBlindIndex,
        bigBlindIndex: engineState.bigBlindIndex,
        currentPlayerIndex: engineState.currentPlayerIndex,
        board: engineState.board.map((card) => card.toString()),
        pot: engineState.pot,
        sidePots: engineState.sidePots.map((sp) => ({
            amount: sp.amount,
            eligiblePlayers: sp.eligiblePlayers
        })),
        currentBet: engineState.currentBet,
        roundBets: engineState.roundBets,
        history: engineState.history.map((h) => ({
            playerId: h.playerId,
            action: {
                type: h.action.type,
                amount: h.action.amount,
                timestamp: h.action.timestamp
            },
            phase: h.phase,
            timestamp: h.timestamp
        })),
        timeout: 30, // 30秒超时
        gameId: engineState.gameId,
        roomId
    };
}
// 转换字符串操作到PlayerAction枚举
function convertStringToPlayerAction(actionType) {
    switch (actionType.toLowerCase()) {
        case 'fold':
            return GameState_1.PlayerAction.FOLD;
        case 'check':
            return GameState_1.PlayerAction.CHECK;
        case 'call':
            return GameState_1.PlayerAction.CALL;
        case 'raise':
            return GameState_1.PlayerAction.RAISE;
        case 'all_in':
        case 'allin':
            return GameState_1.PlayerAction.ALL_IN;
        default:
            return null;
    }
}
// 重建游戏引擎状态
function reconstructGameEngine(gameState) {
    const players = gameState.players.map(p => ({
        id: p.id,
        username: p.username,
        chips: p.chips
    }));
    const gameEngine = new GameState_1.GameState(gameState.gameId);
    // 这里需要根据保存的状态重建游戏引擎
    // 由于游戏引擎的复杂性，这是一个简化版本
    // 实际应用中可能需要在GameEngine中添加状态恢复方法
    return gameEngine;
}
// 生成游戏结果
function generateGameResults(gameEngine) {
    const results = gameEngine.getResults();
    if (!results) {
        return [];
    }
    return results.winners.map((winner) => ({
        playerId: winner.playerId,
        username: winner.playerId, // 这里应该从其他地方获取用户名
        finalCards: winner.hand ? [winner.hand.toString()] : [],
        handRank: winner.hand ? winner.hand.description : 'Unknown',
        chipsWon: winner.winAmount,
        chipsChange: winner.winAmount,
        isWinner: true
    }));
}
// 更新玩家筹码
function updatePlayerChips(results) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const result of results) {
            yield prisma_1.default.user.update({
                where: { id: result.playerId },
                data: {
                    chips: {
                        increment: result.chipsChange
                    }
                }
            });
        }
    });
}
// 记录游戏结果
function recordGameResult(roomId, results) {
    return __awaiter(this, void 0, void 0, function* () {
        const gameRecords = results.map(result => ({
            roomId,
            userId: result.playerId,
            chipsBefore: result.chipsWon - result.chipsChange, // 计算游戏前筹码
            chipsAfter: result.chipsWon,
            chipsChange: result.chipsChange,
            handResult: result.handRank,
            isWinner: result.isWinner,
            gameData: {
                finalCards: result.finalCards,
                handRank: result.handRank
            }
        }));
        yield prisma_1.default.gameRecord.createMany({
            data: gameRecords
        });
    });
}
