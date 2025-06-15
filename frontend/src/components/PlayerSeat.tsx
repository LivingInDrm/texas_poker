import React from 'react';
import { GamePlayer, PlayerPosition, PlayerStatus, ACTION_NAMES } from '../types/game';
import { PokerCards } from './PokerCards';

interface PlayerSeatProps {
  player: GamePlayer;
  position: PlayerPosition;
  isCurrentPlayer?: boolean;
  showCards?: boolean;
  timeRemaining?: number;
  className?: string;
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({ 
  player, 
  position, 
  isCurrentPlayer = false,
  showCards = false,
  timeRemaining,
  className = '' 
}) => {
  const getStatusColor = () => {
    switch (player.status) {
      case PlayerStatus.ACTIVE:
        return isCurrentPlayer ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white';
      case PlayerStatus.FOLDED:
        return 'border-gray-400 bg-gray-100 opacity-60';
      case PlayerStatus.ALL_IN:
        return 'border-red-500 bg-red-50';
      case PlayerStatus.SITTING_OUT:
        return 'border-gray-400 bg-gray-200 opacity-40';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  const getPositionBadge = () => {
    if (position.isDealer) return { text: 'D', color: 'bg-blue-500 text-white' };
    if (position.isSmallBlind) return { text: 'SB', color: 'bg-yellow-500 text-white' };
    if (position.isBigBlind) return { text: 'BB', color: 'bg-orange-500 text-white' };
    return null;
  };

  const positionBadge = getPositionBadge();

  return (
    <div className={`relative ${className}`}>
      {/* 主要玩家信息卡片 */}
      <div className={`
        relative p-3 rounded-lg border-2 transition-all duration-300
        ${getStatusColor()}
        ${isCurrentPlayer ? 'shadow-lg' : 'shadow-sm'}
      `}>
        {/* 位置标识 */}
        {positionBadge && (
          <div className={`
            absolute -top-2 -left-2 w-8 h-8 rounded-full 
            flex items-center justify-center text-xs font-bold
            ${positionBadge.color}
          `}>
            {positionBadge.text}
          </div>
        )}

        {/* 行动倒计时 */}
        {isCurrentPlayer && timeRemaining && (
          <div className="absolute -top-1 right-2">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${timeRemaining <= 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500 text-white'}
            `}>
              {timeRemaining}
            </div>
          </div>
        )}

        {/* 玩家头像和名称 */}
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-gray-600">
              {player.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-sm font-semibold truncate max-w-20">
              {player.name}
            </div>
            <div className="text-xs text-gray-500">
              ${player.chips.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 手牌 */}
        {player.cards.length > 0 && (
          <div className="mb-2">
            <PokerCards 
              cards={player.cards}
              isHidden={!showCards}
              size="small"
              spacing={4}
            />
          </div>
        )}

        {/* 当前下注和最后行动 */}
        <div className="space-y-1">
          {player.currentBet > 0 && (
            <div className="text-xs">
              <span className="text-gray-500">本轮:</span>
              <span className="font-semibold ml-1">${player.currentBet.toLocaleString()}</span>
            </div>
          )}
          
          {player.totalBet > 0 && (
            <div className="text-xs">
              <span className="text-gray-500">总计:</span>
              <span className="font-semibold ml-1">${player.totalBet.toLocaleString()}</span>
            </div>
          )}

          {player.lastAction && (
            <div className="text-xs">
              <span className={`
                px-2 py-1 rounded text-white text-xs
                ${player.lastAction === 'fold' ? 'bg-red-500' :
                  player.lastAction === 'raise' ? 'bg-green-500' :
                  player.lastAction === 'call' ? 'bg-blue-500' :
                  player.lastAction === 'check' ? 'bg-gray-500' :
                  player.lastAction === 'all_in' ? 'bg-purple-500' : 'bg-gray-400'}
              `}>
                {ACTION_NAMES[player.lastAction]}
              </span>
            </div>
          )}
        </div>

        {/* 状态指示器 */}
        {player.status !== PlayerStatus.ACTIVE && (
          <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
            <span className="text-white text-xs font-bold bg-black bg-opacity-60 px-2 py-1 rounded">
              {player.status === PlayerStatus.FOLDED ? '弃牌' :
               player.status === PlayerStatus.ALL_IN ? '全下' :
               player.status === PlayerStatus.SITTING_OUT ? '暂离' : ''}
            </span>
          </div>
        )}
      </div>

      {/* 下注筹码显示（在座位旁边） */}
      {player.currentBet > 0 && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-md">
            ${player.currentBet.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerSeat;