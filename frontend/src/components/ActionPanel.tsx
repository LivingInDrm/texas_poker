import React, { useState, useEffect, useCallback } from 'react';
import { GameSnapshot, PlayerAction, GamePhase, ACTION_NAMES } from '../types/game';

interface ActionPanelProps {
  gameSnapshot: GameSnapshot;
  currentUserId: string;
  onPlayerAction: (action: PlayerAction, amount?: number) => void;
  className?: string;
}

interface ActionState {
  pendingAction: PlayerAction | null;
  raiseAmount: number;
  showConfirmation: boolean;
}

const ActionPanel: React.FC<ActionPanelProps> = ({
  gameSnapshot,
  currentUserId,
  onPlayerAction,
  className = ''
}) => {
  const [actionState, setActionState] = useState<ActionState>({
    pendingAction: null,
    raiseAmount: 0,
    showConfirmation: false
  });

  // 如果游戏快照不存在，不渲染组件
  if (!gameSnapshot) {
    return null;
  }

  const currentPlayer = gameSnapshot?.players?.find(p => p.id === currentUserId);
  const isCurrentPlayerTurn = gameSnapshot?.currentPlayerId === currentUserId;
  const isGameActive = gameSnapshot?.phase !== GamePhase.WAITING && gameSnapshot?.phase !== GamePhase.FINISHED;

  // 计算最小加注金额
  const getMinRaiseAmount = useCallback(() => {
    if (!currentPlayer) return 0;
    
    const highestBet = gameSnapshot?.players?.length ? Math.max(...gameSnapshot.players.map(p => p.currentBet)) : 0;
    const callAmount = highestBet - currentPlayer.currentBet;
    
    // 最小加注 = 跟注金额 + 大盲注
    const bigBlind = 20; // 假设大盲注为20，实际应该从游戏配置获取
    return callAmount + bigBlind;
  }, [currentPlayer, gameSnapshot?.players]);

  // 计算有效的操作选项
  const getAvailableActions = useCallback(() => {
    if (!currentPlayer || !isCurrentPlayerTurn || !isGameActive) {
      return [];
    }

    const actions: PlayerAction[] = [PlayerAction.FOLD];
    
    // 计算当前最高下注和需要跟注的金额
    const highestBet = gameSnapshot?.players?.length ? Math.max(...gameSnapshot.players.map(p => p.currentBet)) : 0;
    const callAmount = highestBet - currentPlayer.currentBet;
    
    // 如果没有人下注，可以过牌
    if (callAmount === 0) {
      actions.push(PlayerAction.CHECK);
    } else {
      // 如果有人下注，可以跟注（如果有足够筹码）
      if (currentPlayer.chips >= callAmount) {
        actions.push(PlayerAction.CALL);
      }
    }
    
    // 如果有足够筹码，可以加注
    const minRaise = getMinRaiseAmount();
    if (currentPlayer.chips >= minRaise) {
      actions.push(PlayerAction.RAISE);
    }
    
    // 总是可以全下（如果有筹码）
    if (currentPlayer.chips > 0) {
      actions.push(PlayerAction.ALL_IN);
    }
    
    return actions;
  }, [currentPlayer, isCurrentPlayerTurn, isGameActive, gameSnapshot?.players, getMinRaiseAmount]);

  // 计算跟注金额
  const getCallAmount = useCallback(() => {
    if (!currentPlayer) return 0;
    const highestBet = gameSnapshot?.players?.length ? Math.max(...gameSnapshot.players.map(p => p.currentBet)) : 0;
    return highestBet - currentPlayer.currentBet;
  }, [currentPlayer, gameSnapshot?.players]);

  // 初始化加注金额
  useEffect(() => {
    if (currentPlayer) {
      setActionState(prev => ({
        ...prev,
        raiseAmount: getMinRaiseAmount()
      }));
    }
  }, [currentPlayer, gameSnapshot?.players, getMinRaiseAmount]);

  // 处理操作按钮点击
  const handleActionClick = (action: PlayerAction) => {
    if (action === PlayerAction.RAISE) {
      // 加注需要确认金额
      setActionState(prev => ({
        ...prev,
        pendingAction: action,
        showConfirmation: true
      }));
    } else {
      // 其他操作直接确认
      setActionState(prev => ({
        ...prev,
        pendingAction: action,
        showConfirmation: true
      }));
    }
  };

  // 确认操作
  const confirmAction = () => {
    if (!actionState.pendingAction) return;
    
    const amount = actionState.pendingAction === PlayerAction.RAISE ? actionState.raiseAmount : 0;
    onPlayerAction(actionState.pendingAction, amount);
    
    // 重置状态
    setActionState({
      pendingAction: null,
      raiseAmount: getMinRaiseAmount(),
      showConfirmation: false
    });
  };

  // 取消操作
  const cancelAction = () => {
    setActionState(prev => ({
      ...prev,
      pendingAction: null,
      showConfirmation: false
    }));
  };

  // 处理加注金额变化
  const handleRaiseAmountChange = (amount: number) => {
    const maxAmount = currentPlayer ? currentPlayer.chips + currentPlayer.currentBet : 0;
    const minAmount = getMinRaiseAmount();
    const clampedAmount = Math.max(minAmount, Math.min(amount, maxAmount));
    
    setActionState(prev => ({
      ...prev,
      raiseAmount: clampedAmount
    }));
  };

  const availableActions = getAvailableActions();
  const callAmount = getCallAmount();
  const minRaise = getMinRaiseAmount();
  const maxRaise = currentPlayer ? currentPlayer.chips + currentPlayer.currentBet : 0;

  if (!isGameActive || !currentPlayer) {
    return null;
  }

  return (
    <div className={`bg-gray-900 text-white p-4 rounded-t-lg ${className}`}>
      {/* 确认对话框 */}
      {actionState.showConfirmation && (
        <div className="mb-4 p-4 bg-blue-900 rounded-lg border border-blue-500">
          <div className="text-center mb-3">
            <div className="text-lg font-bold">
              确认{ACTION_NAMES[actionState.pendingAction!]}
            </div>
            {actionState.pendingAction === PlayerAction.RAISE && (
              <div className="text-sm text-blue-300 mt-1">
                加注至 ${actionState.raiseAmount.toLocaleString()}
              </div>
            )}
            {actionState.pendingAction === PlayerAction.CALL && (
              <div className="text-sm text-blue-300 mt-1">
                跟注 ${callAmount.toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={confirmAction}
              className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-bold"
            >
              确认
            </button>
            <button
              onClick={cancelAction}
              className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-bold"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 加注金额控制 */}
      {actionState.pendingAction === PlayerAction.RAISE && actionState.showConfirmation && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-300 mb-2">加注金额</div>
          
          {/* 滑条 */}
          <div className="mb-3">
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              value={actionState.raiseAmount}
              onChange={(e) => handleRaiseAmountChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${((actionState.raiseAmount - minRaise) / (maxRaise - minRaise)) * 100}%, #374151 ${((actionState.raiseAmount - minRaise) / (maxRaise - minRaise)) * 100}%, #374151 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>最小: ${minRaise.toLocaleString()}</span>
              <span>最大: ${maxRaise.toLocaleString()}</span>
            </div>
          </div>
          
          {/* 数字输入 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm">$</span>
            <input
              type="number"
              min={minRaise}
              max={maxRaise}
              value={actionState.raiseAmount}
              onChange={(e) => handleRaiseAmountChange(parseInt(e.target.value) || minRaise)}
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          {/* 快捷按钮 */}
          <div className="flex space-x-2 mt-3">
            <button
              onClick={() => handleRaiseAmountChange(minRaise)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              最小
            </button>
            <button
              onClick={() => handleRaiseAmountChange(Math.floor(maxRaise * 0.5))}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              1/2池
            </button>
            <button
              onClick={() => handleRaiseAmountChange(Math.floor(maxRaise * 0.75))}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              3/4池
            </button>
            <button
              onClick={() => handleRaiseAmountChange(maxRaise)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              全下
            </button>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {!actionState.showConfirmation && isCurrentPlayerTurn && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {availableActions.map((action) => {
            let buttonText: string = ACTION_NAMES[action];
            let buttonColor = 'bg-gray-600 hover:bg-gray-500';
            
            // 根据操作类型设置按钮样式和文本
            switch (action) {
              case PlayerAction.FOLD:
                buttonColor = 'bg-red-600 hover:bg-red-500';
                break;
              case PlayerAction.CHECK:
                buttonColor = 'bg-blue-600 hover:bg-blue-500';
                break;
              case PlayerAction.CALL:
                buttonColor = 'bg-green-600 hover:bg-green-500';
                buttonText = `跟注 $${callAmount.toLocaleString()}`;
                break;
              case PlayerAction.RAISE:
                buttonColor = 'bg-yellow-600 hover:bg-yellow-500';
                buttonText = `加注 $${minRaise.toLocaleString()}+`;
                break;
              case PlayerAction.ALL_IN:
                buttonColor = 'bg-purple-600 hover:bg-purple-500';
                buttonText = `全下 $${currentPlayer?.chips.toLocaleString()}`;
                break;
            }
            
            return (
              <button
                key={action}
                onClick={() => handleActionClick(action)}
                className={`${buttonColor} text-white px-4 py-3 rounded font-bold transition-colors duration-200`}
              >
                {buttonText}
              </button>
            );
          })}
        </div>
      )}

      {/* 玩家信息 */}
      <div className="border-t border-gray-700 pt-3">
        <div className="flex justify-between items-center text-sm">
          <div>
            <span className="text-gray-400">筹码: </span>
            <span className="font-bold">${currentPlayer.chips.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-400">本轮下注: </span>
            <span className="font-bold">${currentPlayer.currentBet.toLocaleString()}</span>
          </div>
        </div>
        
        {/* 轮次状态 */}
        {isCurrentPlayerTurn && (
          <div className="text-center mt-2 text-green-400 font-bold">
            轮到你行动了！
          </div>
        )}
        
        {!isCurrentPlayerTurn && gameSnapshot?.currentPlayerId && (
          <div className="text-center mt-2 text-gray-400">
            等待 {gameSnapshot?.players?.find(p => p.id === gameSnapshot?.currentPlayerId)?.name} 行动...
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionPanel;