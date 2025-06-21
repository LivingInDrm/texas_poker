# Detailed Upgrade Plan

## Backend Changes

### 1. 修改 `backend/src/realtime/gameHandlers.ts`

**当前问题**: `GAME_READY` 事件处理器会自动开始游戏当所有玩家准备好时
**解决方案**: 分离准备状态切换和游戏开始逻辑

- 修改 `GAME_READY` 处理器：只切换玩家准备状态，不自动开始游戏
- 添加新的 `START_GAME` 事件处理器：仅房主可调用，验证开始条件
- 添加游戏开始条件验证函数：`validateGameStartConditions(roomId)`
- 广播准备状态变化给所有房间玩家

### 2. 添加新的Socket事件类型

**文件**: `backend/src/types/socket.ts`
- 添加 `START_GAME` 事件类型
- 添加 `GAME_START_CONDITIONS_UPDATE` 事件类型
- 定义游戏开始条件数据结构

### 3. 增强房间状态管理

**文件**: `backend/src/game/Room.ts` 
- 添加 `canStartGame()` 方法：检查是否满足游戏开始条件
- 添加 `getReadyPlayers()` 方法：获取已准备玩家列表
- 添加 `isOwner(playerId)` 方法：检查玩家是否为房主

### 4. 更新房间服务逻辑

**文件**: `backend/src/services/roomService.ts`
- 添加 `checkGameStartConditions(roomId)` 方法
- 更新房间状态广播，包含游戏开始条件信息

## Frontend Changes

### 1. 修改 `frontend/src/pages/GamePage.tsx`

**当前状态**: 基础准备按钮存在但功能有限
**升级内容**:
- 添加房主专用的"开始游戏"按钮组件
- 显示当前房间准备状态统计 (例: "2/4 玩家已准备")
- 添加游戏开始条件提示信息
- 实现新的Socket事件监听

### 2. 增强 `frontend/src/components/PlayerSeat.tsx`

**当前状态**: 无准备状态可视化指示
**升级内容**:
- 添加准备状态指示器：绿色勾选图标表示已准备
- 添加"Ready"/"Waiting"文字状态显示
- 为已准备和未准备玩家应用不同的视觉样式
- 显示玩家角色标识 (房主标记)

### 3. 升级 `frontend/src/components/ActionPanel.tsx`

**当前状态**: 仅处理游戏中行动
**升级内容**:
- 添加准备状态切换按钮 (所有玩家)
- 添加开始游戏按钮 (仅房主，条件满足时可点击)
- 显示游戏开始条件反馈信息
- 处理按钮状态和可点击性逻辑

### 4. 更新 `frontend/src/hooks/useSocket.ts`

**当前状态**: 有基础 `setReady()` 方法
**升级内容**:
- 添加 `startGame()` 方法供房主调用
- 添加游戏开始条件状态管理
- 增强准备状态事件监听
- 添加错误处理和反馈机制

### 5. 扩展 `frontend/src/stores/gameStore.ts`

**当前状态**: 基础游戏状态管理
**升级内容**:
- 添加 `gameStartConditions` 状态字段
- 添加 `isGameStartable` 计算状态
- 添加房主身份判断逻辑
- 更新准备状态相关的状态管理

## UI/UX 设计细节

### 1. 准备状态指示器
- **已准备**: 绿色勾选图标 + "Ready" 文字
- **未准备**: 灰色时钟图标 + "Waiting" 文字
- **房主标识**: 金色皇冠图标

### 2. 准备按钮设计
- **未准备状态**: "准备游戏" 蓝色按钮
- **已准备状态**: "取消准备" 灰色按钮
- **悬停效果**: 颜色渐变和微动画

### 3. 开始游戏按钮 (房主专用)
- **条件未满足**: 灰色禁用状态 + 提示文字
- **条件满足**: 绿色高亮按钮 + 脉冲动画
- **提示信息**: "需要至少2人且所有玩家准备完毕"

### 4. 房间状态信息面板
- **玩家统计**: "已准备玩家: 2/4"
- **开始条件**: "✓ 人数足够 ✗ 等待玩家准备"
- **房主提示**: "您是房主，可以开始游戏"

## 技术实现规范

### 1. Socket事件命名规范
- `PLAYER_READY_TOGGLE`: 玩家切换准备状态
- `START_GAME`: 房主开始游戏
- `GAME_START_CONDITIONS_UPDATE`: 游戏开始条件更新
- `READY_STATE_CHANGED`: 准备状态变化广播

### 2. 错误处理
- 非房主尝试开始游戏: 显示"只有房主可以开始游戏"
- 条件不满足时开始游戏: 显示具体缺失条件
- 网络错误: 重试机制和用户友好提示

### 3. 性能考虑
- 准备状态变化实时广播，无延迟
- 开始条件检查优化，避免频繁计算
- UI更新使用React memo优化渲染

## 实施顺序

1. **Backend基础**: 修改gameHandlers.ts，分离准备和开始逻辑
2. **Backend事件**: 添加新Socket事件和验证逻辑
3. **Frontend Hook**: 更新useSocket.ts支持新功能
4. **Frontend Store**: 扩展gameStore状态管理
5. **Frontend UI**: 更新GamePage, PlayerSeat, ActionPanel组件
6. **测试验证**: 完整功能测试和边界情况验证

## 验收标准

### 功能验证
- [ ] 玩家进入房间后默认未准备状态
- [ ] 准备按钮可正常切换状态
- [ ] 房主开始按钮在条件满足时可点击
- [ ] 游戏成功开始当房主点击开始按钮
- [ ] 准备状态实时同步到所有玩家

### UI验证  
- [ ] 准备状态指示器正确显示
- [ ] 房主身份清晰标识
- [ ] 按钮状态和样式符合设计规范
- [ ] 条件提示信息准确显示

### 错误处理
- [ ] 非房主无法开始游戏
- [ ] 条件不满足时按钮禁用
- [ ] 网络错误时有友好提示