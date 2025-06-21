# Overall Upgrade Plan

## Goal
升级房间页面功能，实现玩家准备状态管理和房主开始游戏控制：
- 玩家进入房间后默认坐在牌桌上但处于未准备状态
- 房主有开始游戏按钮，需要至少2人且其他玩家都准备好时才能点击
- 所有玩家(含房主)都有准备状态切换按钮

## Affected Modules

### Backend
- `/backend/src/realtime/roomHandlers.ts` - 房间WebSocket事件处理
- `/backend/src/realtime/gameHandlers.ts` - 游戏相关事件处理  
- `/backend/src/services/roomService.ts` - 房间业务逻辑服务
- `/backend/src/game/GameState.ts` - 游戏状态管理
- `/backend/src/game/Room.ts` - 房间数据模型

### Frontend  
- `/frontend/src/pages/GamePage.tsx` - 游戏页面主组件
- `/frontend/src/components/GameTable.tsx` - 游戏桌面组件
- `/frontend/src/components/PlayerSeat.tsx` - 玩家座位组件
- `/frontend/src/components/ActionPanel.tsx` - 行动面板组件
- `/frontend/src/hooks/useSocket.ts` - Socket通信Hook
- `/frontend/src/stores/gameStore.ts` - 游戏状态存储

## High-Level Actions

### Backend Changes
1. 扩展房间状态数据结构，增加玩家准备状态字段
2. 添加 `PLAYER_READY` 和 `START_GAME` WebSocket事件处理器
3. 实现准备状态验证逻辑：至少2人且非房主都已准备
4. 更新房间状态广播机制，包含准备状态信息

### Frontend Changes  
1. 在GamePage中添加准备状态管理UI组件
2. 在PlayerSeat中显示玩家准备状态指示器
3. 在ActionPanel中添加准备按钮和开始游戏按钮(房主)
4. 实现Socket事件监听和发送逻辑
5. 更新gameStore以支持准备状态数据

### UI/UX Elements
1. 准备状态指示器：绿色勾选标记表示已准备
2. 准备按钮：切换玩家自身的准备状态
3. 开始游戏按钮：房主专用，满足条件时高亮可点击
4. 状态提示：显示当前房间准备状态和游戏开始条件