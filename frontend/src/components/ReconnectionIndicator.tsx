import React from 'react';
import { ConnectionStatus } from '../types/socket';

interface ReconnectionIndicatorProps {
  connectionStatus: ConnectionStatus;
  className?: string;
}

const ReconnectionIndicator: React.FC<ReconnectionIndicatorProps> = ({
  connectionStatus,
  className = ''
}) => {
  if (connectionStatus === 'connected' || connectionStatus === 'disconnected') {
    return null;
  }

  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connecting':
        return {
          icon: (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          message: '正在连接到服务器...',
          bgColor: 'bg-blue-500',
          textColor: 'text-white'
        };
      case 'reconnecting':
        return {
          icon: (
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          message: '连接断开，正在重新连接...',
          bgColor: 'bg-yellow-500',
          textColor: 'text-white'
        };
      case 'error':
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          message: '连接失败，请检查网络',
          bgColor: 'bg-red-500',
          textColor: 'text-white'
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className={`${statusInfo.bgColor} ${statusInfo.textColor} px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 min-w-[200px]`}>
        {statusInfo.icon}
        <span className="text-sm font-medium">{statusInfo.message}</span>
      </div>
    </div>
  );
};

export default ReconnectionIndicator;