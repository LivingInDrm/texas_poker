import { useEffect, useState } from 'react';
import { useUserStore } from '../stores/userStore';
import { useRoomStore } from '../stores/roomStore';
import RoomList from '../components/RoomList';
import CreateRoomModal from '../components/CreateRoomModal';
import JoinRoomModal from '../components/JoinRoomModal';

const LobbyPage = () => {
  const { user, logout } = useUserStore();
  const { 
    rooms, 
    isLoading, 
    error, 
    pagination,
    fetchRooms, 
    clearError,
    refreshRooms 
  } = useRoomStore();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Fetch rooms on component mount
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Auto-refresh rooms every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRooms();
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshRooms]);

  const handleQuickStart = () => {
    // Find an available room or create a new one
    const availableRoom = rooms.find(room => 
      room.status === 'WAITING' && 
      room.currentPlayers < room.playerLimit &&
      !room.hasPassword
    );

    if (availableRoom) {
      setSelectedRoomId(availableRoom.id);
      setIsJoinModalOpen(true);
    } else {
      // Create a new room with default settings
      setIsCreateModalOpen(true);
    }
  };

  const handleJoinRoom = (roomId: string, hasPassword: boolean) => {
    setSelectedRoomId(roomId);
    setIsJoinModalOpen(true);
  };

  const handlePageChange = (page: number) => {
    fetchRooms(page);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900">
      {/* Header */}
      <header className="bg-green-800/50 backdrop-blur-sm border-b border-green-700">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">🃏 德州扑克</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {user?.avatar && (
                  <img
                    src={user.avatar}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <span className="text-white font-medium">
                  欢迎, {user?.username}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-2">
            游戏大厅
          </h2>
          <p className="text-green-200 text-lg">
            选择一个房间开始游戏，或创建你自己的房间
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建房间
          </button>
          
          <button
            onClick={handleQuickStart}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            快速开始
          </button>
          
          <button
            onClick={() => refreshRooms()}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500 text-white p-4 rounded-lg mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-white hover:text-red-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Room List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">房间列表</h3>
            <div className="text-green-200">
              总计 {pagination.total} 个房间
            </div>
          </div>
          
          <RoomList
            rooms={rooms}
            isLoading={isLoading}
            onJoinRoom={handleJoinRoom}
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        </div>

        {/* User Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">5,000</div>
            <div className="text-green-200">筹码余额</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-green-200">已玩游戏</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">0%</div>
            <div className="text-green-200">胜率</div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        roomId={selectedRoomId}
      />
    </div>
  );
};

export default LobbyPage;