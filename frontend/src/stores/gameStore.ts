import { create } from 'zustand';
import { RoomState, GameState, PlayerAction, GameResult } from '../types/socket';

interface GameStoreState {
  // 房间状态（来自Socket）
  currentRoom: RoomState | null;
  
  // 游戏状态（来自Socket）
  gameState: GameState | null;
  
  // 游戏结果
  gameResults: GameResult[] | null;
  
  // UI状态
  isInGame: boolean;
  isGameStarted: boolean;
  isMyTurn: boolean;
  currentPlayerId: string | null;
  
  // 最近的玩家行动
  recentActions: Array<{
    playerId: string;
    action: PlayerAction;
    timestamp: Date;
  }>;
  
  // Actions
  setRoomState: (roomState: RoomState | null) => void;
  setGameState: (gameState: GameState | null) => void;
  updatePlayerAction: (playerId: string, action: PlayerAction) => void;
  endGame: (results: GameResult[]) => void;
  resetGameState: () => void;
  
  // Getters
  getCurrentPlayer: () => any | null;
  getPlayer: (playerId: string) => any | null;
  getMyPlayer: (userId: string) => any | null;
  isPlayerTurn: (playerId: string) => boolean;
  canPlayerAct: (playerId: string) => boolean;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  // Initial state
  currentRoom: null,
  gameState: null,
  gameResults: null,
  isInGame: false,
  isGameStarted: false,
  isMyTurn: false,
  currentPlayerId: null,
  recentActions: [],

  // Actions
  setRoomState: (roomState: RoomState | null) => {
    set({
      currentRoom: roomState,
      isInGame: roomState?.gameStarted || false,
      isGameStarted: roomState?.gameStarted || false,
    });

    // 如果房间状态包含游戏状态，同时更新游戏状态
    if (roomState?.gameState) {
      get().setGameState(roomState.gameState);
    }
  },

  setGameState: (gameState: GameState | null) => {
    if (!gameState) {
      console.log('🗂️ GameStore: Clearing game state');
      set({
        gameState: null,
        isInGame: false,
        isMyTurn: false,
        currentPlayerId: null,
      });
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    console.log('🗂️ GameStore: Setting game state:', {
      gameId: gameState.gameId,
      phase: gameState.phase,
      playersCount: gameState.players.length,
      currentPlayerId: currentPlayer?.id,
      isInGame: true
    });
    
    set({
      gameState,
      isInGame: true,
      currentPlayerId: currentPlayer?.id || null,
      isMyTurn: false, // 这个会在组件中根据userId判断
    });
  },

  updatePlayerAction: (playerId: string, action: PlayerAction) => {
    const state = get();
    
    // 添加到最近行动列表
    const newAction = {
      playerId,
      action,
      timestamp: new Date(),
    };
    
    set({
      recentActions: [newAction, ...state.recentActions].slice(0, 10), // 保留最近10个行动
    });
  },

  endGame: (results: GameResult[]) => {
    set({
      gameResults: results,
      isInGame: false,
      isGameStarted: false,
      isMyTurn: false,
      currentPlayerId: null,
    });
  },

  resetGameState: () => {
    set({
      gameState: null,
      gameResults: null,
      isInGame: false,
      isGameStarted: false,
      isMyTurn: false,
      currentPlayerId: null,
      recentActions: [],
    });
  },

  // Getters
  getCurrentPlayer: () => {
    const state = get();
    if (!state.gameState) return null;
    
    return state.gameState.players[state.gameState.currentPlayerIndex] || null;
  },

  getPlayer: (playerId: string) => {
    const state = get();
    if (!state.gameState) return null;
    
    return state.gameState.players.find(p => p.id === playerId) || null;
  },

  getMyPlayer: (userId: string) => {
    const state = get();
    if (!state.gameState) return null;
    
    return state.gameState.players.find(p => p.id === userId) || null;
  },

  isPlayerTurn: (playerId: string) => {
    const state = get();
    return state.currentPlayerId === playerId;
  },

  canPlayerAct: (playerId: string) => {
    const state = get();
    if (!state.gameState || !state.isInGame) return false;
    
    const player = get().getPlayer(playerId);
    if (!player) return false;
    
    return (
      state.currentPlayerId === playerId &&
      player.status === 'active' &&
      player.isConnected
    );
  },
}));