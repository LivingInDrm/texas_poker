import React, { useState, useEffect } from 'react';
import { Card } from '../types/game';
import { PokerCard } from './PokerCards';

interface AnimatedCardProps {
  card: Card;
  isHidden?: boolean;
  size?: 'small' | 'medium' | 'large';
  delay?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  onAnimationComplete?: () => void;
  className?: string;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  card,
  isHidden = false,
  size = 'medium',
  delay = 0,
  from = { x: 0, y: 0 },
  to = { x: 0, y: 0 },
  onAnimationComplete,
  className = ''
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(from);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPosition(to);
      setTimeout(() => {
        setIsAnimating(false);
        onAnimationComplete?.();
      }, 600); // Animation duration
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, to, onAnimationComplete]);

  return (
    <div
      className={`absolute transition-all duration-600 ease-out ${className}`}
      style={{
        transform: `translate(${currentPosition.x}px, ${currentPosition.y}px)`,
        zIndex: isAnimating ? 50 : 10,
      }}
    >
      <PokerCard 
        card={card}
        isHidden={isHidden}
        size={size}
      />
    </div>
  );
};

interface DealingAnimationProps {
  cards: Card[];
  playerPositions: Array<{ x: number; y: number }>;
  deckPosition?: { x: number; y: number };
  onComplete?: () => void;
}

const DealingAnimation: React.FC<DealingAnimationProps> = ({
  cards,
  playerPositions,
  deckPosition = { x: 0, y: 0 },
  onComplete
}) => {
  const [completedAnimations, setCompletedAnimations] = useState(0);

  const handleAnimationComplete = () => {
    setCompletedAnimations(prev => {
      const newCount = prev + 1;
      if (newCount >= cards.length && onComplete) {
        setTimeout(onComplete, 100);
      }
      return newCount;
    });
  };

  // Log animation progress for debugging
  React.useEffect(() => {
    console.debug('Dealing animation progress:', completedAnimations, '/', cards.length);
  }, [completedAnimations, cards.length]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {cards.map((card, index) => {
        const playerIndex = Math.floor(index / 2); // 每个玩家2张牌
        const cardIndex = index % 2; // 第几张牌
        const targetPosition = playerPositions[playerIndex];
        
        return (
          <AnimatedCard
            key={`deal-${index}`}
            card={card}
            isHidden={true}
            size="small"
            delay={index * 200} // 每张牌间隔200ms
            from={deckPosition}
            to={{ 
              x: targetPosition.x + (cardIndex * 20), 
              y: targetPosition.y 
            }}
            onAnimationComplete={handleAnimationComplete}
          />
        );
      })}
    </div>
  );
};

interface CommunityCardAnimationProps {
  cards: Card[];
  targetPositions: Array<{ x: number; y: number }>;
  deckPosition?: { x: number; y: number };
  onComplete?: () => void;
}

const CommunityCardAnimation: React.FC<CommunityCardAnimationProps> = ({
  cards,
  targetPositions,
  deckPosition = { x: 0, y: 0 },
  onComplete
}) => {
  const [completedAnimations, setCompletedAnimations] = useState(0);

  const handleAnimationComplete = () => {
    setCompletedAnimations(prev => {
      const newCount = prev + 1;
      if (newCount >= cards.length && onComplete) {
        setTimeout(onComplete, 100);
      }
      return newCount;
    });
  };

  // Log animation progress for debugging
  React.useEffect(() => {
    console.debug('Community card animation progress:', completedAnimations, '/', cards.length);
  }, [completedAnimations, cards.length]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {cards.map((card, index) => (
        <AnimatedCard
          key={`community-${index}`}
          card={card}
          isHidden={false}
          size="medium"
          delay={index * 300}
          from={deckPosition}
          to={targetPositions[index]}
          onAnimationComplete={handleAnimationComplete}
        />
      ))}
    </div>
  );
};

export { AnimatedCard, DealingAnimation, CommunityCardAnimation };