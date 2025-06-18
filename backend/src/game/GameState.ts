import { Card } from './Card';
import { Deck } from './Deck';
import { PotManager } from './PotManager';
import { PositionManager } from './PositionManager';
import { HandEvaluator, HandRank } from './HandRank';

/**
 * 游戏阶段枚举
 */
export enum GamePhase {
  WAITING = 'waiting',       // 等待玩家加入
  PRE_FLOP = 'pre_flop',     // 翻牌前
  FLOP = 'flop',             // 翻牌
  TURN = 'turn',             // 转牌
  RIVER = 'river',           // 河牌
  SHOWDOWN = 'showdown',     // 摊牌
  FINISHED = 'finished'      // 游戏结束
}

/**
 * 玩家操作类型
 */
export enum PlayerAction {
  FOLD = 'fold',             // 弃牌
  CHECK = 'check',           // 过牌
  CALL = 'call',             // 跟注
  RAISE = 'raise',           // 加注
  ALL_IN = 'all_in'          // 全下
}

/**
 * 玩家状态
 */
export enum PlayerStatus {
  ACTIVE = 'active',         // 活跃（可以行动）
  FOLDED = 'folded',         // 已弃牌
  ALL_IN = 'all_in',         // 全下
  SITTING_OUT = 'sitting_out' // 暂离
}

/**
 * 游戏中的玩家信息
 */
export interface GamePlayer {
  id: string;                // 玩家ID
  name: string;              // 玩家名称
  chips: number;             // 筹码数量
  status: PlayerStatus;      // 玩家状态
  cards: Card[];             // 手牌
  currentBet: number;        // 当前轮次下注金额
  totalBet: number;          // 总下注金额
  hasActed: boolean;         // 本轮是否已行动
  isReady: boolean;          // 是否准备好
  lastAction?: PlayerAction; // 最后一次操作
  timeoutAt?: number;        // 超时时间戳
}

/**
 * 游戏操作记录
 */
export interface GameAction {
  playerId: string;          // 玩家ID
  action: PlayerAction;      // 操作类型
  amount: number;            // 金额
  timestamp: number;         // 时间戳
  phase: GamePhase;          // 游戏阶段
}

/**
 * 游戏结果
 */
export interface GameResult {
  winners: Array<{
    playerId: string;
    hand: HandRank | null;
    winAmount: number;
    potIds: string[];
  }>;
  pots: Array<{
    id: string;
    amount: number;
    winnerIds: string[];
  }>;
  actions: GameAction[];
  duration: number;          // 游戏持续时间（毫秒）
}

/**
 * 游戏状态管理器
 */
export class GameState {
  private gameId: string;
  private players: Map<string, GamePlayer> = new Map();
  private deck: Deck;
  private potManager: PotManager;
  private positionManager: PositionManager;
  
  private phase: GamePhase = GamePhase.WAITING;
  private communityCards: Card[] = [];
  private currentPlayerIndex: number = 0;
  private actionHistory: GameAction[] = [];
  
  private handStartTime: number = 0;
  private actionTimeoutMs: number = 30000; // 30秒操作超时
  private isHandInProgress: boolean = false;
  
  constructor(
    gameId: string,
    smallBlind: number = 10,
    bigBlind: number = 20,
    actionTimeout: number = 30000
  ) {
    this.gameId = gameId;
    this.deck = new Deck();
    this.potManager = new PotManager();
    this.positionManager = new PositionManager(smallBlind, bigBlind);
    this.actionTimeoutMs = actionTimeout;
  }

  /**
   * 添加玩家到游戏
   */
  addPlayer(playerId: string, playerName: string, chips: number): boolean {
    if (this.players.has(playerId)) {
      return false; // 玩家已存在
    }

    if (this.isHandInProgress) {
      return false; // 游戏进行中不能加入
    }

    const player: GamePlayer = {
      id: playerId,
      name: playerName,
      chips,
      status: PlayerStatus.ACTIVE,
      cards: [],
      currentBet: 0,
      totalBet: 0,
      hasActed: false,
      isReady: false
    };

    this.players.set(playerId, player);
    return true;
  }

  /**
   * 移除玩家
   */
  removePlayer(playerId: string): boolean {
    if (!this.players.has(playerId)) {
      return false;
    }

    this.players.delete(playerId);
    
    if (this.isHandInProgress) {
      // 如果游戏进行中，从位置管理器中移除
      this.positionManager.removePlayer(playerId);
    }

    return true;
  }

  /**
   * 玩家准备/取消准备
   */
  setPlayerReady(playerId: string, ready: boolean): boolean {
    const player = this.players.get(playerId);
    if (!player) {
      return false;
    }

    player.isReady = ready;
    return true;
  }

  /**
   * 检查是否可以开始游戏
   */
  canStartGame(): boolean {
    if (this.phase !== GamePhase.WAITING) {
      return false;
    }

    const readyPlayers = Array.from(this.players.values())
      .filter(p => p.isReady && p.status === PlayerStatus.ACTIVE);
    
    return readyPlayers.length >= 2;
  }

  /**
   * 开始新一手牌
   */
  startNewHand(): boolean {
    if (!this.canStartGame()) {
      return false;
    }

    this.isHandInProgress = true;
    this.handStartTime = Date.now();
    this.phase = GamePhase.PRE_FLOP;
    this.communityCards = [];
    this.actionHistory = [];
    this.currentPlayerIndex = 0;

    // 重置玩家状态
    for (const player of this.players.values()) {
      if (player.isReady) {
        player.status = PlayerStatus.ACTIVE;
        player.cards = [];
        player.currentBet = 0;
        player.totalBet = 0;
        player.hasActed = false;
        player.lastAction = undefined;
        player.timeoutAt = undefined;
      }
    }

    // 设置位置管理器
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === PlayerStatus.ACTIVE)
      .map(p => p.id);
    
    this.positionManager.setPlayers(activePlayers);

    // 重置并发牌
    this.deck.reset();
    this.deck.shuffle();
    this.dealCards();

    // 下盲注
    this.postBlinds();

    // 设置第一个行动玩家（翻牌前从大盲下一位开始）
    const preflopOrder = this.positionManager.getPreflopBettingOrder();
    const firstActivePlayer = preflopOrder.find(playerId => {
      const player = this.players.get(playerId);
      return player && player.status === PlayerStatus.ACTIVE;
    });

    if (firstActivePlayer) {
      this.currentPlayerIndex = preflopOrder.indexOf(firstActivePlayer);
      const player = this.players.get(firstActivePlayer)!;
      player.timeoutAt = Date.now() + this.actionTimeoutMs;
    }

    return true;
  }

  /**
   * 发手牌
   */
  private dealCards(): void {
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === PlayerStatus.ACTIVE);

    for (const player of activePlayers) {
      player.cards = this.deck.dealCards(2);
    }
  }

  /**
   * 下盲注
   */
  private postBlinds(): void {
    const smallBlindId = this.positionManager.getSmallBlindId();
    const bigBlindId = this.positionManager.getBigBlindId();
    const blindAmounts = this.positionManager.getBlindAmounts();

    if (smallBlindId) {
      this.forceBet(smallBlindId, blindAmounts.smallBlind);
    }

    if (bigBlindId) {
      this.forceBet(bigBlindId, blindAmounts.bigBlind);
    }
  }

  /**
   * 强制下注（盲注）
   */
  private forceBet(playerId: string, amount: number): void {
    const player = this.players.get(playerId);
    if (!player) return;

    const actualAmount = Math.min(amount, player.chips);
    player.chips -= actualAmount;
    player.currentBet += actualAmount;
    player.totalBet += actualAmount;
    
    this.potManager.addBet(playerId, actualAmount);

    if (player.chips === 0) {
      player.status = PlayerStatus.ALL_IN;
    }
  }

  /**
   * 执行玩家操作
   */
  executePlayerAction(playerId: string, action: PlayerAction, amount: number = 0): boolean {
    if (!this.isValidAction(playerId, action, amount)) {
      return false;
    }

    const player = this.players.get(playerId)!;
    const gameAction: GameAction = {
      playerId,
      action,
      amount,
      timestamp: Date.now(),
      phase: this.phase
    };

    switch (action) {
      case PlayerAction.FOLD:
        player.status = PlayerStatus.FOLDED;
        break;

      case PlayerAction.CHECK:
        // 无需额外处理
        break;

      case PlayerAction.CALL:
        const callAmount = this.potManager.getCallAmount(playerId);
        const actualCallAmount = Math.min(callAmount, player.chips);
        player.chips -= actualCallAmount;
        player.currentBet += actualCallAmount;
        player.totalBet += actualCallAmount;
        this.potManager.addBet(playerId, actualCallAmount);
        
        if (player.chips === 0) {
          player.status = PlayerStatus.ALL_IN;
          gameAction.action = PlayerAction.ALL_IN;
        }
        break;

      case PlayerAction.RAISE:
        const raiseAmount = Math.min(amount, player.chips);
        player.chips -= raiseAmount;
        player.currentBet += raiseAmount;
        player.totalBet += raiseAmount;
        this.potManager.addBet(playerId, raiseAmount);
        
        if (player.chips === 0) {
          player.status = PlayerStatus.ALL_IN;
          gameAction.action = PlayerAction.ALL_IN;
        }
        break;

      case PlayerAction.ALL_IN:
        const allInAmount = player.chips;
        player.chips = 0;
        player.currentBet += allInAmount;
        player.totalBet += allInAmount;
        player.status = PlayerStatus.ALL_IN;
        this.potManager.addBet(playerId, allInAmount);
        gameAction.amount = allInAmount;
        break;
    }

    player.hasActed = true;
    player.lastAction = gameAction.action;
    player.timeoutAt = undefined;
    this.actionHistory.push(gameAction);

    // 检查是否只剩一个活跃玩家
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === PlayerStatus.ACTIVE);
    
    if (activePlayers.length <= 1) {
      // 只剩一个或没有活跃玩家，游戏结束
      this.potManager.calculatePots(activePlayers.map(p => p.id));
      this.phase = GamePhase.FINISHED;
      this.isHandInProgress = false;
      return true;
    }

    // 检查是否需要进入下一阶段
    if (this.isBettingRoundComplete()) {
      this.nextPhase();
    } else {
      this.setNextPlayer();
      // 如果设置下一个玩家后，发现没有玩家需要行动，直接进入下一阶段
      if (this.currentPlayerIndex === -1) {
        this.nextPhase();
      }
    }

    return true;
  }

  /**
   * 验证操作是否有效
   */
  private isValidAction(playerId: string, action: PlayerAction, amount: number): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    if (player.status !== PlayerStatus.ACTIVE) return false;
    if (this.getCurrentPlayerId() !== playerId) return false;

    const callAmount = this.potManager.getCallAmount(playerId);
    const minRaiseAmount = this.getMinRaiseAmount();

    switch (action) {
      case PlayerAction.FOLD:
        return true;

      case PlayerAction.CHECK:
        return callAmount === 0;

      case PlayerAction.CALL:
        return callAmount > 0 && player.chips >= callAmount;

      case PlayerAction.RAISE:
        return amount >= minRaiseAmount && player.chips >= amount;

      case PlayerAction.ALL_IN:
        return player.chips > 0;

      default:
        return false;
    }
  }

  /**
   * 获取最小加注金额
   */
  private getMinRaiseAmount(): number {
    const callAmount = this.potManager.getCallAmount(this.getCurrentPlayerId()!);
    const blindAmounts = this.positionManager.getBlindAmounts();
    const minRaise = blindAmounts.bigBlind; // 最小加注为大盲金额
    
    return callAmount + minRaise;
  }

  /**
   * 检查下注轮是否完成
   */
  private isBettingRoundComplete(): boolean {
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === PlayerStatus.ACTIVE);

    if (activePlayers.length <= 1) {
      return true; // 只剩一个或没有活跃玩家
    }

    // 检查是否所有活跃玩家都已行动且下注金额一致
    const highestBet = this.potManager.getHighestBet();
    
    // 对于翻牌前，大盲玩家有特殊权利
    if (this.phase === GamePhase.PRE_FLOP) {
      const bigBlindId = this.positionManager.getBigBlindId();
      let bigBlindHasOption = false;
      
      // 如果没有人加注超过大盲，大盲有选择权
      const blindAmounts = this.positionManager.getBlindAmounts();
      if (highestBet === blindAmounts.bigBlind) {
        const bigBlindPlayer = this.players.get(bigBlindId!);
        if (bigBlindPlayer && !bigBlindPlayer.hasActed) {
          bigBlindHasOption = true;
        }
      }
      
      if (bigBlindHasOption) {
        return false; // 大盲还有行动权
      }
    }

    // 检查所有玩家是否都已行动且下注一致
    for (const player of activePlayers) {
      if (!player.hasActed) {
        return false;
      }
      if (player.currentBet !== highestBet && player.status !== PlayerStatus.ALL_IN) {
        return false;
      }
    }

    return true;
  }

  /**
   * 进入下一阶段
   */
  private nextPhase(): void {
    // 计算当前轮的筹码池
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status !== PlayerStatus.FOLDED)
      .map(p => p.id);
    this.potManager.calculatePots(activePlayers);

    // 重置玩家行动状态
    for (const player of this.players.values()) {
      if (player.status === PlayerStatus.ACTIVE) {
        player.hasActed = false;
        player.currentBet = 0;
      }
    }

    // 开始新的下注轮
    this.potManager.startNewBettingRound();

    switch (this.phase) {
      case GamePhase.PRE_FLOP:
        this.phase = GamePhase.FLOP;
        this.communityCards = this.deck.dealCards(3);
        break;

      case GamePhase.FLOP:
        this.phase = GamePhase.TURN;
        this.communityCards.push(...this.deck.dealCards(1));
        break;

      case GamePhase.TURN:
        this.phase = GamePhase.RIVER;
        this.communityCards.push(...this.deck.dealCards(1));
        break;

      case GamePhase.RIVER:
        this.phase = GamePhase.SHOWDOWN;
        this.showdown();
        return;

      default:
        return;
    }

    // 重置下注顺序，从小盲开始
    const bettingOrder = this.positionManager.getBettingOrder();
    const firstActivePlayer = bettingOrder.find(playerId => {
      const player = this.players.get(playerId);
      return player && player.status === PlayerStatus.ACTIVE;
    });

    if (firstActivePlayer) {
      this.currentPlayerIndex = bettingOrder.indexOf(firstActivePlayer);
      const player = this.players.get(firstActivePlayer)!;
      player.timeoutAt = Date.now() + this.actionTimeoutMs;
    } else {
      this.currentPlayerIndex = -1;
    }
  }

  /**
   * 摊牌阶段
   */
  private showdown(): void {
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status !== PlayerStatus.FOLDED);

    // 计算筹码池
    this.potManager.calculatePots(activePlayers.map(p => p.id));

    // 评估所有玩家的手牌
    const handRanks = new Map<string, HandRank>();
    for (const player of activePlayers) {
      const allCards = [...player.cards, ...this.communityCards];
      handRanks.set(player.id, HandEvaluator.evaluateHand(allCards));
    }

    // 为每个筹码池确定赢家
    const pots = this.potManager.getPots();
    const winners: Record<string, string[]> = {};

    for (const pot of pots) {
      const eligiblePlayers = pot.eligiblePlayers.filter(id => 
        activePlayers.some(p => p.id === id)
      );

      if (eligiblePlayers.length === 0) continue;

      // 找到最好的手牌
      let bestHand: HandRank | null = null;
      let potWinners: string[] = [];

      for (const playerId of eligiblePlayers) {
        const hand = handRanks.get(playerId)!;
        if (!bestHand || HandEvaluator.compareHands(hand, bestHand) > 0) {
          bestHand = hand;
          potWinners = [playerId];
        } else if (HandEvaluator.compareHands(hand, bestHand) === 0) {
          potWinners.push(playerId);
        }
      }

      winners[pot.id] = potWinners;
    }

    // 分配筹码
    const winnings = this.potManager.distributePots(winners);
    for (const [playerId, amount] of Object.entries(winnings)) {
      const player = this.players.get(playerId);
      if (player) {
        player.chips += amount;
      }
    }

    this.phase = GamePhase.FINISHED;
    this.isHandInProgress = false;
  }

  /**
   * 设置下一个行动玩家
   */
  private setNextPlayer(): void {
    const bettingOrder = this.phase === GamePhase.PRE_FLOP
      ? this.positionManager.getPreflopBettingOrder()
      : this.positionManager.getBettingOrder();

    const activePlayers = bettingOrder.filter(playerId => {
      const player = this.players.get(playerId);
      return player && player.status === PlayerStatus.ACTIVE;
    });

    if (activePlayers.length === 0) {
      this.currentPlayerIndex = -1;
      return;
    }

    // 找到当前玩家在下注顺序中的位置
    const currentPlayerId = this.getCurrentPlayerId();
    let startIndex = 0;
    if (currentPlayerId) {
      startIndex = activePlayers.findIndex(id => id === currentPlayerId);
      if (startIndex === -1) startIndex = 0;
      else startIndex = (startIndex + 1) % activePlayers.length;
    }

    // 从下一个玩家开始寻找需要行动的玩家
    for (let i = 0; i < activePlayers.length; i++) {
      const index = (startIndex + i) % activePlayers.length;
      const playerId = activePlayers[index];
      const player = this.players.get(playerId)!;
      
      // 只有尚未行动的玩家，或已行动但下注不够的玩家才需要继续行动
      if (!player.hasActed || (player.hasActed && player.currentBet < this.potManager.getHighestBet())) {
        this.currentPlayerIndex = index;
        player.timeoutAt = Date.now() + this.actionTimeoutMs;
        return;
      }
    }

    // 如果没有找到需要行动的玩家，说明这轮下注结束了
    this.currentPlayerIndex = -1;
  }

  /**
   * 处理超时
   */
  handleTimeout(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || this.getCurrentPlayerId() !== playerId) {
      return false;
    }

    if (player.timeoutAt && Date.now() >= player.timeoutAt) {
      // 超时自动弃牌
      return this.executePlayerAction(playerId, PlayerAction.FOLD);
    }

    return false;
  }

  /**
   * 获取当前行动玩家ID
   */
  getCurrentPlayerId(): string | null {
    if (this.phase === GamePhase.WAITING || this.phase === GamePhase.FINISHED || this.currentPlayerIndex === -1) {
      return null;
    }

    const bettingOrder = this.phase === GamePhase.PRE_FLOP
      ? this.positionManager.getPreflopBettingOrder()
      : this.positionManager.getBettingOrder();

    const activePlayers = bettingOrder.filter(playerId => {
      const player = this.players.get(playerId);
      return player && player.status === PlayerStatus.ACTIVE;
    });

    if (this.currentPlayerIndex >= 0 && this.currentPlayerIndex < activePlayers.length) {
      return activePlayers[this.currentPlayerIndex];
    }

    return null;
  }

  /**
   * 获取游戏状态快照
   */
  getGameSnapshot(): any {
    return {
      gameId: this.gameId,
      phase: this.phase,
      players: Array.from(this.players.values()),
      communityCards: this.communityCards,
      pots: this.potManager.getPots(),
      currentPlayerId: this.getCurrentPlayerId(),
      actionHistory: this.actionHistory,
      isHandInProgress: this.isHandInProgress,
      positions: this.positionManager.getAllPositions()
    };
  }

  /**
   * 获取游戏结果
   */
  getGameResult(): GameResult | null {
    if (this.phase !== GamePhase.FINISHED) {
      return null;
    }

    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status !== PlayerStatus.FOLDED);

    const winners = activePlayers.map(player => {
      let hand: HandRank | null = null;
      // 只有在有足够公共牌时才评估手牌
      if (this.communityCards.length === 5) {
        hand = HandEvaluator.evaluateHand([...player.cards, ...this.communityCards]);
      }
      
      return {
        playerId: player.id,
        hand,
        winAmount: 0, // 这个值在分配筹码时会被更新
        potIds: [] as string[]
      };
    });

    const pots = this.potManager.getPots().map(pot => ({
      id: pot.id,
      amount: pot.amount,
      winnerIds: [] as string[]
    }));

    return {
      winners,
      pots,
      actions: [...this.actionHistory],
      duration: Date.now() - this.handStartTime
    };
  }

  /**
   * 重置游戏到等待状态
   */
  reset(): void {
    this.phase = GamePhase.WAITING;
    this.communityCards = [];
    this.actionHistory = [];
    this.currentPlayerIndex = 0;
    this.isHandInProgress = false;
    this.handStartTime = 0;

    // 重置所有玩家状态
    for (const player of this.players.values()) {
      player.status = PlayerStatus.ACTIVE;
      player.cards = [];
      player.currentBet = 0;
      player.totalBet = 0;
      player.hasActed = false;
      player.isReady = false;
      player.lastAction = undefined;
      player.timeoutAt = undefined;
    }

    this.potManager.reset();
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): any {
    return {
      gameId: this.gameId,
      phase: this.phase,
      players: Array.from(this.players.values()),
      communityCards: this.communityCards,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.getCurrentPlayerId(),
      isHandInProgress: this.isHandInProgress,
      potManager: this.potManager.getDebugInfo(),
      positionManager: this.positionManager.getDebugInfo(),
      actionHistory: this.actionHistory
    };
  }

  /**
   * 获取玩家可执行的有效操作
   */
  getValidActions(playerId: string): PlayerAction[] {
    const player = this.players.get(playerId);
    if (!player || player.status !== PlayerStatus.ACTIVE) {
      return [];
    }

    if (this.getCurrentPlayerId() !== playerId) {
      return [];
    }

    const validActions: PlayerAction[] = [];
    const callAmount = this.potManager.getCallAmount(playerId);
    const minRaiseAmount = this.getMinRaiseAmount();

    // 弃牌（除非已经全下，否则总是可以弃牌）
    if (player.status === PlayerStatus.ACTIVE) {
      validActions.push(PlayerAction.FOLD);
    }

    // 过牌（当没有人下注时）
    if (callAmount === 0) {
      validActions.push(PlayerAction.CHECK);
    }

    // 跟注（当有人下注且玩家筹码足够时）
    if (callAmount > 0 && player.chips >= callAmount) {
      validActions.push(PlayerAction.CALL);
    }

    // 加注（当玩家筹码足够时）
    if (player.chips >= minRaiseAmount) {
      validActions.push(PlayerAction.RAISE);
    }

    // 全下（当玩家还有筹码时）
    if (player.chips > 0) {
      validActions.push(PlayerAction.ALL_IN);
    }

    return validActions;
  }

  /**
   * 获取当前玩家（用于兼容）
   */
  getCurrentPlayer(): GamePlayer | null {
    const playerId = this.getCurrentPlayerId();
    return playerId ? this.players.get(playerId) || null : null;
  }

  /**
   * 执行玩家操作（别名方法）
   */
  makeAction(playerId: string, action: PlayerAction, amount: number = 0): boolean {
    return this.executePlayerAction(playerId, action, amount);
  }

  /**
   * 检查游戏阶段是否发生变化（临时标记）
   */
  private lastKnownPhase: GamePhase = GamePhase.WAITING;
  
  hasPhaseChanged(): boolean {
    if (this.lastKnownPhase !== this.phase) {
      this.lastKnownPhase = this.phase;
      return true;
    }
    return false;
  }

  /**
   * 获取游戏状态（别名方法）
   */
  getState(): any {
    return this.getGameSnapshot();
  }

  /**
   * 获取游戏结果（别名方法）
   */
  getResults(): GameResult | null {
    return this.getGameResult();
  }
}