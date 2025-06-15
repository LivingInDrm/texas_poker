import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError, isAuthenticated } = useUserStore();
  
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    avatar: '',
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/lobby');
    }
  }, [isAuthenticated, navigate]);

  // Clear error when switching between login/register
  useEffect(() => {
    clearError();
  }, [isLogin, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      return;
    }

    try {
      if (isLogin) {
        await login({
          username: formData.username,
          password: formData.password,
        });
      } else {
        await register({
          username: formData.username,
          password: formData.password,
          avatar: formData.avatar || undefined,
        });
      }
      // Navigation will be handled by useEffect
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      password: '',
      avatar: '',
    });
  };

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">🃏 德州扑克</h1>
          <h2 className="text-xl font-semibold text-green-200">
            {isLogin ? '登录' : '注册'}
          </h2>
          <p className="mt-1 text-sm text-green-300">
            {isLogin ? '欢迎回到游戏' : '加入德州扑克'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="appearance-none relative block w-full px-3 py-1.5 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                placeholder="请输入用户名"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="appearance-none relative block w-full px-3 py-1.5 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                placeholder="请输入密码"
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="avatar" className="block text-xs font-medium text-gray-700 mb-1">
                  头像链接 (可选)
                </label>
                <input
                  id="avatar"
                  name="avatar"
                  type="url"
                  value={formData.avatar}
                  onChange={handleInputChange}
                  className="appearance-none relative block w-full px-3 py-1.5 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '处理中...' : (isLogin ? '登录' : '注册')}
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={toggleMode}
                className="text-green-600 hover:text-green-500 text-xs font-medium transition-colors"
              >
                {isLogin ? '没有账户？立即注册' : '已有账户？立即登录'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;