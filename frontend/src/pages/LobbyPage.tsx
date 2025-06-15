import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useRoomStore } from '../stores/roomStore';
import { useSocket } from '../hooks/useSocket';
import { NetworkIndicator } from '../components/NetworkIndicator';
import RoomList from '../components/RoomList';
import CreateRoomModal from '../components/CreateRoomModal';
import JoinRoomModal from '../components/JoinRoomModal';

const LobbyPage = () => {
  const navigate = useNavigate();
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
  
  // Socket integration
  const {
    connected,
    connectionStatus,
    networkQuality,
    connect,
    quickStart,
    joinRoom: socketJoinRoom
  } = useSocket();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [isQuickStarting, setIsQuickStarting] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

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

  // Socket connection effect
  useEffect(() => {
    if (user && !connected) {
      connect().catch(error => {
        console.error('Failed to connect to socket:', error);
        setSocketError('无法连接到服务器');
      });
    }
  }, [user, connected, connect]);

  // Socket quick start implementation
  const handleQuickStart = async () => {
    if (!connected) {
      setSocketError('未连接到服务器，请检查网络连接');
      return;
    }

    setIsQuickStarting(true);
    setSocketError(null);

    try {
      const response = await quickStart();
      if (response.success && response.data?.roomId) {
        // 直接跳转到游戏页面
        navigate(`/game/${response.data.roomId}`);
      } else {
        setSocketError(response.error || '快速开始失败');
      }
    } catch (error: any) {
      console.error('Quick start failed:', error);
      setSocketError(error.message || '快速开始失败');
    } finally {
      setIsQuickStarting(false);
    }
  };

  // Enhanced room join with socket integration
  const handleJoinRoom = async (roomId: string, password?: string) => {
    if (!connected) {
      setSocketError('未连接到服务器，请检查网络连接');
      return;
    }

    try {
      const response = await socketJoinRoom(roomId, password);
      if (response.success) {
        navigate(`/game/${roomId}`);
      } else {
        setSocketError(response.error || '加入房间失败');
      }
    } catch (error: any) {
      console.error('Join room failed:', error);
      setSocketError(error.message || '加入房间失败');
    }
  };

  // Fallback to API-based room operations
  const handleQuickStartFallback = () => {
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

  // Fallback room join for UI click
  const handleRoomItemClick = (roomId: string, hasPassword: boolean) => {
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
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-white">🃏 德州扑克</h1>
              {/* 网络状态指示器 */}
              <NetworkIndicator
                connectionStatus={connectionStatus}
                networkQuality={networkQuality}
                showDetails={false}
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="text-white text-sm">
                  <div>筹码: {user?.chips || 0}</div>
                </div>
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
            onClick={connected ? handleQuickStart : handleQuickStartFallback}
            disabled={isQuickStarting || !user}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {isQuickStarting ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {isQuickStarting ? '匹配中...' : '快速开始'}
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

        {/* Error Messages */}
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
        
        {socketError && (
          <div className="bg-red-500 text-white p-4 rounded-lg mb-6 flex items-center justify-between">
            <span>{socketError}</span>
            <button
              onClick={() => setSocketError(null)}
              className="text-white hover:text-red-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Connection Status Warning */}
        {!connected && user && (
          <div className="bg-yellow-500 text-yellow-900 p-4 rounded-lg mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>未连接到实时服务器，部分功能可能受限</span>
            </div>
            <button
              onClick={connect}
              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
            >
              重连
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
            onJoinRoom={handleRoomItemClick}
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        </div>

        {/* User Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{user?.chips?.toLocaleString() || 0}</div>
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
        onJoinRoom={connected ? handleJoinRoom : undefined}
      />
    </div>
  );
};

export default LobbyPage;