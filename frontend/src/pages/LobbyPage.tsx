import React from 'react';
import { useUserStore } from '../stores/userStore';

const LobbyPage: React.FC = () => {
  const { user, logout } = useUserStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-green-900">
      <header className="bg-green-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">游戏大厅</h2>
            <p className="text-green-200 mb-8">
              欢迎来到德州扑克游戏大厅！这里将显示房间列表和创建房间功能。
            </p>
            
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                功能开发中...
              </h3>
              <p className="text-gray-600 mb-4">
                房间管理功能将在下一个阶段实现：
              </p>
              <ul className="text-left text-gray-600 space-y-2">
                <li>• 查看房间列表</li>
                <li>• 创建新房间</li>
                <li>• 加入房间</li>
                <li>• 快速开始</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LobbyPage;