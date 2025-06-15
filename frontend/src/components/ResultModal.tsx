import React from 'react';
import { X, Trophy, Users, TrendingUp } from 'lucide-react';
import { PokerCards } from './PokerCards';
import { GameResult, GamePlayer, SUIT_SYMBOLS, RANK_NAMES } from '../types/game';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameResult: GameResult | null;
  players: GamePlayer[];
  onNextGame: () => void;
  onBackToLobby: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  gameResult,
  players,
  onNextGame,
  onBackToLobby
}) => {
  if (!isOpen || !gameResult) return null;

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

  const formatCardDisplay = (suit: string, rank: number) => {
    const suitMap: Record<string, string> = {
      'SPADES': '♠',
      'HEARTS': '♥',
      'DIAMONDS': '♦',
      'CLUBS': '♣'
    };
    const rankMap: Record<number, string> = {
      2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
      11: 'J', 12: 'Q', 13: 'K', 14: 'A'
    };
    return `${rankMap[rank]}${suitMap[suit]}`;
  };

  const getPlayerById = (playerId: string) => 
    players.find(p => p.id === playerId);

  const sortedWinners = [...gameResult.winners].sort((a, b) => b.winAmount - a.winAmount);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <h2 className="text-xl font-bold text-gray-900">游戏结算</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Winners Section */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-center space-x-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span>获胜者</span>
            </h3>
            
            <div className="space-y-4">
              {sortedWinners.map((winner, index) => {
                const player = getPlayerById(winner.playerId);
                if (!player) return null;

                return (
                  <div
                    key={winner.playerId}
                    className={`p-4 rounded-lg border-2 ${
                      index === 0 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {index === 0 && (
                          <Trophy className="h-5 w-5 text-yellow-500" />
                        )}
                        <span className="font-semibold text-lg">{player.name}</span>
                        {index === 0 && (
                          <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                            冠军
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          +{winner.winAmount.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">筹码</div>
                      </div>
                    </div>

                    {/* Hand Cards and Type */}
                    {winner.hand && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex space-x-1">
                            {winner.hand.cards.map((card, cardIndex) => (
                              <div
                                key={cardIndex}
                                className="w-8 h-11 bg-white border border-gray-300 rounded flex items-center justify-center text-xs font-bold"
                                style={{
                                  color: ['HEARTS', 'DIAMONDS'].includes(card.suit) ? '#dc2626' : '#000'
                                }}
                              >
                                {formatCardDisplay(card.suit, card.rank)}
                              </div>
                            ))}
                          </div>
                          <div className="text-sm">
                            <div className="font-semibold">{formatHandType(winner.hand.type)}</div>
                            <div className="text-gray-500">{winner.hand.name}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Players Summary */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span>所有玩家</span>
            </h3>
            
            <div className="space-y-3">
              {players.map((player) => {
                const winner = gameResult.winners.find(w => w.playerId === player.id);
                const chipChange = winner ? winner.winAmount : 0;
                const finalChips = player.chips + chipChange;

                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{player.name}</span>
                      {player.status === 'folded' && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                          已弃牌
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {/* Hand Cards (if not folded) */}
                      {player.status !== 'folded' && player.cards.length > 0 && (
                        <div className="flex space-x-1">
                          {player.cards.map((card, cardIndex) => (
                            <div
                              key={cardIndex}
                              className="w-6 h-8 bg-white border border-gray-300 rounded flex items-center justify-center text-xs"
                              style={{
                                color: ['HEARTS', 'DIAMONDS'].includes(card.suit) ? '#dc2626' : '#000'
                              }}
                            >
                              {formatCardDisplay(card.suit, card.rank)}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Chip Change */}
                      <div className="text-right">
                        <div className={`font-semibold ${
                          chipChange > 0 ? 'text-green-600' : 
                          chipChange < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {chipChange > 0 ? '+' : ''}{chipChange.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          总计: {finalChips.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pot Distribution */}
          {gameResult.pots.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span>奖池分配</span>
              </h3>
              
              <div className="space-y-2">
                {gameResult.pots.map((pot) => (
                  <div key={pot.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium">
                      {pot.id === 'main' ? '主池' : `边池 ${pot.id}`}
                    </span>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        {pot.amount.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        获得者: {pot.winnerIds.map(id => getPlayerById(id)?.name).filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-center space-x-4 p-6 border-t bg-gray-50">
          <button
            onClick={onNextGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            再来一局
          </button>
          <button
            onClick={onBackToLobby}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
};