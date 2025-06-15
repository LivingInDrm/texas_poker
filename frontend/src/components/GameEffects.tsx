import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX, Zap, Star } from 'lucide-react';

interface SoundEffectProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const SoundControl: React.FC<SoundEffectProps> = ({
  soundEnabled,
  onToggleSound
}) => {
  return (
    <button
      onClick={onToggleSound}
      className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      title={soundEnabled ? '关闭音效' : '开启音效'}
    >
      {soundEnabled ? (
        <Volume2 className="h-4 w-4 text-blue-600" />
      ) : (
        <VolumeX className="h-4 w-4 text-gray-400" />
      )}
      <span className="text-sm">{soundEnabled ? '音效开' : '音效关'}</span>
    </button>
  );
};

interface GameSoundEffectsProps {
  enabled: boolean;
}

export const GameSoundEffects: React.FC<GameSoundEffectsProps> = ({ enabled }) => {
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, [enabled]);

  return null;
};

interface ConfettiEffectProps {
  isVisible: boolean;
  duration?: number;
  onComplete?: () => void;
}

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({
  isVisible,
  duration = 3000,
  onComplete
}) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    rotationSpeed: number;
  }>>([]);

  useEffect(() => {
    if (isVisible) {
      // Generate confetti particles
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][Math.floor(Math.random() * 6)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      }));

      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
        if (onComplete) onComplete();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [isVisible, duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-pulse"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg)`,
            transition: 'transform 3s linear',
            animationDuration: `${duration}ms`,
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards'
          }}
        />
      ))}
    </div>
  );
};

interface FlashEffectProps {
  isVisible: boolean;
  color?: string;
  duration?: number;
}

export const FlashEffect: React.FC<FlashEffectProps> = ({
  isVisible,
  color = 'white',
  duration = 300
}) => {
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  if (!showFlash) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-300"
      style={{
        backgroundColor: color,
        opacity: showFlash ? 0.3 : 0,
      }}
    />
  );
};

interface PulseEffectProps {
  children: React.ReactNode;
  isActive: boolean;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export const PulseEffect: React.FC<PulseEffectProps> = ({
  children,
  isActive,
  color = 'blue',
  intensity = 'medium'
}) => {
  const intensityClasses = {
    low: 'animate-pulse',
    medium: 'animate-pulse scale-105',
    high: 'animate-bounce scale-110'
  };

  const colorClasses = {
    blue: 'shadow-blue-400',
    green: 'shadow-green-400',
    yellow: 'shadow-yellow-400',
    red: 'shadow-red-400'
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isActive 
          ? `${intensityClasses[intensity]} shadow-lg ${colorClasses[color as keyof typeof colorClasses] || 'shadow-blue-400'}` 
          : ''
      }`}
    >
      {children}
    </div>
  );
};

interface ShakeEffectProps {
  children: React.ReactNode;
  isActive: boolean;
  intensity?: 'low' | 'medium' | 'high';
}

export const ShakeEffect: React.FC<ShakeEffectProps> = ({
  children,
  isActive,
  intensity = 'medium'
}) => {
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const intensityClasses = {
    low: 'animate-pulse',
    medium: 'animate-bounce',
    high: 'animate-ping'
  };

  return (
    <div
      className={`transition-transform duration-100 ${
        isShaking ? intensityClasses[intensity] : ''
      }`}
    >
      {children}
    </div>
  );
};

interface ParticleTrailProps {
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  isVisible: boolean;
  particleCount?: number;
  color?: string;
  onComplete?: () => void;
}

export const ParticleTrail: React.FC<ParticleTrailProps> = ({
  startPosition,
  endPosition,
  isVisible,
  particleCount = 10,
  color = '#FFD700',
  onComplete
}) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    if (isVisible) {
      const distance = Math.sqrt(
        Math.pow(endPosition.x - startPosition.x, 2) +
        Math.pow(endPosition.y - startPosition.y, 2)
      );

      const newParticles = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: startPosition.x + (endPosition.x - startPosition.x) * (i / particleCount),
        y: startPosition.y + (endPosition.y - startPosition.y) * (i / particleCount),
        delay: i * 50
      }));

      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
        if (onComplete) onComplete();
      }, 1000 + particleCount * 50);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [isVisible, startPosition, endPosition, particleCount, onComplete]);

  if (!isVisible || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full animate-ping"
          style={{
            left: particle.x - 4,
            top: particle.y - 4,
            backgroundColor: color,
            animationDelay: `${particle.delay}ms`,
            animationDuration: '400ms'
          }}
        />
      ))}
    </div>
  );
};

interface CelebrationEffectsProps {
  isWinner: boolean;
  winAmount?: number;
  isVisible: boolean;
}

export const CelebrationEffects: React.FC<CelebrationEffectsProps> = ({
  isWinner,
  winAmount,
  isVisible
}) => {
  return (
    <>
      {isVisible && isWinner && (
        <>
          <ConfettiEffect isVisible={true} duration={4000} />
          <FlashEffect isVisible={true} color="gold" duration={500} />
          
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="text-center animate-bounce">
              <div className="text-6xl font-bold text-yellow-500 drop-shadow-lg mb-4">
                🎉 恭喜获胜! 🎉
              </div>
              {winAmount && (
                <div className="text-3xl font-bold text-green-600 drop-shadow-lg">
                  +{winAmount.toLocaleString()} 筹码
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};