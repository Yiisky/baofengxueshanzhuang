// 游戏核心类型定义

// 身份类型
export type Role = 
  | 'killer'      // 凶手
  | 'accomplice'  // 帮凶
  | 'detective'   // 侦探
  | 'engineer'    // 工程师
  | 'hacker'      // 黑客
  | 'doctor'      // 医生
  | 'fan'         // 推理迷
  | 'good_fan'    // 好推理迷（加入侦探阵营）
  | 'bad_fan';    // 坏推理迷（加入凶手阵营）

// 阵营类型
export type Camp = 'killer' | 'detective' | 'neutral';

// 游戏阶段
export type GamePhase = 'lobby' | 'config' | 'free' | 'action' | 'settlement' | 'ended';

// 用户类型
export type UserType = 'host' | 'player' | 'spectator';

// 楼层类型
export type Floor = 'attic' | 'second' | 'first' | 'basement';

// 地点类型
export type LocationType = 'normal' | 'special' | 'garden' | 'crime';

// 道具类型
export type ItemType = 'bandage' | 'powder' | 'extinguisher' | 'rope' | 'ski';

// 地点
export interface Location {
  id: string;
  name: string;
  floor: Floor;
  type: LocationType;
  connections: string[];
  description?: string;
  effect?: string;
}

// 行动步骤
export interface ActionStep {
  step: number;
  locationId: string;
  action?: 'move' | 'stay' | 'use_item' | 'use_skill' | 'get_item';
  details?: string;
}

// 道具
export interface Item {
  type: ItemType;
  name: string;
  description: string;
}

// 交易请求
export interface TradeRequest {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerItem: ItemType;
  requestItem: ItemType;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

// 投凶记录
export interface VoteRecord {
  round: number;
  voterId: string;
  targetId: string;
  isCorrect: boolean;
}

// 玩家
export interface Player {
  id: string;
  name: string;
  role: Role;
  camp: Camp;
  health: number;
  maxHealth: number;
  actionPoints: number;
  currentLocation: string;
  actionLine: ActionStep[];
  items: ItemType[];
  score: number;
  isAlive: boolean;
  isExposed: boolean;
  visitedLocations: string[];
  fakeActionLine?: ActionStep[];
  canUseSkill: boolean;
  skillUsedThisRound: boolean;
  fakeActionLineCount: number; // 编造行动线剩余次数
  fireCount: number; // 放火剩余次数
  hasCheckedFan: boolean; // 推理迷是否已经查验过
  fanJoinedCamp?: 'detective' | 'killer'; // 推理迷加入的阵营
  // 投凶相关
  votesThisRound?: string; // 本轮投凶目标
  totalVotesCorrect: number;
}

// 游戏配置
export interface GameConfig {
  playerCount: number;
  roles: Role[];
  roomCode: string;
}

// 游戏状态
export interface GameState {
  id: string;
  roomCode: string;
  round: number;
  phase: GamePhase;
  players: Player[];
  locations: Location[];
  fireLocations: string[];
  lightLocations: string[];
  currentPlayerIndex: number;
  powderTarget?: string;
  detectiveTarget?: string;
  hackerTarget?: string;
  engineerRepaired?: string;
  fanChecked?: { playerId: string; role: Role } | null;
  votes: Map<string, string>;
  voteRecords: VoteRecord[];
  tradeRequests: TradeRequest[];
  roundStartTime?: number;
  gameStartTime?: number;
  gameEndTime?: number;
  winner?: Camp;
  // 主持人设置
  hostId?: string;
  // 游戏设置
  settings: {
    allowRoleReveal: boolean;
    timeLimit: number;
  };
}

// 结算信息
export interface SettlementInfo {
  round: number;
  healthChanges: { playerId: string; change: number; reason: string }[];
  overlappingPlayers: { locationId: string; players: string[] }[];
  exposedActionLines: { playerId: string; actionLine: ActionStep[]; isFake: boolean }[];
  fireDamage: { playerId: string; locationId: string }[];
  attackDamage: { playerId: string; attackerId: string }[];
  healEffects: { playerId: string; healerId: string }[];
  nextRoundFireLocations: string[];
  nextRoundLightLocations: string[];
  voteResults: { voterId: string; targetId: string; isCorrect: boolean }[];
}

// 角色配置
export interface RoleConfig {
  role: Role;
  name: string;
  description: string;
  camp: Camp;
  initialScore: number;
  skillName: string;
  skillDescription: string;
  maxUses?: number;
}

// 地点效果
export interface LocationEffect {
  type: 'get_item' | 'view_score' | 'special_move' | 'jump';
  item?: ItemType;
  cost?: number;
  description: string;
}

// 用户会话
export interface UserSession {
  userId: string;
  userType: UserType;
  playerId?: string;
  roomCode?: string;
  connectedAt: number;
}

// 游戏历史记录
export interface GameHistory {
  id: string;
  roomCode: string;
  startTime: number;
  endTime: number;
  players: {
    name: string;
    role: Role;
    camp: Camp;
    score: number;
    isAlive: boolean;
  }[];
  winner: Camp;
  rounds: number;
}
