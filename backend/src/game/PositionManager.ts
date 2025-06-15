/**
 * 玩家位置信息
 */
export interface PlayerPosition {
  playerId: string;        // 玩家ID
  seatIndex: number;       // 座位索引 (0-based)
  isDealer: boolean;       // 是否为庄家
  isSmallBlind: boolean;   // 是否为小盲
  isBigBlind: boolean;     // 是否为大盲
}

/**
 * 位置管理器
 * 负责管理德州扑克中的庄家位置、盲注位置的轮转
 */
export class PositionManager {
  private players: string[] = [];           // 玩家ID列表，按座位顺序
  private dealerIndex: number = 0;          // 庄家位置索引
  private smallBlindAmount: number = 0;     // 小盲金额
  private bigBlindAmount: number = 0;       // 大盲金额

  constructor(smallBlind: number, bigBlind: number) {
    this.smallBlindAmount = smallBlind;
    this.bigBlindAmount = bigBlind;
  }

  /**
   * 设置玩家列表和初始庄家位置
   * @param players 玩家ID列表，按座位顺序
   * @param initialDealerIndex 初始庄家位置索引
   */
  setPlayers(players: string[], initialDealerIndex: number = 0): void {
    if (players.length < 2) {
      throw new Error('At least 2 players required');
    }
    
    this.players = [...players];
    this.dealerIndex = Math.max(0, Math.min(initialDealerIndex, players.length - 1));
  }

  /**
   * 移动到下一手牌（庄家位置顺时针移动）
   */
  nextHand(): void {
    if (this.players.length === 0) {
      return;
    }
    
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
  }

  /**
   * 获取当前庄家玩家ID
   */
  getDealerId(): string | null {
    if (this.players.length === 0) {
      return null;
    }
    return this.players[this.dealerIndex];
  }

  /**
   * 获取小盲玩家ID
   */
  getSmallBlindId(): string | null {
    if (this.players.length < 2) {
      return null;
    }
    
    // 2人游戏：庄家是小盲
    // 3人以上：庄家下一位是小盲
    const smallBlindIndex = this.players.length === 2 
      ? this.dealerIndex 
      : (this.dealerIndex + 1) % this.players.length;
    
    return this.players[smallBlindIndex];
  }

  /**
   * 获取大盲玩家ID
   */
  getBigBlindId(): string | null {
    if (this.players.length < 2) {
      return null;
    }
    
    // 2人游戏：非庄家是大盲
    // 3人以上：庄家下两位是大盲
    const bigBlindIndex = this.players.length === 2
      ? (this.dealerIndex + 1) % this.players.length
      : (this.dealerIndex + 2) % this.players.length;
    
    return this.players[bigBlindIndex];
  }

  /**
   * 获取所有玩家的位置信息
   */
  getAllPositions(): PlayerPosition[] {
    const positions: PlayerPosition[] = [];
    const dealerId = this.getDealerId();
    const smallBlindId = this.getSmallBlindId();
    const bigBlindId = this.getBigBlindId();

    for (let i = 0; i < this.players.length; i++) {
      const playerId = this.players[i];
      positions.push({
        playerId,
        seatIndex: i,
        isDealer: playerId === dealerId,
        isSmallBlind: playerId === smallBlindId,
        isBigBlind: playerId === bigBlindId
      });
    }

    return positions;
  }

  /**
   * 获取特定玩家的位置信息
   */
  getPlayerPosition(playerId: string): PlayerPosition | null {
    const positions = this.getAllPositions();
    return positions.find(pos => pos.playerId === playerId) || null;
  }

  /**
   * 获取下注顺序（从小盲开始，按顺时针方向）
   * @param excludeAllIn 是否排除全下的玩家
   */
  getBettingOrder(excludeAllIn: string[] = []): string[] {
    if (this.players.length < 2) {
      return [];
    }

    const availablePlayers = this.players.filter(id => !excludeAllIn.includes(id));
    
    if (availablePlayers.length === 0) {
      return [];
    }

    // 从小盲开始的下注顺序
    const smallBlindId = this.getSmallBlindId();
    const smallBlindIndex = this.players.findIndex(id => id === smallBlindId);
    
    if (smallBlindIndex === -1) {
      return availablePlayers;
    }

    const bettingOrder: string[] = [];
    for (let i = 0; i < this.players.length; i++) {
      const index = (smallBlindIndex + i) % this.players.length;
      const playerId = this.players[index];
      if (availablePlayers.includes(playerId)) {
        bettingOrder.push(playerId);
      }
    }

    return bettingOrder;
  }

  /**
   * 获取翻牌前的下注顺序（大盲后开始）
   */
  getPreflopBettingOrder(excludeAllIn: string[] = []): string[] {
    if (this.players.length < 2) {
      return [];
    }

    const availablePlayers = this.players.filter(id => !excludeAllIn.includes(id));
    
    // 翻牌前从大盲下一位开始
    const bigBlindId = this.getBigBlindId();
    const bigBlindIndex = this.players.findIndex(id => id === bigBlindId);
    
    if (bigBlindIndex === -1) {
      return availablePlayers;
    }

    const bettingOrder: string[] = [];
    for (let i = 1; i <= this.players.length; i++) {
      const index = (bigBlindIndex + i) % this.players.length;
      const playerId = this.players[index];
      if (availablePlayers.includes(playerId)) {
        bettingOrder.push(playerId);
      }
    }

    return bettingOrder;
  }

  /**
   * 获取盲注金额信息
   */
  getBlindAmounts(): { smallBlind: number; bigBlind: number } {
    return {
      smallBlind: this.smallBlindAmount,
      bigBlind: this.bigBlindAmount
    };
  }

  /**
   * 更新盲注金额
   */
  updateBlindAmounts(smallBlind: number, bigBlind: number): void {
    if (smallBlind <= 0 || bigBlind <= 0) {
      throw new Error('Blind amounts must be positive');
    }
    
    if (bigBlind <= smallBlind) {
      throw new Error('Big blind must be greater than small blind');
    }

    this.smallBlindAmount = smallBlind;
    this.bigBlindAmount = bigBlind;
  }

  /**
   * 移除玩家（玩家离开桌子时）
   */
  removePlayer(playerId: string): void {
    const playerIndex = this.players.findIndex(id => id === playerId);
    if (playerIndex === -1) {
      return;
    }

    // 如果移除的玩家在庄家之前，需要调整庄家索引
    if (playerIndex < this.dealerIndex) {
      this.dealerIndex--;
    } else if (playerIndex === this.dealerIndex) {
      // 如果移除的是当前庄家，保持索引位置但确保在有效范围内
      if (this.dealerIndex >= this.players.length - 1) {
        this.dealerIndex = 0;
      }
      // 如果移除的不是最后一位，dealerIndex保持不变，这样下一位自动成为庄家
    }

    this.players.splice(playerIndex, 1);

    // 确保庄家索引在有效范围内
    if (this.players.length > 0) {
      this.dealerIndex = Math.min(this.dealerIndex, this.players.length - 1);
    }
  }

  /**
   * 添加玩家（新玩家加入桌子时）
   */
  addPlayer(playerId: string, seatIndex?: number): void {
    if (this.players.includes(playerId)) {
      return; // 玩家已存在
    }

    if (seatIndex !== undefined && seatIndex >= 0 && seatIndex <= this.players.length) {
      this.players.splice(seatIndex, 0, playerId);
      
      // 如果插入位置在庄家之前或同位置，需要调整庄家索引
      if (seatIndex <= this.dealerIndex) {
        this.dealerIndex++;
      }
    } else {
      this.players.push(playerId);
    }
  }

  /**
   * 获取玩家数量
   */
  getPlayerCount(): number {
    return this.players.length;
  }

  /**
   * 获取所有玩家ID
   */
  getAllPlayerIds(): string[] {
    return [...this.players];
  }

  /**
   * 检查玩家是否在桌子上
   */
  hasPlayer(playerId: string): boolean {
    return this.players.includes(playerId);
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): any {
    return {
      players: this.players,
      dealerIndex: this.dealerIndex,
      dealerId: this.getDealerId(),
      smallBlindId: this.getSmallBlindId(),
      bigBlindId: this.getBigBlindId(),
      blindAmounts: this.getBlindAmounts(),
      positions: this.getAllPositions()
    };
  }

  /**
   * 从另一个PositionManager复制状态
   */
  copyFrom(other: PositionManager): void {
    this.players = [...other.players];
    this.dealerIndex = other.dealerIndex;
    this.smallBlindAmount = other.smallBlindAmount;
    this.bigBlindAmount = other.bigBlindAmount;
  }

  /**
   * 验证位置管理器状态的完整性
   */
  validateState(): boolean {
    // 检查玩家数量（允许0个玩家用于初始状态）
    if (this.players.length > 0 && this.players.length < 2) {
      console.error('Not enough players');
      return false;
    }

    // 检查庄家索引（只在有玩家时检查）
    if (this.players.length > 0 && (this.dealerIndex < 0 || this.dealerIndex >= this.players.length)) {
      console.error('Invalid dealer index');
      return false;
    }

    // 检查盲注金额
    if (this.smallBlindAmount <= 0 || this.bigBlindAmount <= 0) {
      console.error('Invalid blind amounts');
      return false;
    }

    if (this.bigBlindAmount <= this.smallBlindAmount) {
      console.error('Big blind must be greater than small blind');
      return false;
    }

    // 检查是否有重复玩家
    const uniquePlayers = new Set(this.players);
    if (uniquePlayers.size !== this.players.length) {
      console.error('Duplicate players found');
      return false;
    }

    return true;
  }
}