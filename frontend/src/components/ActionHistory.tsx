import React from 'react';
import { GameAction, ACTION_NAMES, PHASE_NAMES } from '../types/game';

interface ActionHistoryProps {
  actions: GameAction[];
  players: Array<{ id: string; name: string }>;
  maxItems?: number;
  className?: string;
}

const ActionHistory: React.FC<ActionHistoryProps> = ({
  actions,
  players,
  maxItems = 10,
  className = ''
}) => {
  // 获取最近的操作记录
  const recentActions = actions.slice(-maxItems).reverse();
  
  // 根据玩家ID获取玩家名称
  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.name || '未知玩家';
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 格式化操作描述
  const formatActionDescription = (action: GameAction) => {
    const playerName = getPlayerName(action.playerId);
    const actionName = ACTION_NAMES[action.action];
    
    let description = `${playerName} ${actionName}`;
    
    if (action.amount > 0) {
      description += ` $${action.amount.toLocaleString()}`;
    }
    
    return description;
  };

  if (recentActions.length === 0) {
    return (
      <div className={`text-center text-gray-500 py-4 ${className}`}>
        暂无操作记录
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm">操作历史</h3>
        <span className="text-gray-400 text-xs">
          {actions.length} 条记录
        </span>
      </div>
      
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {recentActions.map((action, index) => {
          // 根据操作类型设置颜色
          let actionColor = 'text-gray-300';
          switch (action.action) {
            case 'fold':
              actionColor = 'text-red-400';
              break;
            case 'check':
              actionColor = 'text-blue-400';
              break;
            case 'call':
              actionColor = 'text-green-400';
              break;
            case 'raise':
              actionColor = 'text-yellow-400';
              break;
            case 'all_in':
              actionColor = 'text-purple-400';
              break;
          }
          
          return (
            <div
              key={`${action.timestamp}-${index}`}
              className="flex justify-between items-start text-xs"
            >
              <div className="flex-1">
                <div className={`font-medium ${actionColor}`}>
                  {formatActionDescription(action)}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {PHASE_NAMES[action.phase]} • {formatTime(action.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {actions.length > maxItems && (
        <div className="text-center mt-3 pt-2 border-t border-gray-700">
          <span className="text-gray-400 text-xs">
            显示最近 {maxItems} 条记录，共 {actions.length} 条
          </span>
        </div>
      )}
    </div>
  );
};

export default ActionHistory;