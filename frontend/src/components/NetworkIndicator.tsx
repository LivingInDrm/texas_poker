import React from 'react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle } from 'lucide-react';
import { ConnectionStatus, NetworkQuality } from '../types/socket';

interface NetworkIndicatorProps {
  connectionStatus: ConnectionStatus;
  networkQuality: NetworkQuality;
  className?: string;
  showDetails?: boolean;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({
  connectionStatus,
  networkQuality,
  className = '',
  showDetails = false
}) => {
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting':
      case 'reconnecting':
        return <Wifi className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'reconnecting':
        return '重连中...';
      case 'disconnected':
        return '已断开';
      case 'error':
        return '连接错误';
      default:
        return '未知状态';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-500';
      case 'disconnected':
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getQualityColor = () => {
    switch (networkQuality.status) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-blue-500';
      case 'poor':
        return 'text-yellow-500';
      case 'offline':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getQualityText = () => {
    switch (networkQuality.status) {
      case 'excellent':
        return '优秀';
      case 'good':
        return '良好';
      case 'poor':
        return '较差';
      case 'offline':
        return '离线';
      default:
        return '未知';
    }
  };

  const formatPing = (ping: number) => {
    if (ping === 0) return '--';
    return `${ping}ms`;
  };

  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        {getStatusIcon()}
        <span className={`text-xs ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">网络状态</h3>
        {getStatusIcon()}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">连接状态:</span>
          <span className={`text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {connectionStatus === 'connected' && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">网络延迟:</span>
              <span className={`text-xs font-medium ${getQualityColor()}`}>
                {formatPing(networkQuality.ping)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">网络质量:</span>
              <span className={`text-xs font-medium ${getQualityColor()}`}>
                {getQualityText()}
              </span>
            </div>
            
            {/* 网络质量指示条 */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  networkQuality.status === 'excellent' ? 'bg-green-500 w-full' :
                  networkQuality.status === 'good' ? 'bg-blue-500 w-3/4' :
                  networkQuality.status === 'poor' ? 'bg-yellow-500 w-1/2' :
                  'bg-red-500 w-1/4'
                }`}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};