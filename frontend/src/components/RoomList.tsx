import { Room } from '../services/api';

interface RoomListProps {
  rooms: Room[];
  isLoading: boolean;
  onJoinRoom: (roomId: string, hasPassword: boolean) => void;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
}

const RoomList = ({ rooms, isLoading, onJoinRoom, pagination, onPageChange }: RoomListProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'bg-green-100 text-green-800';
      case 'PLAYING':
        return 'bg-blue-100 text-blue-800';
      case 'ENDED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING':
        return '等待中';
      case 'PLAYING':
        return '游戏中';
      case 'ENDED':
        return '已结束';
      default:
        return '未知';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white">加载房间列表中...</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🃏</div>
        <h3 className="text-xl font-semibold text-white mb-2">暂无房间</h3>
        <p className="text-green-200 mb-4">
          目前没有可用的房间，要不要创建一个新房间？
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Room Cards */}
      <div className="grid gap-4">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="bg-white/20 rounded-lg p-4 hover:bg-white/30 transition-colors duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {room.owner.username} 的房间
                    </span>
                    {room.hasPassword && (
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                    {getStatusText(room.status)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-green-200">
                    <span className="block text-xs text-green-300">玩家</span>
                    <span className="text-white font-medium">
                      {room.currentPlayers}/{room.playerLimit}
                    </span>
                  </div>
                  <div className="text-green-200">
                    <span className="block text-xs text-green-300">盲注</span>
                    <span className="text-white font-medium">
                      {room.smallBlind}/{room.bigBlind}
                    </span>
                  </div>
                  <div className="text-green-200">
                    <span className="block text-xs text-green-300">创建时间</span>
                    <span className="text-white font-medium">
                      {formatTime(room.createdAt)}
                    </span>
                  </div>
                  <div className="text-green-200">
                    <span className="block text-xs text-green-300">房间ID</span>
                    <span className="text-white font-medium text-xs">
                      {room.id.slice(-8)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="ml-4">
                <button
                  onClick={() => onJoinRoom(room.id, room.hasPassword)}
                  disabled={room.currentPlayers >= room.playerLimit || room.status !== 'WAITING'}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    room.currentPlayers >= room.playerLimit || room.status !== 'WAITING'
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {room.currentPlayers >= room.playerLimit 
                    ? '房间已满' 
                    : room.status !== 'WAITING' 
                    ? '游戏中' 
                    : '加入房间'
                  }
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-2 rounded-lg bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/30 transition-colors"
          >
            上一页
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  page === pagination.page
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-2 rounded-lg bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/30 transition-colors"
          >
            下一页
          </button>
        </div>
      )}
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
          <span className="text-white">更新中...</span>
        </div>
      )}
    </div>
  );
};

export default RoomList;