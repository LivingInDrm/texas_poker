import React from 'react';
import type { Pot } from '../types/game';

interface PotDisplayProps {
  pots: Pot[];
  className?: string;
}

const PotDisplay: React.FC<PotDisplayProps> = ({ pots, className = '' }) => {
  const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
  
  if (totalPot === 0) {
    return (
      <div className={`text-center ${className}`}>
        <div className="bg-gray-100 rounded-lg p-3">
          <div className="text-sm text-gray-500">底池</div>
          <div className="text-lg font-bold text-gray-700">$0</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      <div className="bg-yellow-100 rounded-lg p-3 border border-yellow-300">
        <div className="text-sm text-yellow-700 mb-1">底池</div>
        
        {/* 主池显示 */}
        <div className="text-xl font-bold text-yellow-800 mb-2">
          ${totalPot.toLocaleString()}
        </div>
        
        {/* 分池详情（如果有多个池子） */}
        {pots.length > 1 && (
          <div className="space-y-1">
            {pots.map((pot, index) => (
              <div key={pot.id} className="text-xs text-yellow-600">
                {pot.type === 'main' ? '主池' : `边池${index}`}: ${pot.amount.toLocaleString()}
                {pot.eligiblePlayers.length < 4 && (
                  <span className="ml-1">({pot.eligiblePlayers.length}人)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PotDisplay;