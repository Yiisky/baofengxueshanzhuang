// src/types/host.ts
/**
 * 主持人端专用类型定义
 */

import type { Player, ActionStepDetail, ItemType, RoleType } from './game';

/** 玩家实时状态显示 */
export interface PlayerStatus {
  playerId: string;
  name: string;
  role: RoleType;
  roleDisplay: string;
  currentLocation: string;
  locationDisplay: string;
  items: ItemType[];
  health: number;
  actionPoints: number;
  score: number;
  isAlive: boolean;
}

/** 本轮行动信息 */
export interface RoundActionInfo {
  playerId: string;
  playerName: string;
  role: RoleType;
  roleDisplay: string;
  
  // 基础变化
  healthChange: number;
  scoreChange: number;
  voteTarget: string | null;
  voteTargetName: string | null;
  
  // 行动线
  actionLine: ActionStepDetail[];
  
  // 道具使用
  usedItem: ItemType | null;
  itemTarget: string | null;
  
  // 技能使用
  skillUsed: boolean;
  skillType: string | null;
  skillTarget: string | null;
  skillResult: any;
  
  // 特殊状态
  isExposed: boolean; // 是否被荧光粉暴露
  fakeActionLine?: ActionStepDetail[]; // 虚假行动线（凶手）
}

/** 重叠行动线信息 */
export interface OverlappingAction {
  step: number;
  locationId: string;
  locationName: string;
  players: {
    playerId: string;
    playerName: string;
    role: RoleType;
  }[];
}

/** 公示信息 */
export interface PublicAnnouncement {
  round: number;
  
  // 生命值公示
  healthChanges: {
    playerId: string;
    playerName: string;
    change: number; // 正数增加，负数减少
    reason: string;
  }[];
  
  // 着火点预告
  nextFireLocations: {
    locationId: string;
    locationName: string;
  }[];
  
  // 亮灯楼层
  nextLightFloor: string | null;
  
  // 亮灯重叠时间线
  lightOverlaps: OverlappingAction[];
  
  // 荧光粉暴露
  exposedPlayers: {
    playerId: string;
    playerName: string;
    actionLine: ActionStepDetail[];
    isFake: boolean;
  }[];
}

/** 复盘结算数据 */
export interface GameReview {
  totalRounds: number;
  finalScores: {
    playerId: string;
    playerName: string;
    role: RoleType;
    camp: string;
    score: number;
    isAlive: boolean;
  }[];
  
  voteAccuracy: {
    playerId: string;
    playerName: string;
    correctVotes: number;
    totalVotes: number;
  }[];
  
  skillUsage: {
    playerId: string;
    playerName: string;
    skills: {
      round: number;
      skillType: string;
      target?: string;
      result: string;
    }[];
  }[];
  
  keyEvents: {
    round: number;
    phase: string;
    description: string;
  }[];
}