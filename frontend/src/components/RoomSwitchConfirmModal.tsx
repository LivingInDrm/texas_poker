import React from 'react';

interface RoomSwitchConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentRoomId: string;
  targetRoomId: string;
  currentRoomDetails?: {
    playerCount: number;
    isGameStarted: boolean;
  };
}

const RoomSwitchConfirmModal: React.FC<RoomSwitchConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentRoomId,
  targetRoomId,
  currentRoomDetails
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      data-testid="modal-backdrop"
    >
      <div 
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        role="dialog"
        aria-labelledby="modal-title"
        data-testid="modal-content"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="modal-title" className="text-lg font-semibold text-gray-900">
            切换房间确认
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center mb-3">
            <svg className="w-8 h-8 text-yellow-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-gray-700 font-medium">
              您当前正在房间中
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="space-y-2">
              <div className="mb-2">
                <span className="text-sm text-gray-600">当前房间: </span>
                <span className="text-sm font-medium text-gray-900">{currentRoomId}</span>
              </div>
              {currentRoomDetails && (
                <>
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">当前房间玩家数: </span>
                    <span className="text-sm font-medium text-gray-900">{currentRoomDetails.playerCount}</span>
                  </div>
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">游戏状态: </span>
                    <span className={`text-sm font-medium ${
                      currentRoomDetails.isGameStarted ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {currentRoomDetails.isGameStarted ? '游戏进行中' : '等待游戏开始'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="text-gray-700 text-sm">
            <p className="mb-2">
              <span className="text-gray-600">目标房间: </span>
              <span className="font-medium text-blue-600">{targetRoomId}</span>
            </p>
            <p>加入新房间将自动离开当前房间。</p>
          </div>

          {currentRoomDetails?.isGameStarted && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">注意</p>
                  <p className="text-sm text-red-700">
                    ⚠️ 注意：您当前在游戏中，离开将导致自动弃牌
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            继续
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomSwitchConfirmModal;