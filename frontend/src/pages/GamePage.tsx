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
        navigate('/lobby');
        return;
      }

      // 确保Socket连接
      if (!connected) {
        try {
          await connect();
        } catch (error) {
          console.error('Failed to connect to socket:', error);
          setError('无法连接到服务器');
          return;
        }
      }

      // 加入房间
      if (!currentRoom || currentRoom.id !== roomId) {
        setIsJoiningRoom(true);
        try {
          await joinRoom(roomId);
        } catch (error: any) {
          console.error('Failed to join room:', error);
          setError(error.message || '加入房间失败');
          navigate('/lobby');
          return;
        } finally {
          setIsJoiningRoom(false);
        }
      }
    };

    initializeGame();
  }, [roomId, user, connected, currentRoom, connect, joinRoom, navigate]);

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
        type: convertLocalActionToSocket(action),
        amount,
        timestamp: new Date()
      };

      const response = await makeGameAction(socketAction);
      
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
  if (!currentRoom) {
    return (
      <div className="min-h-screen bg-green-800 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">房间不存在或已关闭</p>
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

  return (
    <div className="min-h-screen bg-green-800 relative overflow-hidden">
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
      {gameSnapshot && (
        <GameTable
          gameSnapshot={gameSnapshot}
          currentUserId={user?.id || ''}
          onPlayerAction={handlePlayerAction}
          className="h-screen"
        />
      )}

      {/* 操作面板 */}
      {gameSnapshot && isInGame && isMyTurn && (
        <ActionPanel
          currentBet={gameSnapshot.currentPlayerId ? 
            gameSnapshot.players.find(p => p.id === gameSnapshot.currentPlayerId)?.currentBet || 0 : 0
          }
          maxBet={myPlayer?.chips || 0}
          minRaise={Math.max(...gameSnapshot.players.map(p => p.currentBet)) + 10}
          onAction={handlePlayerAction}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
        />
      )}

      {/* 准备按钮 */}
      {currentRoom && !isInGame && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <button
            onClick={handleReady}
            className={`px-6 py-3 rounded-lg font-medium ${
              currentRoom.players.find(p => p.id === user?.id)?.isReady
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {currentRoom.players.find(p => p.id === user?.id)?.isReady ? '已准备' : '准备'}
          </button>
        </div>
      )}

      {/* 行动历史 */}
      {gameSnapshot && (
        <ActionHistory
          actions={gameSnapshot.actionHistory}
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

      {/* 音效控制 */}
      <SoundControl
        enabled={soundEnabled}
        onToggle={setSoundEnabled}
        className="absolute bottom-4 left-4"
      />

      {/* 游戏音效 */}
      <GameSoundEffects
        enabled={soundEnabled}
        gameSnapshot={gameSnapshot}
      />

      {/* 动画和模态框 */}
      {showHandReveal && gameSnapshot && (
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
      )}

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
    case 'ended': return GamePhase.ENDED;
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