// src/types/game.ts
/**
 * 游戏核心类型定义
 * 适配 websocketStore.ts 和 PlayerPanel.tsx 的完整类型声明
 */

// ====================== 基础枚举/类型 ======================
/** 楼层类型 */
export type Floor = 'attic' | 'second' | 'first' | 'basement';

/** 地点类型 */
export type LocationType = 'normal' | 'special' | 'crime' | 'garden';

/** 道具类型 */
export type ItemType = 'bandage' | 'powder' | 'extinguisher' | 'rope' | 'ski';

/** 角色类型 - 完整版（包含服务器所有角色） */
export type RoleType = 
  | 'detective'    // 侦探
  | 'killer'       // 凶手
  | 'murderer'     // 凶手（别名）
  | 'accomplice'   // 帮凶
  | 'bad_fan'      // 坏粉丝
  | 'good_fan'     // 好粉丝
  | 'doctor'       // 医生
  | 'engineer'     // 工程师
  | 'hacker'       // 黑客
  | 'innocent';    // 平民/粉丝

/** 角色类型 - 别名（兼容旧代码） */
export type Role = RoleType;

/** 阵营类型 - 完整版 */
export type CampType = 
  | 'good'       // 好人阵营
  | 'detective'  // 侦探阵营（服务器使用）
  | 'evil'       // 坏人阵营
  | 'killer'     // 凶手阵营（服务器使用）
  | 'neutral';   // 中立阵营

/** 游戏步骤类型 - 用于PlayerPanel（字符串类型） */
export type ActionStep = 'move' | 'useItem' | 'vote' | 'skill';

/** 行动步骤详情 - 用于websocketStore（对象类型） */
export interface ActionStepDetail {
  step: number;
  locationId: string;
  action?: string;
  cost?: number;
}

/** 游戏阶段类型 - 用于websocketStore */
export type Phase = 'lobby' | 'config' | 'action' | 'free' | 'settlement' | 'ended';

/** 游戏状态类型 - 用于PlayerPanel（简单状态） */
export type GameStateSimple = 'waiting' | 'playing' | 'ended';

// ====================== 核心接口 ======================
/** 地点接口 */
export interface Location {
  id: string;
  name: string;
  floor: Floor;
  type: LocationType;
  connections: string[];
  description: string;
}

/** 玩家接口 - 完整版（兼容 PlayerPanel 和 websocketStore） */
export interface Player {
  /** 玩家唯一标识 */
  id: string;
  /** 玩家名称（如"1号玩家"） */
  name: string;
  /** 角色类型 */
  role: RoleType;
  /** 阵营类型 */
  camp: CampType;
  /** 生命值 */
  health: number;
  /** 最大生命值 */
  maxHealth: number;
  /** 行动点数 */
  actionPoints: number;
  /** 当前所在地点ID（服务器字段） */
  currentLocation: string;
  /** 当前所在地点ID（PlayerPanel兼容字段） */
  locationId: string;
  /** 行动线 */
  actionLine: ActionStepDetail[];
  /** 假行动线（凶手用） */
  fakeActionLine?: ActionStepDetail[];
  /** 道具列表 */
  items: ItemType[];
  /** 分数 */
  score: number;
  /** 是否存活 */
  isAlive: boolean;
  /** 是否暴露 */
  isExposed: boolean;
  /** 已访问地点 */
  visitedLocations: string[];
  /** 本轮是否使用技能 */
  skillUsedThisRound: boolean;
  /** 假行动线数量（凶手） */
  fakeActionLineCount?: number;
  /** 放火次数（帮凶） */
  fireCount?: number;
  /** 是否检查过迷药 */
  hasCheckedFan?: boolean;
  /** 正确投票次数 */
  totalVotesCorrect?: number;
  /** 本轮投票目标 */
  votesThisRound?: string | null;
  /** WebSocket连接（不序列化） */
  ws?: any;
}

/** 交易请求接口 */
export interface TradeRequest {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerItem: ItemType;
  requestItem: ItemType;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

/** 游戏设置接口 */
export interface GameSettings {
  allowRoleReveal: boolean;
  timeLimit: number;
}

/** 游戏状态接口 - 用于websocketStore（完整对象） */
export interface GameState {
  id: string;
  roomCode: string;
  round: number;
  phase: Phase;
  players: Player[];
  locations: Location[];
  fireLocations: string[];
  lightLocations: string[];
  currentPlayerIndex: number;
  votes: Record<string, string>;
  voteRecords: any[];
  tradeRequests: TradeRequest[];
  settings: GameSettings;
  /** 可选：迷药目标 */
  powderTarget?: string;
  /** 可选：侦探目标 */
  detectiveTarget?: string;
  /** 可选：主持人ID */
  hostId?: string;
}

/** 结算信息接口 */
export interface SettlementInfo {
  round: number;
  healthChanges: Array<{
    playerId: string;
    change: number;
    reason: string;
  }>;
  overlappingPlayers: Array<{
    locationId: string;
    players: string[];
  }>;
  exposedActionLines: Array<{
    playerId: string;
    actionLine: ActionStepDetail[];
    isFake: boolean;
  }>;
  fireDamage: Array<{
    playerId: string;
    locationId: string;
  }>;
  attackDamage: Array<{
    playerId: string;
    attackerId: string;
  }>;
  healEffects: Array<{
    playerId: string;
    healerId: string;
  }>;
  nextRoundFireLocations: string[];
  nextRoundLightLocations: string[];
  voteResults: Array<{
    voterId: string;
    targetId: string;
    isCorrect: boolean;
  }>;
}

/** 投票记录接口 */
export interface VoteRecord {
  voterId: string;
  targetId: string;
  timestamp: number;
}

/** 游戏房间接口 - 简化版 */
export interface GameRoom {
  roomId: string;
  roomCode: string;
  state: GameStateSimple;
  currentStep: ActionStep;
  players: Player[];
  voteRecords: VoteRecord[];
  round: number;
  createTime: number;
}

// ====================== WebSocket 相关类型 ======================
/** WebSocket 消息类型 */
export type WsMessageType = 
  | 'CONNECTED'
  | 'ROOM_CREATED'
  | 'ROOM_JOINED'
  | 'GAME_STATE'
  | 'GAME_STARTED'
  | 'PHASE_CHANGED'
  | 'PLAYER_JOINED'
  | 'PLAYER_ACTION_DONE'
  | 'VOTE_SUCCESS'
  | 'TRADE_REQUEST'
  | 'TRADE_RESPONSE'
  | 'TRADE_CREATED'
  | 'NOTIFICATION'
  | 'ERROR'
  | 'PONG';

/** WebSocket 消息结构 */
export interface WsMessage {
  type: WsMessageType;
  payload?: any;
  state?: GameState;
  gameState?: GameState;
  roomCode?: string;
  playerId?: string;
  playerName?: string;
  hostId?: string;
  isHost?: boolean;
  message?: string;
  notificationType?: 'info' | 'warning' | 'success' | 'error';
  errorCode?: string;
  trade?: TradeRequest;
  fromPlayerName?: string;
  accepted?: boolean;
  isReconnected?: boolean;
  clientId?: string;
  targetId?: string;
  senderId?: string;
  timestamp?: number;
}

/** WebSocket Store 接口 */
export interface WebSocketStore {
  players: Player[];
  gameState: GameStateSimple;
  currentStep: ActionStep;
  roomInfo?: GameRoom;
  isConnected: boolean;
  vote: (voterId: string, targetId: string) => void;
  move: (playerId: string, locationId: string) => void;
  useItem: (playerId: string, itemType: ItemType, targetId?: string) => void;
  sendMessage: (message: WsMessage | any) => void;
}

// ====================== 工具类型 ======================
/** 提取接口属性类型 */
export type ExtractPropertyType<T, K extends keyof T> = T[K];

/** 地点ID类型 */
export type LocationId = ExtractPropertyType<Location, 'id'>;

/** 玩家ID类型 */
export type PlayerId = ExtractPropertyType<Player, 'id'>;

// ====================== 常量枚举 ======================
/** 角色名称映射 */
export const RoleNameMap: Record<RoleType, string> = {
  detective: '侦探',
  killer: '凶手',
  murderer: '凶手',
  innocent: '平民',
  accomplice: '帮凶',
  bad_fan: '坏粉丝',
  good_fan: '好粉丝',
  doctor: '医生',
  engineer: '工程师',
  hacker: '黑客'
};

/** 阵营颜色映射 */
export const CampColorMap: Record<CampType, string> = {
  good: '#4CAF50',
  detective: '#4CAF50',
  evil: '#F44336',
  killer: '#F44336',
  neutral: '#FFC107'
};

/** 道具名称映射 */
export const ItemNameMap: Record<ItemType, string> = {
  bandage: '急救绷带',
  powder: '迷药粉末',
  extinguisher: '灭火器',
  rope: '登山绳',
  ski: '滑雪套装'
};

/** 默认玩家配置 */
export const DefaultPlayer: Player = {
  id: '',
  name: '',
  role: 'innocent',
  camp: 'good',
  health: 3,
  maxHealth: 3,
  actionPoints: 8,
  currentLocation: '',
  locationId: '',
  actionLine: [],
  items: [],
  score: 0,
  isAlive: true,
  isExposed: false,
  visitedLocations: [],
  skillUsedThisRound: false
};

/** 默认游戏状态配置 */
export const DefaultGameState: GameState = {
  id: '',
  roomCode: '',
  round: 1,
  phase: 'lobby',
  players: [],
  locations: [],
  fireLocations: [],
  lightLocations: [],
  currentPlayerIndex: 0,
  votes: {},
  voteRecords: [],
  tradeRequests: [],
  settings: {
    allowRoleReveal: false,
    timeLimit: 0
  }
};

/** 默认游戏房间配置 */
export const DefaultGameRoom: GameRoom = {
  roomId: '',
  roomCode: '',
  state: 'waiting',
  currentStep: 'move',
  players: [],
  voteRecords: [],
  round: 1,
  createTime: Date.now()
};