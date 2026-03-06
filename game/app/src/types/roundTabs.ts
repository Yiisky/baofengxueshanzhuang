// src/types/roundTabs.ts
/**
 * 轮次信息选项卡相关类型定义
 */

import type { Player, ActionStepDetail } from './game';

/** 轮次历史记录 */
export interface RoundHistory {
  round: number;
  phase: string;
  players: Player[];
  fireLocations: string[];
  lightLocations: string[];
  votes: Record<string, string>;
  powderTarget: string | null;
  timestamp: number;
  settlementResult?: SettlementResult;
}

/** 血量历史 */
export interface HealthHistory {
  round: number;
  afterSettlement: boolean;
  playerHealths: Array<{
    playerId: string;
    playerName: string;
    health: number;
    maxHealth: number;
    isAlive: boolean;
  }>;
}

/** 显示用的行动步骤 */
export interface DisplayActionStep {
  displayStep: number;
  originalStep: number;
  locationId: string;
  locationName: string;
  isStayAction: boolean;
  cost: number;
}

/** 重叠行动线 */
export interface OverlappingAction {
  step: number;
  locationId: string;
  locationName: string;
  playerIds: string[];
  playerNames: string[];
  isPowderLocation: boolean;
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

/** 下一轮预告 */
export interface NextRoundPreview {
  nextFireLocations: string[];
  nextLightFloor: string | null;
}

/** 格式化后的轮次历史 */
export interface FormattedRoundHistory {
  round: number;
  healthTable: HealthHistory;
  overlaps: {
    steps1_4: OverlappingAction[];
    steps5_8: OverlappingAction[];
    powderLocationOverlaps: OverlappingAction[];
  };
  powderTargetName: string | null;
  nextPreview: NextRoundPreview;
}
