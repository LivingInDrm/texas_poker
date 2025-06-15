import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PokerCards } from './PokerCards';
import { Card, HandRank, SUIT_SYMBOLS, RANK_NAMES } from '../types/game';

interface HandRevealProps {
  playerId: string;
  cards: Card[];
  hand?: HandRank | null;
  isWinner?: boolean;
  isVisible: boolean;
  animationDelay?: number;
  onRevealComplete?: () => void;
}

export const HandReveal: React.FC<HandRevealProps> = ({
  playerId,
  cards,
  hand,
  isWinner = false,
  isVisible,
  animationDelay = 0,
  onRevealComplete
}) => {
  const [showCards, setShowCards] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  useEffect(() => {
    if (isVisible) {
      const startTimer = setTimeout(() => {
        setShowCards(true);
        revealCardsSequentially();
      }, animationDelay);

      return () => clearTimeout(startTimer);
    } else {
      setShowCards(false);
      setCurrentCardIndex(0);
    }
  }, [isVisible, animationDelay]);

  const revealCardsSequentially = () => {
    if (cards.length === 0) {
      // 如果没有卡片，直接调用完成回调
      if (onRevealComplete) {
        setTimeout(onRevealComplete, 100);
      }
      return;
    }

    const revealNextCard = (index: number) => {
      if (index < cards.length) {
        setCurrentCardIndex(index + 1);
        setTimeout(() => revealNextCard(index + 1), 300);
      } else {
        if (onRevealComplete) {
          setTimeout(onRevealComplete, 500);
        }
      }
    };

    revealNextCard(0);
  };

  const formatHandType = (handType: string) => {
    const handTypes: Record<string, string> = {
      'high_card': '高牌',
      'pair': '一对',
      'two_pair': '两对',
      'three_of_a_kind': '三条',
      'straight': '顺子',
      'flush': '同花',
      'full_house': '葫芦',
      'four_of_a_kind': '四条',
      'straight_flush': '同花顺',
      'royal_flush': '皇家同花顺'
    };
    return handTypes[handType] || handType;
  };

  const getHandDescription = (handType: string, handName: string) => {
    const descriptions: Record<string, string> = {
      'high_card': '最高牌决定胜负',
      'pair': '一对相同点数的牌',
      'two_pair': '两对不同点数的对子',
      'three_of_a_kind': '三张相同点数的牌',
      'straight': '五张连续点数的牌',
      'flush': '五张相同花色的牌',
      'full_house': '三条加一对',
      'four_of_a_kind': '四张相同点数的牌',
      'straight_flush': '同花色的连续五张牌',
      'royal_flush': '同花色的A-K-Q-J-10'
    };
    return descriptions[handType] || handName;
  };

  if (!isVisible || !showCards) return null;

  return (
    <div className="relative">
      {/* Card reveal animation */}
      <div className="flex space-x-1 mb-2">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`transform transition-all duration-300 ${
              index < currentCardIndex 
                ? 'scale-100 opacity-100 translate-y-0' 
                : 'scale-95 opacity-60 translate-y-2'
            }`}
          >
            <PokerCards
              cards={[card]}
              size="small"
              showCards={index < currentCardIndex}
              highlighted={hand?.cards.some(hCard => 
                hCard.suit === card.suit && hCard.rank === card.rank
              )}
            />
          </div>
        ))}
      </div>

      {/* Hand information */}
      {hand && currentCardIndex >= cards.length && (
        <div 
          className={`text-center transition-all duration-500 transform ${
            isWinner 
              ? 'scale-105 text-yellow-600 font-bold' 
              : 'scale-100 text-gray-700'
          }`}
        >
          <div className={`text-sm font-semibold ${
            isWinner ? 'text-yellow-700' : 'text-gray-800'
          }`}>
            {formatHandType(hand.type)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {getHandDescription(hand.type, hand.name)}
          </div>
          
          {/* Winner indicator */}
          {isWinner && (
            <div className="mt-2 inline-flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
              <Eye className="h-3 w-3" />
              <span>最佳牌型</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface AllHandsRevealProps {
  players: Array<{
    id: string;
    name: string;
    cards: Card[];
    hand?: HandRank | null;
    isWinner?: boolean;
    status: string;
  }>;
  isVisible: boolean;
  onRevealComplete?: () => void;
}

export const AllHandsReveal: React.FC<AllHandsRevealProps> = ({
  players,
  isVisible,
  onRevealComplete
}) => {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [revealStarted, setRevealStarted] = useState(false);

  const activePlayers = players.filter(p => p.status !== 'folded' && p.cards.length > 0);

  useEffect(() => {
    if (isVisible && !revealStarted) {
      setRevealStarted(true);
      setCurrentPlayerIndex(0);
    } else if (!isVisible) {
      setRevealStarted(false);
      setCurrentPlayerIndex(0);
    }
  }, [isVisible, revealStarted]);

  // 专门处理空玩家情况的useEffect
  useEffect(() => {
    if (isVisible && revealStarted && activePlayers.length === 0) {
      if (onRevealComplete) {
        const timer = setTimeout(onRevealComplete, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, revealStarted, activePlayers.length, onRevealComplete]);

  const handlePlayerRevealComplete = () => {
    const nextIndex = currentPlayerIndex + 1;
    if (nextIndex < activePlayers.length) {
      setTimeout(() => {
        setCurrentPlayerIndex(nextIndex);
      }, 500);
    } else {
      // 所有玩家都已展示完成
      if (onRevealComplete) {
        setTimeout(onRevealComplete, 1000);
      }
    }
  };

  if (!isVisible || !revealStarted || activePlayers.length === 0) return null;

  return (
    <div className="space-y-4">
      {activePlayers.map((player, index) => (
        <div
          key={player.id}
          className={`p-4 rounded-lg border transition-all duration-300 ${
            index === currentPlayerIndex 
              ? 'bg-blue-50 border-blue-200 shadow-md' 
              : index < currentPlayerIndex 
              ? 'bg-gray-50 border-gray-200' 
              : 'bg-white border-gray-100 opacity-50'
          } ${
            player.isWinner ? 'ring-2 ring-yellow-400' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className={`font-semibold ${
              player.isWinner ? 'text-yellow-700' : 'text-gray-800'
            }`}>
              {player.name}
              {player.isWinner && (
                <span className="ml-2 px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                  获胜者
                </span>
              )}
            </h4>
            
            {index <= currentPlayerIndex && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Eye className="h-4 w-4" />
                <span>摊牌</span>
              </div>
            )}
          </div>

          {index <= currentPlayerIndex && (
            <HandReveal
              playerId={player.id}
              cards={player.cards}
              hand={player.hand}
              isWinner={player.isWinner}
              isVisible={true}
              animationDelay={index === currentPlayerIndex ? 200 : 0}
              onRevealComplete={index === currentPlayerIndex ? handlePlayerRevealComplete : undefined}
            />
          )}
        </div>
      ))}
    </div>
  );
};

interface HandComparisonProps {
  hands: Array<{
    playerId: string;
    playerName: string;
    hand: HandRank;
    isWinner: boolean;
  }>;
  isVisible: boolean;
}

export const HandComparison: React.FC<HandComparisonProps> = ({
  hands,
  isVisible
}) => {
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setShowComparison(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowComparison(false);
    }
  }, [isVisible]);

  if (!isVisible || !showComparison) return null;

  const sortedHands = [...hands].sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    return b.hand.rank - a.hand.rank;
  });

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-center">牌型对比</h3>
      
      <div className="space-y-3">
        {sortedHands.map((hand, index) => (
          <div
            key={hand.playerId}
            className={`flex items-center justify-between p-3 rounded-lg ${
              hand.isWinner 
                ? 'bg-yellow-100 border-2 border-yellow-300' 
                : 'bg-white border border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                hand.isWinner 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-gray-300 text-gray-700'
              }`}>
                {index + 1}
              </div>
              <span className="font-medium">{hand.playerName}</span>
            </div>
            
            <div className="text-right">
              <div className={`font-semibold ${
                hand.isWinner ? 'text-yellow-700' : 'text-gray-700'
              }`}>
                {hand.hand.name}
              </div>
              <div className="text-sm text-gray-500">
                等级: {hand.hand.rank}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};