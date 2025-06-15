import React, { useEffect, useState } from 'react';
import { Trophy, Sparkles } from 'lucide-react';

interface WinnerHighlightProps {
  winnerId: string;
  winAmount: number;
  isVisible: boolean;
  duration?: number;
  onAnimationComplete?: () => void;
}

export const WinnerHighlight: React.FC<WinnerHighlightProps> = ({
  winnerId,
  winAmount,
  isVisible,
  duration = 3000,
  onAnimationComplete
}) => {
  const [animationPhase, setAnimationPhase] = useState<'initial' | 'highlighting' | 'fading'>('initial');

  useEffect(() => {
    if (isVisible) {
      setAnimationPhase('highlighting');
      
      const timer = setTimeout(() => {
        setAnimationPhase('fading');
        if (onAnimationComplete) {
          setTimeout(onAnimationComplete, 500);
        }
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setAnimationPhase('initial');
    }
  }, [isVisible, duration, onAnimationComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className={`absolute inset-0 pointer-events-none transition-all duration-500 ${
        animationPhase === 'highlighting' 
          ? 'opacity-100 scale-105' 
          : animationPhase === 'fading'
          ? 'opacity-0 scale-100'
          : 'opacity-0 scale-95'
      }`}
    >
      {/* Golden glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 via-yellow-300/30 to-yellow-400/20 rounded-lg animate-pulse" />
      
      {/* Sparkle effects */}
      <div className="absolute inset-0">
        {[...Array(6)].map((_, i) => (
          <Sparkles
            key={i}
            className={`absolute text-yellow-400 animate-ping h-4 w-4 ${
              i === 0 ? 'top-2 left-2' :
              i === 1 ? 'top-2 right-2' :
              i === 2 ? 'bottom-2 left-2' :
              i === 3 ? 'bottom-2 right-2' :
              i === 4 ? 'top-1/2 left-2' :
              'top-1/2 right-2'
            }`}
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>

      {/* Winner badge */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center space-x-1 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
          <Trophy className="h-4 w-4" />
          <span>获胜者</span>
        </div>
      </div>

      {/* Win amount animation */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="bg-green-500 text-white px-4 py-2 rounded-full text-lg font-bold shadow-lg animate-bounce">
          +{winAmount.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

interface ChipAnimationProps {
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
  amount: number;
  isVisible: boolean;
  onAnimationComplete?: () => void;
}

export const ChipAnimation: React.FC<ChipAnimationProps> = ({
  fromPosition,
  toPosition,
  amount,
  isVisible,
  onAnimationComplete
}) => {
  const [animationStarted, setAnimationStarted] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setAnimationStarted(true);
      const timer = setTimeout(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setAnimationStarted(false);
    }
  }, [isVisible, onAnimationComplete]);

  if (!isVisible) return null;

  const translateX = toPosition.x - fromPosition.x;
  const translateY = toPosition.y - fromPosition.y;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: fromPosition.x,
        top: fromPosition.y,
      }}
    >
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`absolute w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-300 shadow-lg transform transition-all duration-1500 ease-out ${
            animationStarted ? 'translate-x-full translate-y-full opacity-0' : 'opacity-100'
          }`}
          style={{
            transform: animationStarted 
              ? `translate(${translateX}px, ${translateY}px) scale(0.5)` 
              : 'translate(0, 0) scale(1)',
            animationDelay: `${i * 100}ms`,
            left: i * 4,
            top: i * 2,
          }}
        >
          <div className="absolute inset-1 bg-yellow-200 rounded-full opacity-50" />
        </div>
      ))}
      
      {/* Amount text */}
      <div 
        className={`absolute top-10 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-2 py-1 rounded text-sm font-bold transition-all duration-1500 ${
          animationStarted ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        {amount.toLocaleString()}
      </div>
    </div>
  );
};

interface WinnerAnimationSequenceProps {
  winners: Array<{
    playerId: string;
    seatPosition: { x: number; y: number };
    winAmount: number;
  }>;
  potPosition: { x: number; y: number };
  isVisible: boolean;
  onSequenceComplete?: () => void;
}

export const WinnerAnimationSequence: React.FC<WinnerAnimationSequenceProps> = ({
  winners,
  potPosition,
  isVisible,
  onSequenceComplete
}) => {
  const [currentWinnerIndex, setCurrentWinnerIndex] = useState(0);
  const [showChipAnimation, setShowChipAnimation] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setCurrentWinnerIndex(0);
      setShowChipAnimation(false);
      return;
    }

    // 如果没有获胜者，立即调用完成回调
    if (winners.length === 0) {
      if (onSequenceComplete) {
        setTimeout(onSequenceComplete, 50);
      }
      return;
    }

    // 如果已经完成所有winners，调用完成回调
    if (currentWinnerIndex >= winners.length) {
      if (onSequenceComplete) {
        onSequenceComplete();
      }
      return;
    }

    // 每个winner的完整动画周期约3.5秒
    const winnerAnimationDuration = 3500; 
    
    const timer = setTimeout(() => {
      const nextIndex = currentWinnerIndex + 1;
      setCurrentWinnerIndex(nextIndex);
      setShowChipAnimation(false);
      
      // 如果这是最后一个winner，在下一次effect运行时会调用onSequenceComplete
    }, winnerAnimationDuration);

    return () => {
      clearTimeout(timer);
    };
  }, [isVisible, currentWinnerIndex, winners.length, onSequenceComplete]);


  if (!isVisible || currentWinnerIndex >= winners.length) return null;

  const currentWinner = winners[currentWinnerIndex];

  return (
    <>
      {/* Winner highlight at seat position */}
      <div
        className="fixed pointer-events-none z-40"
        style={{
          left: currentWinner.seatPosition.x - 60,
          top: currentWinner.seatPosition.y - 60,
          width: 120,
          height: 120,
        }}
      >
        <WinnerHighlight
          winnerId={currentWinner.playerId}
          winAmount={currentWinner.winAmount}
          isVisible={true}
          duration={2500}
        />
      </div>

      {/* Chip animation from pot to winner */}
      <ChipAnimation
        fromPosition={potPosition}
        toPosition={currentWinner.seatPosition}
        amount={currentWinner.winAmount}
        isVisible={true}
      />
    </>
  );
};