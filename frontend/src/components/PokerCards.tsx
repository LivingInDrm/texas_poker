import React from 'react';
import type { Card } from '../types/game';
import { Suit, SUIT_SYMBOLS, RANK_NAMES } from '../types/game';

interface PokerCardProps {
  card: Card;
  isHidden?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const PokerCard: React.FC<PokerCardProps> = ({ 
  card, 
  isHidden = false, 
  size = 'medium',
  className = '' 
}) => {
  const sizeClasses = {
    small: 'w-10 h-14 text-sm',
    medium: 'w-12 h-16 text-lg',
    large: 'w-16 h-24 text-xl'
  };
  
  const centerSymbolSizes = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl'
  };

  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;
  
  if (isHidden) {
    return (
      <div className={`
        ${sizeClasses[size]} 
        bg-blue-600 border border-gray-300 rounded-lg 
        flex items-center justify-center shadow-sm
        ${className}
      `}>
        <div className="text-white font-bold">?</div>
      </div>
    );
  }

  return (
    <div className={`
      ${sizeClasses[size]} 
      bg-white border border-gray-300 rounded-lg 
      flex flex-col items-center justify-center p-1 shadow-sm
      ${isRed ? 'text-red-500' : 'text-black'}
      ${className}
    `}>
      <div className={`font-bold text-center ${centerSymbolSizes[size]} mb-0.5`}>
        {RANK_NAMES[card.rank]}
      </div>
      <div className={`text-center ${centerSymbolSizes[size]} mt-0.5`}>
        {SUIT_SYMBOLS[card.suit]}
      </div>
    </div>
  );
};

interface PokerCardsProps {
  cards: Card[];
  isHidden?: boolean;
  size?: 'small' | 'medium' | 'large';
  spacing?: number;
  className?: string;
}

const PokerCards: React.FC<PokerCardsProps> = ({ 
  cards, 
  isHidden = false, 
  size = 'medium',
  spacing = 8,
  className = '' 
}) => {
  return (
    <div 
      className={`flex ${className}`}
      style={{ gap: `${spacing}px` }}
    >
      {cards.map((card, index) => (
        <PokerCard 
          key={`${card.suit}-${card.rank}-${index}`}
          card={card}
          isHidden={isHidden}
          size={size}
        />
      ))}
    </div>
  );
};

export { PokerCard, PokerCards };