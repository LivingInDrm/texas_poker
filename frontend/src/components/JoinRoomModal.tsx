import { useState, useEffect } from 'react';
import { useRoomStore } from '../stores/roomStore';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onJoinRoom?: (roomId: string, password?: string) => Promise<void>;
}

const JoinRoomModal = ({ isOpen, onClose, roomId, onJoinRoom }: JoinRoomModalProps) => {
  const { rooms, joinRoom, isLoading } = useRoomStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const room = rooms.find(r => r.id === roomId);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!room) {
      setError('房间不存在');
      return;
    }

    if (room.hasPassword && !password.trim()) {
      setError('请输入房间密码');
      return;
    }

    try {
      // Use socket-based join if available, otherwise fall back to API
      if (onJoinRoom) {
        await onJoinRoom(roomId, password.trim() || undefined);
      } else {
        await joinRoom({
          roomId,
          password: password.trim() || undefined,
        });
      }
      
      // Clear form and close modal
      setPassword('');
      onClose();
      
      console.log('Successfully joined room:', roomId);
    } catch (error: any) {
      console.error('Join room error:', error);
      setError(error.message || '加入房间失败');
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">加入房间</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {room ? (
          <>
            {/* Room Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">{room.owner.username} 的房间</h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="block text-xs text-gray-500">玩家</span>
                  <span className="font-medium">
                    {room.currentPlayers}/{room.playerLimit}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">盲注</span>
                  <span className="font-medium">
                    {room.smallBlind}/{room.bigBlind}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">状态</span>
                  <span className={`font-medium ${
                    room.status === 'WAITING' ? 'text-green-600' : 
                    room.status === 'PLAYING' ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {room.status === 'WAITING' ? '等待中' : 
                     room.status === 'PLAYING' ? '游戏中' : '已结束'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">密码</span>
                  <span className="font-medium">
                    {room.hasPassword ? '需要密码' : '无密码'}
                  </span>
                </div>
              </div>
            </div>

            {/* Join Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {room.hasPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    房间密码
                  </label>
                  <input
                    type="password"
                    placeholder="请输入房间密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {/* Warning for full room */}
              {room.currentPlayers >= room.playerLimit && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-700 text-sm">
                    ⚠️ 房间已满，无法加入
                  </p>
                </div>
              )}

              {/* Warning for non-waiting room */}
              {room.status !== 'WAITING' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-700 text-sm">
                    ⚠️ 房间当前不接受新玩家
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={
                    isLoading || 
                    room.currentPlayers >= room.playerLimit || 
                    room.status !== 'WAITING'
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? '加入中...' : '加入房间'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">房间不存在</h3>
            <p className="text-gray-600 mb-4">请检查房间ID是否正确</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinRoomModal;