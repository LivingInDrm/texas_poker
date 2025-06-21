import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameTable from '../components/GameTable';
import ActionPanel from '../components/ActionPanel';
import ActionHistory from '../components/ActionHistory';
import { ResultModal } from '../components/ResultModal';
import { WinnerAnimationSequence } from '../components/WinnerHighlight';
import { AllHandsReveal } from '../components/HandReveal';
import { SoundControl, GameSoundEffects, CelebrationEffects } from '../components/GameEffects';
import { NetworkIndicator } from '../components/NetworkIndicator';
import { ReconnectionHandler } from '../components/ReconnectionHandler';
import { OfflinePlayerIndicator, PlayerStatusBadge } from '../components/OfflinePlayerIndicator';
import { GameSnapshot, GamePhase, PlayerStatus, Suit, Rank, PlayerAction, GameResult } from '../types/game';
import { useSocket } from '../hooks/useSocket';
import { useUserStore } from '../stores/userStore';
import { useGameStore } from '../stores/gameStore';

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  // Store hooks
  const { user } = useUserStore();
  const { currentRoom, gameState, isInGame, getCurrentPlayer, getMyPlayer, canPlayerAct } = useGameStore();
  
  // Socket hooks
  const {
    connected,
    connectionStatus,
    networkQuality,
    connect,
    joinRoom,
    leaveRoom,
    makeGameAction,
    setReady,
    startGame,
    restartGame
  } = useSocket();

  // Local state
  const [gameSnapshot, setGameSnapshot] = useState<GameSnapshot | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showHandReveal, setShowHandReveal] = useState(false);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化和房间加入
  useEffect(() => {
    const initializeGame = async () => {
      if (!roomId || !user) {
        console.log('GamePage: Missing roomId or user, redirecting to lobby');
        navigate('/lobby');
        return;
      }

      console.log('GamePage: Initializing game for room:', roomId);

      // 确保Socket连接
      if (!connected) {
        console.log('GamePage: Socket not connected, attempting to connect...');
        try {
          await connect();
          console.log('GamePage: Successfully connected to socket');
        } catch (error) {
          console.error('GamePage: Failed to connect to socket:', error);
          setError('无法连接到服务器');
          return;
        }
      }

      // 检查是否已经在正确的房间中
      if (currentRoom && currentRoom.id === roomId) {
        console.log('GamePage: Already in the correct room:', roomId);
        setIsJoiningRoom(false);
        return;
      }

      // 加入房间 - 只有在不在房间中或在错误房间中才加入
      setIsJoiningRoom(true);
      try {
        console.log('GamePage: Attempting to join room:', roomId);
        const response = await joinRoom(roomId);
        if (response.success) {
          console.log('GamePage: Successfully joined room:', roomId);
        } else {
          console.error('GamePage: Failed to join room:', response.error);
          setError(response.error || '加入房间失败');
          navigate('/lobby');
          return;
        }
      } catch (error: any) {
        console.error('GamePage: Failed to join room:', error);
        setError(error.message || '加入房间失败');
        navigate('/lobby');
        return;
      } finally {
        setIsJoiningRoom(false);
      }
    };

    initializeGame();
  }, [roomId, user, connected, connect, joinRoom, navigate]);

  // 将Socket游戏状态转换为本地GameSnapshot格式
  useEffect(() => {
    if (!gameState || !currentRoom) {
      setGameSnapshot(null);
      return;
    }

    // 转换游戏状态
    const snapshot: GameSnapshot = {
      gameId: gameState.gameId,
      phase: convertSocketPhaseToLocal(gameState.phase),
      players: gameState.players.map(player => ({
        id: player.id,
        name: player.username,
        chips: player.chips,
        status: convertSocketStatusToLocal(player.status),
        cards: player.cards.map(cardStr => parseCard(cardStr)),
        currentBet: gameState.roundBets[player.id] || 0,
        totalBet: player.totalBet,
        hasActed: true, // 这个需要根据实际逻辑判断
        isReady: currentRoom.players.find(p => p.id === player.id)?.isReady || false,
        lastAction: undefined // 从history中获取最后的action
      })),
      communityCards: gameState.board.map(cardStr => parseCard(cardStr)),
      pots: [
        {
          id: 'main-pot',
          amount: gameState.pot,
          type: 'main',
          eligiblePlayers: gameState.players.map(p => p.id)
        },
        ...gameState.sidePots.map((sidePot, index) => ({
          id: `side-pot-${index}`,
          amount: sidePot.amount,
          type: 'side' as const,
          eligiblePlayers: sidePot.eligiblePlayers
        }))
      ],
      currentPlayerId: gameState.players[gameState.currentPlayerIndex]?.id || null,
      actionHistory: gameState.history.map(action => ({
        playerId: action.playerId,
        action: convertSocketActionToLocal(action.action.type),
        amount: action.action.amount || 0,
        timestamp: action.timestamp.getTime(),
        phase: convertSocketPhaseToLocal(action.phase)
      })),
      isHandInProgress: gameState.phase !== 'ended',
      positions: gameState.players.map((player, index) => ({
        playerId: player.id,
        seatIndex: player.position,
        isDealer: index === gameState.dealerIndex,
        isSmallBlind: index === gameState.smallBlindIndex,
        isBigBlind: index === gameState.bigBlindIndex
      }))
    };

    setGameSnapshot(snapshot);
  }, [gameState, currentRoom]);

  // 处理玩家行动
  const handlePlayerAction = async (action: PlayerAction, amount?: number) => {
    if (!user || !roomId || !canPlayerAct(user.id)) {
      console.warn('Cannot perform action - user not found, no room, or not player turn');
      return;
    }

    try {
      const socketAction = {
        type: convertLocalActionToSocket(action) as 'fold' | 'check' | 'call' | 'raise' | 'allin',
        amount,
        timestamp: new Date()
      };

      const response = await makeGameAction(socketAction as any);
      
      if (!response.success) {
        setError(response.error || '操作失败');
      }
    } catch (error: any) {
      console.error('Failed to make game action:', error);
      setError(error.message || '操作失败');
    }
  };

  // 处理准备状态
  const handleReady = async () => {
    if (!roomId) return;

    try {
      const response = await setReady();
      if (!response.success) {
        setError(response.error || '设置准备状态失败');
      }
    } catch (error: any) {
      console.error('Failed to set ready:', error);
      setError(error.message || '设置准备状态失败');
    }
  };

  // 处理开始游戏
  const handleStartGame = async () => {
    if (!roomId) return;

    try {
      const response = await startGame();
      if (!response.success) {
        setError(response.error || '开始游戏失败');
      }
    } catch (error: any) {
      console.error('Failed to start game:', error);
      setError(error.message || '开始游戏失败');
    }
  };

  // 处理重新开始游戏
  const handleRestartGame = async () => {
    if (!roomId) return;

    try {
      const response = await restartGame();
      if (!response.success) {
        setError(response.error || '重启游戏失败');
      }
    } catch (error: any) {
      console.error('Failed to restart game:', error);
      setError(error.message || '重启游戏失败');
    }
  };

  // 离开房间
  const handleLeaveRoom = async () => {
    if (!roomId) {
      navigate('/lobby');
      return;
    }

    try {
      await leaveRoom(roomId);
      navigate('/lobby');
    } catch (error: any) {
      console.error('Failed to leave room:', error);
      // 即使失败也返回大厅
      navigate('/lobby');
    }
  };

  // 游戏结束时的处理
  useEffect(() => {
    if (gameState?.phase === 'ended') {
      // 触发结算动画序列
      setShowHandReveal(true);
      setTimeout(() => {
        setShowHandReveal(false);
        setShowWinnerAnimation(true);
      }, 3000);
      
      setTimeout(() => {
        setShowWinnerAnimation(false);
        setShowCelebration(true);
      }, 5000);
      
      setTimeout(() => {
        setShowCelebration(false);
        setShowResultModal(true);
      }, 7000);
    }
  }, [gameState?.phase]);

  // 错误处理
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 获取当前玩家信息
  const myPlayer = user ? getMyPlayer(user.id) : null;
  const currentPlayer = getCurrentPlayer();
  const isMyTurn = user ? currentPlayer?.id === user.id : false;
  
  // 检查是否是房主
  const isRoomOwner = user && currentRoom ? currentRoom.ownerId === user.id : false;
  
  // 检查游戏开始条件
  const canStartGame = currentRoom ? 
    currentRoom.players.length >= 2 && 
    currentRoom.players.filter(p => p.id !== currentRoom.ownerId).every(p => p.isReady && p.isConnected) &&
    !currentRoom.gameStarted
    : false;

  // 加载状态
  if (isJoiningRoom) {
    return (
      <div className="min-h-screen bg-green-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">正在进入房间...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (!currentRoom && !isJoiningRoom) {
    console.log('GamePage: No current room and not joining, showing error state');
    return (
      <div className="min-h-screen bg-green-800 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">房间不存在或已关闭</p>
          <p className="text-sm mb-4 opacity-75">房间ID: {roomId}</p>
          <button
            onClick={() => navigate('/lobby')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回大厅
          </button>
        </div>
      </div>
    );
  }

  console.log('GamePage: Rendering with state:', {
    roomId,
    currentRoom: currentRoom?.id,
    gameState: gameState?.gameId,
    isInGame,
    gameSnapshot: !!gameSnapshot,
    isJoiningRoom
  });

  return (
    <div className="min-h-screen bg-green-800 relative overflow-hidden">
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded text-xs z-50">
          <div>Room: {roomId}</div>
          <div>Current Room: {currentRoom?.id || 'None'}</div>
          <div>Game State: {gameState?.gameId || 'None'}</div>
          <div>In Game: {isInGame ? 'Yes' : 'No'}</div>
          <div>Game Snapshot: {gameSnapshot ? 'Available' : 'None'}</div>
          <div>Players: {currentRoom?.players?.length || 0}</div>
        </div>
      )}

      {/* 网络状态指示器 */}
      <div className="absolute top-4 right-4 z-10">
        <NetworkIndicator
          connectionStatus={connectionStatus}
          networkQuality={networkQuality}
          showDetails={false}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
            {error}
          </div>
        </div>
      )}

      {/* 游戏桌面 */}
      {gameSnapshot ? (
        <GameTable
          gameSnapshot={gameSnapshot}
          currentUserId={user?.id || ''}
          onPlayerAction={handlePlayerAction}
          className="h-screen"
        />
      ) : currentRoom ? (
        /* 房间存在但没有游戏快照时显示房间信息 */
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8 text-white text-center max-w-lg">
            <h2 className="text-2xl font-bold mb-4">房间: {currentRoom.id}</h2>
            
            {/* 房间基本信息 */}
            <div className="space-y-2 mb-6">
              <div>玩家: {currentRoom.players.length}/{currentRoom.maxPlayers}</div>
              <div>状态: {currentRoom.status === 'WAITING' ? '等待中' : currentRoom.status === 'PLAYING' ? '游戏中' : '已结束'}</div>
              <div>盲注: {currentRoom.smallBlind}/{currentRoom.bigBlind}</div>
            </div>

            {/* 玩家准备状态 */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">玩家状态</h3>
              <div className="space-y-2">
                {currentRoom.players.map(player => (
                  <div key={player.id} className="flex items-center justify-between bg-white bg-opacity-5 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${player.id === currentRoom.ownerId ? 'text-yellow-300' : ''}`}>
                        {player.username}
                        {player.id === currentRoom.ownerId && ' 👑'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {player.id === currentRoom.ownerId ? (
                        <span className="text-xs text-yellow-300">房主</span>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded ${
                          player.isReady ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                        }`}>
                          {player.isReady ? '✓ 已准备' : '⏳ 等待中'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 游戏开始条件提示 */}
            {!currentRoom.gameStarted && (
              <div className="mb-4">
                <div className="text-sm opacity-75">
                  {currentRoom.players.length < 2 
                    ? '需要至少2名玩家才能开始游戏'
                    : isRoomOwner 
                      ? canStartGame 
                        ? '所有条件已满足，可以开始游戏！'
                        : '等待其他玩家准备完毕'
                      : '等待房主开始游戏'
                  }
                </div>
              </div>
            )}

            <div className="text-sm opacity-75">
              {currentRoom.gameStarted ? '游戏正在加载...' : '等待游戏开始'}
            </div>

            {/* 调试信息 - 开发环境显示 */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-2 bg-black bg-opacity-30 rounded text-xs text-left">
                <div>GameStarted: {currentRoom.gameStarted ? 'Yes' : 'No'}</div>
                <div>IsInGame: {isInGame ? 'Yes' : 'No'}</div>
                <div>GameSnapshot: {gameSnapshot ? 'Available' : 'None'}</div>
                <div>GameState: {gameState ? 'Available' : 'None'}</div>
                <div>Room Status: {currentRoom.status}</div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 操作面板 */}
      {gameSnapshot && isInGame && isMyTurn && (
        <ActionPanel
          gameSnapshot={gameSnapshot}
          currentUserId={user?.id || ''}
          onPlayerAction={handlePlayerAction}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
        />
      )}

      {/* 游戏控制按钮 - 只在游戏未开始且没有游戏快照时显示 */}
      {currentRoom && !gameSnapshot && !isInGame && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex space-x-4">
            {/* 准备按钮 (非房主显示) */}
            {!isRoomOwner && (
              <button
                onClick={handleReady}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  currentRoom.players.find(p => p.id === user?.id)?.isReady
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {currentRoom.players.find(p => p.id === user?.id)?.isReady ? '取消准备' : '准备游戏'}
              </button>
            )}
            
            {/* 开始游戏按钮 (房主显示) */}
            {isRoomOwner && (
              <button
                onClick={handleStartGame}
                disabled={!canStartGame}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  canStartGame
                    ? 'bg-green-600 text-white hover:bg-green-700 transform hover:scale-105 shadow-lg animate-pulse'
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed opacity-50'
                }`}
              >
                {canStartGame ? '🚀 开始游戏' : '等待玩家准备'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 行动历史 */}
      {gameSnapshot && (
        <ActionHistory
          actions={gameSnapshot.actionHistory}
          players={gameSnapshot.players}
          className="absolute top-4 left-4 max-h-64 w-80"
        />
      )}

      {/* 离开房间按钮 */}
      <button
        onClick={handleLeaveRoom}
        className="absolute top-4 left-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 z-10"
      >
        离开房间
      </button>

      {/* 音效控制 - 暂时禁用以修复编译 */}
      {/* <SoundControl
          enabled={soundEnabled}
          onToggle={setSoundEnabled}
          className="absolute bottom-4 left-4"
        /> */}

      {/* 游戏音效 - 暂时禁用以修复编译 */}
      {/* <GameSoundEffects
          enabled={soundEnabled}
          gameSnapshot={gameSnapshot}
        /> */}

      {/* 动画和模态框 - 暂时禁用以修复编译 */}
      {/* {showHandReveal && gameSnapshot && (
        <AllHandsReveal
          players={gameSnapshot.players}
          onComplete={() => setShowHandReveal(false)}
        />
      )}

      {showWinnerAnimation && gameSnapshot && (
        <WinnerAnimationSequence
          gameSnapshot={gameSnapshot}
          onComplete={() => setShowWinnerAnimation(false)}
        />
      )}

      {showCelebration && (
        <CelebrationEffects
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {showResultModal && gameResult && (
        <ResultModal
          result={gameResult}
          onNewGame={handleRestartGame}
          onLeaveLobby={handleLeaveRoom}
          onClose={() => setShowResultModal(false)}
        />
      )} */}

      {/* 重连处理 */}
      <ReconnectionHandler
        connectionStatus={connectionStatus}
        onReconnect={connect}
        autoReconnect={true}
        maxRetries={5}
      />
    </div>
  );
};

// 辅助函数：转换Socket数据格式到本地格式
function convertSocketPhaseToLocal(phase: string): GamePhase {
  switch (phase) {
    case 'waiting': return GamePhase.WAITING;
    case 'preflop': return GamePhase.PRE_FLOP;
    case 'flop': return GamePhase.FLOP;
    case 'turn': return GamePhase.TURN;
    case 'river': return GamePhase.RIVER;
    case 'showdown': return GamePhase.SHOWDOWN;
    case 'ended': return GamePhase.FINISHED;
    default: return GamePhase.WAITING;
  }
}

function convertSocketStatusToLocal(status: string): PlayerStatus {
  switch (status) {
    case 'active': return PlayerStatus.ACTIVE;
    case 'folded': return PlayerStatus.FOLDED;
    case 'allin': return PlayerStatus.ALL_IN;
    case 'away': return PlayerStatus.SITTING_OUT;
    default: return PlayerStatus.ACTIVE;
  }
}

function convertSocketActionToLocal(action: string): PlayerAction {
  switch (action) {
    case 'fold': return PlayerAction.FOLD;
    case 'check': return PlayerAction.CHECK;
    case 'call': return PlayerAction.CALL;
    case 'raise': return PlayerAction.RAISE;
    case 'allin': return PlayerAction.ALL_IN;
    default: return PlayerAction.FOLD;
  }
}

function convertLocalActionToSocket(action: PlayerAction): string {
  switch (action) {
    case PlayerAction.FOLD: return 'fold';
    case PlayerAction.CHECK: return 'check';
    case PlayerAction.CALL: return 'call';
    case PlayerAction.RAISE: return 'raise';
    case PlayerAction.ALL_IN: return 'allin';
    default: return 'fold';
  }
}

function parseCard(cardStr: string): { suit: Suit; rank: Rank } {
  // 简化的卡牌解析，实际应该更健壮
  const rankMap: { [key: string]: Rank } = {
    'A': Rank.ACE, '2': Rank.TWO, '3': Rank.THREE, '4': Rank.FOUR,
    '5': Rank.FIVE, '6': Rank.SIX, '7': Rank.SEVEN, '8': Rank.EIGHT,
    '9': Rank.NINE, 'T': Rank.TEN, 'J': Rank.JACK, 'Q': Rank.QUEEN, 'K': Rank.KING
  };
  
  const suitMap: { [key: string]: Suit } = {
    'S': Suit.SPADES, 'H': Suit.HEARTS, 'D': Suit.DIAMONDS, 'C': Suit.CLUBS
  };

  const rank = rankMap[cardStr[0]] || Rank.ACE;
  const suit = suitMap[cardStr[1]] || Suit.SPADES;

  return { suit, rank };
}

export default GamePage;