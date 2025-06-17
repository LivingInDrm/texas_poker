import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

interface UserCurrentRoomStatusProps {
  currentRoomId: string | null;
  onLeaveRoom?: () => void;
  className?: string;
}

interface RoomDetails {
  playerCount: number;
  isGameStarted: boolean;
  roomState: any;
}

const UserCurrentRoomStatus: React.FC<UserCurrentRoomStatusProps> = ({
  currentRoomId,
  onLeaveRoom,
  className = ''
}) => {
  const navigate = useNavigate();
  const { getCurrentRoomStatus, leaveCurrentRoom } = useSocket();
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentRoomId) {
      setIsLoading(true);
      getCurrentRoomStatus()
        .then((result) => {
          if (result.roomDetails) {
            setRoomDetails(result.roomDetails);
          }
        })
        .catch((error) => {
          console.error('Failed to get room status:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [currentRoomId, getCurrentRoomStatus]);

  if (!currentRoomId) {
    return null;
  }

  const handleGoToRoom = () => {
    navigate(`/game/${currentRoomId}`);
  };

  const handleLeaveRoom = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLeaveRoom) {
      onLeaveRoom();
    } else {
      try {
        await leaveCurrentRoom();
      } catch (error) {
        console.error('Failed to leave room:', error);
      }
    }
  };

  return (
    <div 
      className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}
      data-testid="user-current-room-status"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-900">
              当前房间
            </h4>
            <p className="text-sm text-blue-700 mb-1">
              <span className="font-mono font-medium">{currentRoomId}</span>
            </p>
            {roomDetails && (
              <div className="text-xs text-blue-600 space-y-0.5">
                <div>玩家数: {roomDetails.playerCount}</div>
                <div>
                  {roomDetails.isGameStarted ? '游戏中' : '等待开始'}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleGoToRoom}
            className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-white hover:bg-blue-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            查看
          </button>
          
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            离开
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserCurrentRoomStatus;