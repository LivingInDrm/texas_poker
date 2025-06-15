import React, { useState, useEffect } from 'react';
import { GameSnapshot, GamePhase, PHASE_NAMES, Card } from '../types/game';
import PlayerSeat from './PlayerSeat';
import { PokerCards } from './PokerCards';
import PotDisplay from './PotDisplay';

interface GameTableProps {
  gameSnapshot: GameSnapshot;
  currentUserId: string;
  onPlayerAction?: (action: string, amount?: number) => void;
  className?: string;
}

const GameTable: React.FC<GameTableProps> = ({ 
  gameSnapshot, 
  currentUserId,
  onPlayerAction = () => {}, // Default no-op function
  className = '' 
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // 计算当前玩家的操作倒计时
  useEffect(() => {
    if (!gameSnapshot.currentPlayerId) {
      setTimeRemaining(null);
      return;
    }

    const currentPlayer = gameSnapshot.players.find(p => p.id === gameSnapshot.currentPlayerId);
    if (!currentPlayer?.timeoutAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.ceil((currentPlayer.timeoutAt! - Date.now()) / 1000);
      setTimeRemaining(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [gameSnapshot.currentPlayerId, gameSnapshot.players]);

  // 生成座位布局（支持2-9人）
  const generateSeatLayout = () => {
    const players = gameSnapshot.players;
    const playerCount = players.length;
    
    // 为每个玩家计算座位位置（椭圆形布局）
    const seats = players.map((player, index) => {
      const position = gameSnapshot.positions.find(p => p.playerId === player.id);
      if (!position) return null;

      // 计算座位角度（从底部中央开始，顺时针排列）
      const angle = (index / playerCount) * 2 * Math.PI - Math.PI / 2;
      const radiusX = 40; // 椭圆宽度百分比
      const radiusY = 25; // 椭圆高度百分比
      
      const x = 50 + radiusX * Math.cos(angle);
      const y = 50 + radiusY * Math.sin(angle);

      return {
        player,
        position,
        style: {
          left: `${x}%`,
          top: `${y}%`,
          transform: 'translate(-50%, -50%)'
        }
      };
    }).filter(Boolean);

    return seats;
  };

  const seats = generateSeatLayout();
  const isCurrentUserTurn = gameSnapshot.currentPlayerId === currentUserId;
  
  // Debug logging for onPlayerAction usage
  React.useEffect(() => {
    if (onPlayerAction !== undefined) {
      console.debug('onPlayerAction handler provided');
    }
  }, [onPlayerAction]);

  // 社区牌动画效果
  const getCommunityCardsForPhase = (): Card[] => {
    switch (gameSnapshot.phase) {
      case GamePhase.PRE_FLOP:
        return [];
      case GamePhase.FLOP:
        return gameSnapshot.communityCards.slice(0, 3);
      case GamePhase.TURN:
        return gameSnapshot.communityCards.slice(0, 4);
      case GamePhase.RIVER:
      case GamePhase.SHOWDOWN:
      case GamePhase.FINISHED:
        return gameSnapshot.communityCards;
      default:
        return [];
    }
  };

  const communityCards = getCommunityCardsForPhase();

  return (
    <div className={`relative w-full h-full min-h-[600px] ${className}`}>
      {/* 游戏桌面背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-700 to-green-900 rounded-3xl shadow-2xl">
        {/* 桌面椭圆形内部 */}
        <div className="absolute inset-8 bg-green-800 rounded-full border-4 border-yellow-600 shadow-inner">
          
          {/* 中央区域 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
            
            {/* 游戏阶段显示 */}
            <div className="text-center">
              <div className="text-yellow-300 text-lg font-bold">
                {PHASE_NAMES[gameSnapshot.phase]}
              </div>
              {gameSnapshot.phase !== GamePhase.WAITING && (
                <div className="text-yellow-200 text-sm">
                  第 {gameSnapshot.actionHistory.length + 1} 手
                </div>
              )}
            </div>

            {/* 社区牌 */}
            {communityCards.length > 0 && (
              <div className="flex flex-col items-center space-y-2">
                <div className="text-yellow-300 text-sm">公共牌</div>
                <div className="animate-fadeIn">
                  <PokerCards 
                    cards={communityCards}
                    size="medium"
                    spacing={8}
                  />
                </div>
              </div>
            )}

            {/* 底池显示 */}
            <PotDisplay pots={gameSnapshot.pots} />

            {/* 当前行动提示 */}
            {isCurrentUserTurn && gameSnapshot.phase !== GamePhase.WAITING && (
              <div className="text-center">
                <div className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold animate-pulse">
                  轮到你行动了！
                </div>
                {timeRemaining && timeRemaining > 0 && (
                  <div className="text-yellow-300 text-sm mt-1">
                    剩余时间: {timeRemaining}秒
                  </div>
                )}
              </div>
            )}

            {/* 等待其他玩家 */}
            {gameSnapshot.currentPlayerId && !isCurrentUserTurn && gameSnapshot.phase !== GamePhase.WAITING && (
              <div className="text-center">
                <div className="text-yellow-300 text-sm">
                  等待 {gameSnapshot.players.find(p => p.id === gameSnapshot.currentPlayerId)?.name} 行动...
                </div>
              </div>
            )}

            {/* 等待游戏开始 */}
            {gameSnapshot.phase === GamePhase.WAITING && (
              <div className="text-center">
                <div className="text-yellow-300 text-lg">等待玩家准备...</div>
                <div className="text-yellow-200 text-sm mt-2">
                  已准备: {gameSnapshot.players.filter(p => p.isReady).length} / {gameSnapshot.players.length}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 玩家座位 */}
        {seats.map((seat) => (
          <div
            key={seat!.player.id}
            className="absolute"
            style={seat!.style}
          >
            <PlayerSeat
              player={seat!.player}
              position={seat!.position}
              isCurrentPlayer={seat!.player.id === gameSnapshot.currentPlayerId}
              showCards={seat!.player.id === currentUserId || gameSnapshot.phase === GamePhase.SHOWDOWN}
              timeRemaining={seat!.player.id === gameSnapshot.currentPlayerId ? timeRemaining || undefined : undefined}
              className="w-32"
            />
          </div>
        ))}

        {/* 游戏信息面板 */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
          <div className="text-sm space-y-1">
            <div>房间: {gameSnapshot.gameId}</div>
            <div>玩家: {gameSnapshot.players.length}/9</div>
            {gameSnapshot.isHandInProgress && (
              <div>第 {gameSnapshot.actionHistory.length + 1} 轮行动</div>
            )}
          </div>
        </div>

        {/* 最近行动历史 */}
        {gameSnapshot.actionHistory.length > 0 && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-lg max-w-48">
            <div className="text-sm font-bold mb-2">最近行动</div>
            <div className="space-y-1 text-xs max-h-24 overflow-y-auto">
              {gameSnapshot.actionHistory.slice(-3).map((action, index) => {
                const player = gameSnapshot.players.find(p => p.id === action.playerId);
                return (
                  <div key={index} className="text-gray-300">
                    {player?.name}: {action.action}
                    {action.amount > 0 && ` $${action.amount.toLocaleString()}`}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default GameTable;