// src/types/game.ts
/**
 * 游戏核心类型定义
 */
// ====================== 基础枚举/类型 ======================
/** 楼层类型 */
export type Floor = 'attic' | 'second' | 'first' | 'basement'; // 修正拼写 basement

/** 角色配置类型 */
export interface RoleConfig {
  role: RoleType;
  name: string;
  description: string;
  camp: CampType;
  initialScore: number;
  skillName: string;
  skillDescription: string;
  maxUses: number;
}

/** 地点类型 */
export type LocationType = 'normal' | 'special' | 'crime' | 'garden';

/** 道具类型 */
export type ItemType = 'bandage' | 'powder' | 'extinguisher' | 'rope' | 'ski';

/** 角色类型 - 完整版 */
export type RoleType = 
  | 'detective'    // 侦探
  | 'killer'       // 凶手
  | 'murderer'     // 凶手（别名）
  | 'accomplice'   // 帮凶
  | 'bad_fan'      // 坏推理迷
  | 'good_fan'     // 好推理迷
  | 'doctor'       // 医生
  | 'engineer'     // 工程师
  | 'hacker'       // 黑客
  | 'fan'          // 推理迷（未转变）
  | 'unknown'      // 未分配身份
  | 'innocent';    // 平民

/** 角色类型 - 别名（兼容旧代码） */
export type Role = RoleType;

/** 阵营类型 */
export type CampType = 
  | 'good'       
  | 'detective'  
  | 'evil'       
  | 'killer'     
  | 'neutral';   

/** 游戏阶段类型 */
export type Phase = 'lobby' | 'config' | 'action' | 'free' | 'settlement' | 'ended';

/** 行动步骤详情 */
export interface ActionStepDetail {
  step: number;
  locationId: string;
  action?: string;
  cost?: number;
}

/** 地点接口 */
export interface Location {
  id: string;
  name: string;
  floor: Floor;
  type: LocationType;
  connections: string[];
  description: string;
}

/** 玩家接口 */
export interface Player {
  id: string;
  name: string;
  number: number; // ✅ 添加：玩家编号 1-10
  role: RoleType;
  camp: CampType;
  health: number;
  maxHealth: number;
  actionPoints: number;
  currentLocation: string;
  locationId: string;
  actionLine: ActionStepDetail[];
  fakeActionLine?: ActionStepDetail[];
  items: ItemType[];
  score: number;
  isAlive: boolean;
  isExposed: boolean;
  visitedLocations: string[];
  skillUsedThisRound: boolean;
  fakeActionLineCount: number;
  fireCount: number;
  hasCheckedFan: boolean;
  totalVotesCorrect: number;
  votesThisRound?: string | null;
  
  // 新增/补全字段以解决报错
  fanJoinedCamp?: CampType;
  
  // 其他扩展字段
  hasCheckedOthersScore?: boolean;
  transformedRole?: RoleType;
  isFan?: boolean;
  skillUseCount?: number;
  fanChoiceRound?: number;
  fanTargetId?: string;
  fanTargetRole?: RoleType;
  fanSkillChoice?: 'action_line' | 'vote_2' | 'attack_fake' | 'vote_1';
  canVote?: boolean;
  
  // 虚弱状态相关字段
  isWeakened?: boolean;           // 是否处于虚弱状态
  itemsObtainedThisRound?: ItemType[]; // 本轮已获取的道具
  
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

/** 游戏状态接口 */
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
  powderTarget?: string;
  detectiveTarget?: string;
  hostId?: string;
  
  // 补全缺失的动态属性以解决 TS2339 错误
  gameStartTime?: number;
  winner?: CampType | string;
  hackerTarget?: string;
  engineerRepaired?: string;
  fanChecked?: { playerId: string; role: RoleType };
  roundStartTime?: number;
  
  // 原有扩展字段
  skillRecords?: Array<{
    playerId: string;
    skillType: string;
    targetId?: string;
    locationId?: string;
    round: number;
    timestamp: number;
  }>;
  hackerChecks?: Map<string, boolean>;
  fanTransformed?: boolean;
  
  // 轮次历史记录
  roundHistories?: RoundHistory[];
}

/** 轮次历史记录 */
export interface RoundHistory {
  round: number;
  phase: Phase;
  players: Player[];
  fireLocations: string[];
  lightLocations: string[];
  votes: Record<string, string>;
  powderTarget: string | null;
  timestamp: number;
  settlementResult?: SettlementResult;
}

/** 结算结果 */
export interface SettlementResult {
  healthChanges: Array<{
    playerId: string;
    playerName: string;
    change: number;
    reason: string;
  }>;
  attackDamage: Array<{
    playerId: string;
    attackerId: string;
    attackerName: string;
  }>;
  healEffects: Array<{
    playerId: string;
    healerId: string;
    healerName: string;
  }>;
  fireDamage: Array<{
    playerId: string;
    locationId: string;
    locationName: string;
  }>;
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

/** 游戏房间接口 */
export interface GameRoom {
  roomId: string;
  roomCode: string;
  state: 'waiting' | 'playing' | 'ended';
  currentStep: 'move' | 'useItem' | 'vote' | 'skill';
  players: Player[];
  voteRecords: any[];
  round: number;
  createTime: number;
}

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
  | 'PONG'
  | 'SKILL_USED'
  | 'FAKE_ACTION_LINE_SET'
  | 'FAN_TRANSFORMED'
  | 'FAN_SKILL_CHOSEN'
  | 'ACTION_LINE_REVEALED'
  | 'VOTE_UPDATED';

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
  effect?: any;
  actionLine?: ActionStepDetail[];
}

/** 角色名称映射 */
export const RoleNameMap: Record<RoleType, string> = {
  detective: '侦探',
  killer: '凶手',
  murderer: '凶手',
  innocent: '平民',
  accomplice: '帮凶',
  bad_fan: '坏推理迷',
  good_fan: '好推理迷',
  doctor: '医生',
  engineer: '工程师',
  hacker: '黑客',
  fan: '推理迷',
  unknown: '未知身份', 
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
  number: 0, 
  role: 'unknown',
  camp: 'neutral',
  health: 3,
  maxHealth: 3,
  actionPoints: 8,
  currentLocation: '',
  locationId: '', // 补全
  actionLine: [],
  items: [],
  score: 0,
  isAlive: true,
  isExposed: false,
  visitedLocations: [],
  skillUsedThisRound: false,
  fakeActionLineCount: 0,
  fireCount: 0,
  hasCheckedFan: false,
  totalVotesCorrect: 0,
  votesThisRound: null,
  
  // 新增字段
  fanJoinedCamp: undefined,
  hasCheckedOthersScore: false,
  transformedRole: undefined,
  isFan: false,
  skillUseCount: 0,
  fanChoiceRound: undefined,
  fanTargetId: undefined,
  fanTargetRole: undefined,
  fanSkillChoice: undefined,
  canVote: true,
  
  // 虚弱状态相关字段
  isWeakened: false,
  itemsObtainedThisRound: []
};

export type ActionStep = ActionStepDetail; 

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
  },
  skillRecords: [],
  hackerChecks: new Map(),
  roundHistories: []
};
