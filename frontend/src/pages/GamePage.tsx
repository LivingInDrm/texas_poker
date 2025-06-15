import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameTable from '../components/GameTable';
import ActionPanel from '../components/ActionPanel';
import ActionHistory from '../components/ActionHistory';
import { GameSnapshot, GamePhase, PlayerStatus, Suit, Rank, PlayerAction } from '../types/game';

const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [gameSnapshot, setGameSnapshot] = useState<GameSnapshot | null>(null);

  // Mock data for development/testing
  useEffect(() => {
    const mockGameSnapshot: GameSnapshot = {
      gameId: roomId || 'test-room',
      phase: GamePhase.FLOP,
      players: [
        {
          id: 'user1',
          name: 'Alice',
          chips: 1500,
          status: PlayerStatus.ACTIVE,
          cards: [
            { suit: Suit.SPADES, rank: Rank.ACE },
            { suit: Suit.HEARTS, rank: Rank.KING }
          ],
          currentBet: 50,
          totalBet: 70,
          hasActed: true,
          isReady: true,
          lastAction: undefined
        },
        {
          id: 'user2',
          name: 'Bob',
          chips: 2000,
          status: PlayerStatus.ACTIVE,
          cards: [
            { suit: Suit.CLUBS, rank: Rank.QUEEN },
            { suit: Suit.DIAMONDS, rank: Rank.JACK }
          ],
          currentBet: 50,
          totalBet: 50,
          hasActed: false,
          isReady: true,
          lastAction: undefined
        },
        {
          id: 'user3',
          name: 'Charlie',
          chips: 800,
          status: PlayerStatus.FOLDED,
          cards: [],
          currentBet: 0,
          totalBet: 20,
          hasActed: true,
          isReady: true,
          lastAction: 'fold' as any
        }
      ],
      communityCards: [
        { suit: Suit.SPADES, rank: Rank.TEN },
        { suit: Suit.HEARTS, rank: Rank.NINE },
        { suit: Suit.CLUBS, rank: Rank.EIGHT }
      ],
      pots: [
        {
          id: 'pot-1',
          amount: 140,
          type: 'main',
          eligiblePlayers: ['user1', 'user2', 'user3']
        }
      ],
      currentPlayerId: 'user1',
      actionHistory: [
        {
          playerId: 'user1',
          action: 'raise' as any,
          amount: 50,
          timestamp: Date.now() - 5000,
          phase: GamePhase.PRE_FLOP
        },
        {
          playerId: 'user3',
          action: 'fold' as any,
          amount: 0,
          timestamp: Date.now() - 3000,
          phase: GamePhase.PRE_FLOP
        }
      ],
      isHandInProgress: true,
      positions: [
        {
          playerId: 'user1',
          seatIndex: 0,
          isDealer: true,
          isSmallBlind: false,
          isBigBlind: false
        },
        {
          playerId: 'user2',
          seatIndex: 1,
          isDealer: false,
          isSmallBlind: true,
          isBigBlind: false
        },
        {
          playerId: 'user3',
          seatIndex: 2,
          isDealer: false,
          isSmallBlind: false,
          isBigBlind: true
        }
      ]
    };

    setGameSnapshot(mockGameSnapshot);
  }, [roomId]);

  const handlePlayerAction = (action: PlayerAction, amount?: number) => {
    console.log('Player action:', action, amount);
    // TODO: Implement WebSocket communication with backend
    
    // Mock action handling for testing
    if (gameSnapshot && action) {
      const updatedSnapshot = { ...gameSnapshot };
      const currentPlayerIndex = updatedSnapshot.players.findIndex(p => p.id === 'user1');
      
      if (currentPlayerIndex !== -1) {
        const player = updatedSnapshot.players[currentPlayerIndex];
        
        // Update player based on action
        switch (action) {
          case PlayerAction.FOLD:
            player.status = PlayerStatus.FOLDED;
            player.hasActed = true;
            break;
          case PlayerAction.CHECK:
            player.hasActed = true;
            break;
          case PlayerAction.CALL: {
            const callAmount = Math.max(...updatedSnapshot.players.map(p => p.currentBet)) - player.currentBet;
            player.currentBet += callAmount;
            player.chips -= callAmount;
            player.hasActed = true;
            break;
          }
          case PlayerAction.RAISE: {
            if (amount) {
              const raiseAmount = amount - player.currentBet;
              player.currentBet = amount;
              player.chips -= raiseAmount;
              player.hasActed = true;
            }
            break;
          }
          case PlayerAction.ALL_IN:
            player.currentBet += player.chips;
            player.chips = 0;
            player.status = PlayerStatus.ALL_IN;
            player.hasActed = true;
            break;
        }
        
        player.lastAction = action;
        
        // Add to action history
        updatedSnapshot.actionHistory.push({
          playerId: 'user1',
          action,
          amount: amount || 0,
          timestamp: Date.now(),
          phase: updatedSnapshot.phase
        });
        
        // Move to next player (simple mock logic)
        const nextPlayerIndex = (currentPlayerIndex + 1) % updatedSnapshot.players.length;
        updatedSnapshot.currentPlayerId = updatedSnapshot.players[nextPlayerIndex].id;
        
        setGameSnapshot(updatedSnapshot);
      }
    }
  };

  const handleLeaveGame = () => {
    navigate('/lobby');
  };

  if (!gameSnapshot) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">加载游戏中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* 顶部导航栏 */}
      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={handleLeaveGame}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          离开游戏
        </button>
        
        <div className="text-white text-center">
          <h1 className="text-xl font-bold">德州扑克</h1>
          <div className="text-sm text-gray-300">房间: {roomId}</div>
        </div>

        <div className="bg-gray-800 text-white px-4 py-2 rounded-lg">
          <div className="text-sm">我的筹码</div>
          <div className="font-bold">
            ${gameSnapshot.players.find(p => p.id === 'user1')?.chips.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 游戏区域 */}
      <div className="flex h-[calc(100vh-120px)] gap-4">
        {/* 左侧：操作历史 */}
        <div className="w-80 flex-shrink-0">
          <ActionHistory
            actions={gameSnapshot.actionHistory}
            players={gameSnapshot.players}
            maxItems={15}
            className="h-full"
          />
        </div>

        {/* 中间：游戏桌面 */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <GameTable
              gameSnapshot={gameSnapshot}
              currentUserId="user1" // Mock current user ID
              onPlayerAction={handlePlayerAction}
              className="w-full h-full"
            />
          </div>
          
          {/* 底部：操作面板 */}
          <div className="mt-4">
            <ActionPanel
              gameSnapshot={gameSnapshot}
              currentUserId="user1" // Mock current user ID
              onPlayerAction={handlePlayerAction}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;