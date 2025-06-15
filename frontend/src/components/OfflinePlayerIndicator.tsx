import React from 'react';
import { WifiOff, Clock, User } from 'lucide-react';

interface OfflinePlayerIndicatorProps {
  isOffline: boolean;
  playerName: string;
  lastSeenTime?: Date;
  timeoutRemaining?: number;
  className?: string;
}

export const OfflinePlayerIndicator: React.FC<OfflinePlayerIndicatorProps> = ({
  isOffline,
  playerName,
  lastSeenTime,
  timeoutRemaining,
  className = ''
}) => {
  if (!isOffline) {
    return null;
  }

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}秒前`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}小时前`;
  };

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center space-x-2 mb-2">
        <WifiOff className="w-4 h-4 text-red-500" />
        <span className="text-sm font-medium text-red-700">
          玩家已掉线
        </span>
      </div>
      
      <div className="space-y-1 text-xs text-red-600">
        <div className="flex items-center space-x-1">
          <User className="w-3 h-3" />
          <span>{playerName}</span>
        </div>
        
        {lastSeenTime && (
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>最后在线: {formatLastSeen(lastSeenTime)}</span>
          </div>
        )}
        
        {timeoutRemaining !== undefined && timeoutRemaining > 0 && (
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>等待重连: {formatTimeRemaining(timeoutRemaining)}</span>
          </div>
        )}
      </div>
      
      {timeoutRemaining !== undefined && timeoutRemaining > 0 && (
        <div className="mt-2">
          <div className="w-full bg-red-200 rounded-full h-1">
            <div 
              className="bg-red-500 h-1 rounded-full transition-all duration-1000"
              style={{ 
                width: `${Math.max(0, (timeoutRemaining / 30) * 100)}%` // 假设总超时时间为30秒
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface PlayerStatusBadgeProps {
  isConnected: boolean;
  isActive: boolean;
  className?: string;
}

export const PlayerStatusBadge: React.FC<PlayerStatusBadgeProps> = ({
  isConnected,
  isActive,
  className = ''
}) => {
  if (isConnected && isActive) {
    return null; // 正常状态不显示
  }

  if (!isConnected) {
    return (
      <div className={`inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs ${className}`}>
        <WifiOff className="w-3 h-3" />
        <span>掉线</span>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className={`inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs ${className}`}>
        <Clock className="w-3 h-3" />
        <span>暂离</span>
      </div>
    );
  }

  return null;
};