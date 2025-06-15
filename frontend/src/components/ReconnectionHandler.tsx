import React, { useEffect, useState } from 'react';
import { AlertCircle, Wifi, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../types/socket';

interface ReconnectionHandlerProps {
  connectionStatus: ConnectionStatus;
  onReconnect: () => void;
  autoReconnect?: boolean;
  maxRetries?: number;
}

export const ReconnectionHandler: React.FC<ReconnectionHandlerProps> = ({
  connectionStatus,
  onReconnect,
  autoReconnect = true,
  maxRetries = 5
}) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [retryTimer, setRetryTimer] = useState<number | null>(null);

  // 监听连接状态变化
  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      setShowModal(true);
      
      if (autoReconnect && retryCount < maxRetries) {
        startRetryTimer();
      }
    } else if (connectionStatus === 'connected') {
      setShowModal(false);
      setRetryCount(0);
      setIsRetrying(false);
      setRetryTimer(null);
    } else if (connectionStatus === 'reconnecting') {
      setIsRetrying(true);
    }
  }, [connectionStatus, autoReconnect, maxRetries, retryCount]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [retryTimer]);

  const startRetryTimer = () => {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // 指数退避，最大30秒
    
    const timer = window.setTimeout(() => {
      handleRetry();
    }, delay);
    
    setRetryTimer(timer);
  };

  const handleRetry = () => {
    if (retryCount >= maxRetries) {
      setIsRetrying(false);
      return;
    }

    setRetryCount(prev => prev + 1);
    setIsRetrying(true);
    onReconnect();
  };

  const handleManualRetry = () => {
    setRetryCount(0);
    setIsRetrying(true);
    onReconnect();
  };

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <div className="flex items-center mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">
            连接中断
          </h3>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 mb-2">
            网络连接已中断，无法与服务器通信。
          </p>
          
          {connectionStatus === 'reconnecting' || isRetrying ? (
            <div className="flex items-center text-blue-600">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              <span>正在重连... (尝试 {retryCount}/{maxRetries})</span>
            </div>
          ) : retryCount >= maxRetries ? (
            <div className="text-red-600">
              <p>重连失败，已达到最大重试次数。</p>
            </div>
          ) : (
            <div className="text-gray-600">
              <p>将在 {Math.min(1000 * Math.pow(2, retryCount), 30000) / 1000} 秒后自动重试...</p>
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Wifi className="w-4 h-4 mr-2" />
            {isRetrying ? '重连中...' : '立即重连'}
          </button>
          
          <button
            onClick={() => {
              setShowModal(false);
              // 可以在这里添加返回大厅的逻辑
              window.location.href = '/lobby';
            }}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            返回大厅
          </button>
        </div>

        {retryCount >= maxRetries && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>提示：</strong> 请检查网络连接，或稍后再试。如果问题持续存在，请联系技术支持。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};