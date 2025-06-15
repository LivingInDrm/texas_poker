/**
 * 筹码池类型
 */
export interface Pot {
  id: string;              // 池子ID
  amount: number;          // 池子金额
  eligiblePlayers: string[]; // 有资格赢得这个池子的玩家ID
  type: 'main' | 'side';   // 池子类型：主池或边池
}

/**
 * 玩家下注信息
 */
export interface PlayerBet {
  playerId: string;        // 玩家ID
  amount: number;          // 下注金额
  isAllIn: boolean;        // 是否全下
}

/**
 * 筹码池管理器
 * 负责处理德州扑克中复杂的筹码池分配，包括主池和边池的计算
 */
export class PotManager {
  private pots: Pot[] = [];
  private playerBets: Map<string, number> = new Map(); // 每个玩家在当前轮的总下注

  constructor() {
    this.reset();
  }

  /**
   * 重置所有筹码池
   */
  reset(): void {
    this.pots = [];
    this.playerBets.clear();
  }

  /**
   * 记录玩家下注
   * @param playerId 玩家ID
   * @param amount 下注金额
   * @param isAllIn 是否全下
   */
  addBet(playerId: string, amount: number, isAllIn: boolean = false): void {
    const currentBet = this.playerBets.get(playerId) || 0;
    this.playerBets.set(playerId, currentBet + amount);
  }

  /**
   * 计算筹码池分配
   * 这是德州扑克中最复杂的部分之一，需要正确处理全下玩家的边池
   */
  calculatePots(activePlayers: string[]): void {
    this.pots = [];
    
    if (this.playerBets.size === 0) {
      return;
    }

    // 获取所有玩家的下注信息，按下注金额排序
    const bets = Array.from(this.playerBets.entries())
      .map(([playerId, amount]) => ({ playerId, amount }))
      .filter(bet => bet.amount > 0)
      .sort((a, b) => a.amount - b.amount);

    if (bets.length === 0) {
      return;
    }

    let processedAmount = 0;
    let potId = 1;

    // 处理每一层的下注
    for (let i = 0; i < bets.length; i++) {
      const currentBetAmount = bets[i].amount;
      const layerAmount = currentBetAmount - processedAmount;
      
      if (layerAmount <= 0) {
        continue;
      }

      // 计算这一层有多少玩家参与
      const playersInThisLayer = bets.slice(i).map(bet => bet.playerId);
      
      // 只包含还在游戏中的玩家
      const eligiblePlayers = playersInThisLayer.filter(playerId => 
        activePlayers.includes(playerId)
      );

      if (eligiblePlayers.length === 0) {
        continue;
      }

      // 计算这个池子的总金额
      const potAmount = layerAmount * playersInThisLayer.length;

      // 创建筹码池
      const pot: Pot = {
        id: `pot-${potId++}`,
        amount: potAmount,
        eligiblePlayers: eligiblePlayers,
        type: i === 0 ? 'main' : 'side'
      };

      this.pots.push(pot);
      processedAmount = currentBetAmount;
    }
  }

  /**
   * 获取所有筹码池
   */
  getPots(): Pot[] {
    return [...this.pots];
  }

  /**
   * 获取主池
   */
  getMainPot(): Pot | null {
    return this.pots.find(pot => pot.type === 'main') || null;
  }

  /**
   * 获取所有边池
   */
  getSidePots(): Pot[] {
    return this.pots.filter(pot => pot.type === 'side');
  }

  /**
   * 获取总筹码池金额
   */
  getTotalPotAmount(): number {
    return this.pots.reduce((total, pot) => total + pot.amount, 0);
  }

  /**
   * 获取玩家的当前下注金额
   */
  getPlayerBet(playerId: string): number {
    return this.playerBets.get(playerId) || 0;
  }

  /**
   * 获取当前轮最高下注金额
   */
  getHighestBet(): number {
    return Math.max(0, ...Array.from(this.playerBets.values()));
  }

  /**
   * 获取玩家需要跟注的金额
   */
  getCallAmount(playerId: string): number {
    const playerBet = this.getPlayerBet(playerId);
    const highestBet = this.getHighestBet();
    return Math.max(0, highestBet - playerBet);
  }

  /**
   * 检查玩家是否已经跟注
   */
  hasPlayerCalled(playerId: string): boolean {
    return this.getCallAmount(playerId) === 0;
  }

  /**
   * 分配筹码池给获胜者
   * @param winners 每个筹码池的获胜者映射 { potId: [winnerId1, winnerId2, ...] }
   * @returns 每个玩家赢得的金额 { playerId: amount }
   */
  distributePots(winners: Record<string, string[]>): Record<string, number> {
    const winnings: Record<string, number> = {};

    for (const pot of this.pots) {
      const potWinners = winners[pot.id] || [];
      
      if (potWinners.length === 0) {
        continue;
      }

      // 平均分配筹码池（如果有多个赢家）
      const winningPerPlayer = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount % potWinners.length;

      for (let i = 0; i < potWinners.length; i++) {
        const winnerId = potWinners[i];
        winnings[winnerId] = (winnings[winnerId] || 0) + winningPerPlayer;
        
        // 余数给前几个赢家
        if (i < remainder) {
          winnings[winnerId] += 1;
        }
      }
    }

    return winnings;
  }

  /**
   * 开始新的下注轮
   */
  startNewBettingRound(): void {
    this.playerBets.clear();
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): any {
    return {
      pots: this.pots,
      playerBets: Object.fromEntries(this.playerBets),
      totalPot: this.getTotalPotAmount(),
      highestBet: this.getHighestBet()
    };
  }

  /**
   * 从另一个PotManager复制状态（用于游戏状态同步）
   */
  copyFrom(other: PotManager): void {
    this.pots = other.pots.map(pot => ({ ...pot, eligiblePlayers: [...pot.eligiblePlayers] }));
    this.playerBets = new Map(other.playerBets);
  }

  /**
   * 验证筹码池的完整性（调试用）
   */
  validatePots(): boolean {
    // 检查是否有重复的池子ID
    const potIds = this.pots.map(pot => pot.id);
    if (new Set(potIds).size !== potIds.length) {
      console.error('Duplicate pot IDs found');
      return false;
    }

    // 检查池子金额是否为正数
    for (const pot of this.pots) {
      if (pot.amount <= 0) {
        console.error(`Invalid pot amount: ${pot.amount}`);
        return false;
      }
      
      if (pot.eligiblePlayers.length === 0) {
        console.error(`Pot ${pot.id} has no eligible players`);
        return false;
      }
    }

    return true;
  }
}