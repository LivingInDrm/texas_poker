import { useState } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { CreateRoomData } from '../services/api';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateRoomModal = ({ isOpen, onClose }: CreateRoomModalProps) => {
  const { createRoom, isLoading } = useRoomStore();
  const [formData, setFormData] = useState<CreateRoomData>({
    playerLimit: 6,
    password: '',
    bigBlind: 20,
    smallBlind: 10,
  });
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.playerLimit < 2 || formData.playerLimit > 9) {
      setError('玩家数量必须在2-9之间');
      return;
    }

    if (formData.bigBlind <= formData.smallBlind) {
      setError('大盲注必须大于小盲注');
      return;
    }

    try {
      await createRoom({
        ...formData,
        password: formData.password || undefined, // Don't send empty string
      });
      
      // Reset form and close modal
      setFormData({
        playerLimit: 6,
        password: '',
        bigBlind: 20,
        smallBlind: 10,
      });
      onClose();
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleClose = () => {
    setFormData({
      playerLimit: 6,
      password: '',
      bigBlind: 20,
      smallBlind: 10,
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">创建房间</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Player Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              玩家数量
            </label>
            <select
              value={formData.playerLimit}
              onChange={(e) => setFormData({ ...formData, playerLimit: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 8 }, (_, i) => i + 2).map((num) => (
                <option key={num} value={num}>
                  {num} 人
                </option>
              ))}
            </select>
          </div>

          {/* Blinds */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                小盲注
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={formData.smallBlind}
                onChange={(e) => setFormData({ ...formData, smallBlind: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                大盲注
              </label>
              <input
                type="number"
                min="2"
                max="2000"
                value={formData.bigBlind}
                onChange={(e) => setFormData({ ...formData, bigBlind: parseInt(e.target.value) || 20 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              房间密码 (可选)
            </label>
            <input
              type="text"
              placeholder="留空表示无密码"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              设置密码后，其他玩家需要输入密码才能加入
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '创建中...' : '创建房间'}
            </button>
          </div>
        </form>

        {/* Room Settings Preview */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">房间设置预览</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>• 最多 {formData.playerLimit} 名玩家</div>
            <div>• 盲注: {formData.smallBlind}/{formData.bigBlind}</div>
            <div>• {formData.password ? '需要密码' : '无密码'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal;