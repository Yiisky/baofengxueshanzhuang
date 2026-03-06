// src/utils/skillLogic.ts
/**
 * 技能逻辑处理模块
 * 处理所有角色的技能效果
 */

import type { Player, RoleType, ActionStepDetail } from '@/types/game';
import { roomFragments } from '@/data/roomFragments';

// ====================== 技能配置 ======================

export interface SkillConfig {
  role?: RoleType;
  name?: string;
  description?: string;
  autoTrigger?: boolean;
  costActionPoint?: boolean;
  costHealth?: boolean;
  maxUses?: number;
  usablePhases?: ('action' | 'free' | 'settlement')[];
  usableRounds?: number[];  // 特定轮次才能使用
  unusableRounds?: number[]; // 特定轮次不能使用
}

// 技能配置

export const skillConfigs = {
  // 凶手阵营
  killer: {
    role: 'killer' as const,
    name: '攻击、编造行动线',
    description: '凶手会自动攻击与其同一行动在同一地点的其他玩家，每轮每人最多受到1点攻击伤害。凶手可在整局游戏中编造两次虚假的行动线。若凶手编造了虚假行动线，则行动线重叠的公示、荧光粉的公示、侦探获取的行动线都将采用这条虚假行动线，但攻击伤害依旧按照真实行动线结算。',
    autoTrigger: true,
    costActionPoint: false,
    costHealth: false,
    usablePhases: ['settlement'] as ('action' | 'free' | 'settlement')[],
  },
  murderer: {
    role: 'murderer' as const,
    name: '攻击',
    description: '凶手会自动攻击与其同一行动在同一地点的其他玩家，每轮每人最多受到1点攻击伤害。',
    autoTrigger: true,
    costActionPoint: false,
    costHealth: false,
    usablePhases: ['settlement'] as ('action' | 'free' | 'settlement')[],
  },
  accomplice: {
    role: 'accomplice' as const,
    name: '攻击、放火',
    description: '帮凶可任选一轮，攻击与其行动线重叠的其他玩家（包括同阵营玩家），每轮每人最多受到1点攻击伤害。帮凶在第二、四轮中，每轮可选择1个地点放火，无需本人在该地点（3个花园和2个大厅无法放火），该地点会在下一轮开始着火，经过或停留在着火点的玩家会受到1点伤害（初始从着火点离开不会受伤，每轮每人最多受到1点着火伤害）。',
    autoTrigger: false,
    costActionPoint: false,
    costHealth: true,
    maxUses: 1,
    usablePhases: ['action'] as ('action' | 'free' | 'settlement')[],
  },
  bad_fan: {
    role: 'bad_fan' as const,
    name: '攻击+编造行动线、投凶',
    description: '坏推理迷可在"1次攻击+编造1次行动线"及"投凶"两个技能中任选其一。1次攻击+编造1次行动线：可分两轮使用，也可在同一轮使用。投凶：每轮可在行动结束后投凶，且初始拥有1分。',
    autoTrigger: false,
    costActionPoint: false,
    costHealth: true,
    usablePhases: ['action'] as ('action' | 'free' | 'settlement')[],
  },

  // 侦探阵营
  detective: {
    role: 'detective' as const,
    name: '获取行动线',
    description: '从第三轮开始，侦探每轮可选择1名玩家，消耗1点行动点，获取其上一轮的完整行动线。若目标玩家是凶手且使用了虚假行动线，则看到的是其编造的行动线。',
    autoTrigger: false,
    costActionPoint: true,
    costHealth: false,
    unusableRounds: [1, 2],
    usablePhases: ['action'] as ('action' | 'free' | 'settlement')[],
  },
  engineer: {
    role: 'engineer' as const,
    name: '供电',
    description: '只能在行动阶段且行动点为0时使用。修复当前所在楼层电路，使下一轮亮灯。第1轮只能在地下室或阁楼生效。',
    autoTrigger: false,
    costActionPoint: false,
    costHealth: false,
    usablePhases: ['action'] as ('action' | 'free' | 'settlement')[],
  },
  hacker: {
    role: 'hacker' as const,
    name: '入侵电脑',
    description: '每轮可查看任意1名玩家（包括自己）上一轮结算后的总分，若查看他人则后续不能再使用该技能，消耗1行动点。',
    autoTrigger: false,
    costActionPoint: true,
    costHealth: false,
    usablePhases: ['action'] as ('action' | 'free' | 'settlement')[],
  },
  doctor: {
    role: 'doctor' as const,
    name: '治疗',
    description: '若两名医生在同一轮的行动线有重叠，无论重叠几次，则当轮结算阶段两人各恢复1点生命值。此为被动技能，无需主动使用。',
    autoTrigger: true,
    costActionPoint: false,
    costHealth: false,
    usablePhases: ['settlement'] as ('action' | 'free' | 'settlement')[],
  },
  good_fan: {
    role: 'good_fan' as const,
    name: '获取行动线、投凶',
    description: '好推理迷可在"获取行动线"及"投凶"两个技能中任选其一。获取行动线：每轮可获取一名玩家在上一轮的行动线。投凶：每轮可在行动结束后投凶，且初始拥有2分。',
    autoTrigger: false,
    costActionPoint: true,
    costHealth: false,
    usablePhases: ['action'] as ('action' | 'free' | 'settlement')[],
  },
  
  // 推理迷（未转变）
  fan: {
    role: 'fan' as const,
    name: '转变身份',
    description: '第3轮开始，行动点为0时可选择一名玩家，猜测其是侦探或凶手。猜对则加入对应阵营。',
    autoTrigger: false,
    costActionPoint: false,
    costHealth: false,
    unusableRounds: [1, 2],
    usablePhases: ['action'] as ('action' | 'free' | 'settlement')[],
  },
  
  innocent: null as SkillConfig | null,
  unknown: null as SkillConfig | null,
} as Record<RoleType, SkillConfig | null>;

// ====================== 技能使用检查 ======================

export interface CanUseSkillResult {
  canUse: boolean;
  reason?: string;
  isPassive?: boolean;
  isRoundRestricted?: boolean;
  skillType?: 'attack' | 'fire' | 'get_action_line' | 'power' | 'hack_score' | 'fake_action_line';
}

export function canUseSkill(
  player: Player & { role: string }, 
  phase: string, 
  round: number,
  skillType?: string
): CanUseSkillResult {
  const config = skillConfigs[player.role as RoleType];
  
  if (!config) {
    return { canUse: false, reason: '该身份没有主动技能' };
  }

  // 医生被动技能
  if (player.role === 'doctor') {
    return { canUse: true, isPassive: true };
  }

  if (config.autoTrigger) {
    return { canUse: false, reason: '该技能为自动触发，无需手动使用' };
  }

  // 检查阶段
  if (!config.usablePhases?.includes(phase as any)) {
    return { canUse: false, reason: `当前阶段(${phase})无法使用该技能` };
  }

  // 检查特定轮次限制
  if (config?.usableRounds && !config.usableRounds.includes(round)) {
    return { canUse: false, reason: `只能在第 ${config.usableRounds.join('、')} 轮使用该技能` };
  }

  // 检查禁用轮次
  if (config?.unusableRounds && config.unusableRounds.includes(round)) {
    return { canUse: false, reason: `第 ${round} 轮无法使用该技能`, isRoundRestricted: true };
  }

  // 工程师特殊判断
  if ((player.role as string) === 'engineer') {
    if (player.actionPoints !== 0) {
      return { canUse: false, reason: '需要行动点为0才能使用' };
    }
    if (player.skillUsedThisRound) {
      return { canUse: false, reason: '本轮已使用过技能' };
    }
    if (round === 1) {
      const allowedFirstRoundRooms = ['basement_north', 'basement_south', 'basement_storage', 'attic_main', 'attic_therapy', 'attic_balcony'];
      if (!allowedFirstRoundRooms.includes(player.currentLocation)) {
        return { canUse: false, reason: '第1轮只能在地下室或阁楼使用供电技能' };
      }
    }
    return { canUse: true, skillType: 'power' };
  }

  // 帮凶特殊判断
  if (player.role === 'accomplice') {
    if (skillType === 'attack') {
      // 攻击：需要生命值，只能用一次
      if (player.health <= 0) {
        return { canUse: false, reason: '生命值归零，无法使用攻击技能' };
      }
      if (player.skillUseCount && player.skillUseCount >= 1) {
        return { canUse: false, reason: '攻击技能整局只能使用一次' };
      }
      return { canUse: true, skillType: 'attack' };
    } else if (skillType === 'fire') {
      // 放火：只能在2、4轮，消耗行动点，不需要生命值
      if (round !== 2 && round !== 4) {
        return { canUse: false, reason: '放火只能在第2轮或第4轮使用' };
      }
      if (player.actionPoints < 1) {
        return { canUse: false, reason: '行动点不足（需要1点）' };
      }
      return { canUse: true, skillType: 'fire' };
    }
  }

  // 侦探检查
  if (player.role === 'detective') {
    if (round < 3) {
      return { canUse: false, reason: '第3轮开始才能使用', isRoundRestricted: true };
    }
    if (player.actionPoints < 1) {
      return { canUse: false, reason: '行动点不足（需要1点）' };
    }
    if (player.skillUsedThisRound) {
      return { canUse: false, reason: '本轮已使用过技能' };
    }
    return { canUse: true, skillType: 'get_action_line' };
  }

  // 黑客检查
  if ((player.role as string) === 'hacker') {
    if (player.actionPoints < 1) {
      return { canUse: false, reason: '行动点不足（需要1点）' };
    }
    if (player.skillUsedThisRound) {
      return { canUse: false, reason: '本轮已使用过技能' };
    }
    if (player.hasCheckedOthersScore && skillType !== 'self') {
      return { canUse: false, reason: '已经查看过其他玩家分数，无法再使用该技能' };
    }
    return { canUse: true, skillType: 'hack_score' };
  }

  // 推理迷检查
  if (player.role === 'fan') {
    if (round < 3) {
      return { canUse: false, reason: '第3轮开始才能使用', isRoundRestricted: true };
    }
    if (player.actionPoints !== 0) {
      return { canUse: false, reason: '需要行动点为0才能使用' };
    }
    if (player.transformedRole) {
      return { canUse: false, reason: '已经转变身份，无法再使用' };
    }
    return { canUse: true };
  }

  // 好推理迷检查
  if (player.role === 'good_fan') {
    if (player.actionPoints < 1) {
      return { canUse: false, reason: '行动点不足（需要1点）' };
    }
    return { canUse: true, skillType: 'get_action_line' };
  }

  // 坏推理迷检查
  if (player.role === 'bad_fan') {
    if (skillType === 'attack') {
      if (player.health <= 0) {
        return { canUse: false, reason: '生命值归零，无法使用攻击技能' };
      }
      return { canUse: true, skillType: 'attack' };
    } else if (skillType === 'fake_action_line') {
      if (player.health <= 0) {
        return { canUse: false, reason: '生命值归零，无法使用' };
      }
      if ((player.fakeActionLineCount || 0) <= 0) {
        return { canUse: false, reason: '编造次数已用完' };
      }
      return { canUse: true, skillType: 'fake_action_line' };
    }
  }

  // 凶手/谋杀者编造行动线检查
  if ((player.role === 'killer' || player.role === 'murderer') && skillType === 'fake_action_line') {
    if (player.health <= 0) {
      return { canUse: false, reason: '生命值为0无法使用' };
    }
    if ((player.fakeActionLineCount || 0) <= 0) {
      return { canUse: false, reason: '编造次数已用完' };
    }
    if (phase !== 'action') {
      return { canUse: false, reason: '只能在行动阶段使用' };
    }
    return { canUse: true, skillType: 'fake_action_line' };
  }

  // 通用生命值检查（除特定技能外）
    if (config?.costHealth && player.health <= 0) {
    // 帮凶放火、工程师等不需要生命值
    if (!(player.role === 'accomplice' && skillType === 'fire') && 
        player.role !== 'engineer' && 
        player.role !== 'hacker') {
      return { canUse: false, reason: '生命值归零，无法使用该技能' };
    }
  }

  // 通用行动点检查
    if (config?.costActionPoint && player.actionPoints < 1) {
    return { canUse: false, reason: '行动点不足（需要1点）' };
  }

  return { canUse: true };
}

// ====================== 技能效果执行 ======================

export interface SkillEffect {
  type: string;
  targetId?: string;
  locationId?: string;
  value?: number;
  message: string;
  data?: any;
  guessedRole?: string;
}

export function executeSkill(
  player: Player,
  skillType: string,
  targetId?: string,
  locationId?: string,
  additionalData?: any
): SkillEffect {
  switch (player.role) {
    case 'accomplice':
      if (skillType === 'attack') {
        return {
          type: 'accomplice_attack',
          message: '帮凶发动攻击，将攻击与其同一行动在同一地点的玩家',
        };
      } else if (skillType === 'fire') {
        return {
          type: 'fire_set',
          locationId,
          message: `帮凶在${locationId}放火，下一轮该地点将开始着火`,
        };
      }
      break;
    
    case 'detective':
      return {
        type: 'get_action_line',
        targetId,
        message: `侦探查看了${targetId}的行动线`,
      };
    
    case 'engineer':
      return {
        type: 'repair',
        locationId: player.currentLocation,
        message: `工程师修复了当前楼层的电路，下一轮将亮灯`,
      };
    
    case 'hacker':
      const isSelf = targetId === player.id;
      return {
        type: 'hack_score',
        targetId,
        message: isSelf 
          ? '黑客查看自己的分数' 
          : '黑客查看了其他玩家的分数，之后无法再使用该技能',
        data: { isSelf }
      };
    
    case 'fan':
      return {
        type: 'transform',
        targetId,
        guessedRole: additionalData?.guessedRole,
        message: `推理迷选择${targetId}，猜测其为${additionalData?.guessedRole === 'detective' ? '侦探' : '凶手'}`
      };
    
    case 'good_fan':
      if (skillType === 'get_action_line') {
        return {
          type: 'get_action_line',
          targetId,
          message: `好推理迷获取了${targetId}的行动线`,
        };
      }
      break;
    
    case 'bad_fan':
      if (skillType === 'attack') {
        return {
          type: 'bad_fan_attack',
          message: '坏推理迷发动攻击',
        };
      } else if (skillType === 'fake_action_line') {
        return {
          type: 'set_fake_action_line',
          message: '坏推理迷设置了虚假行动线',
          data: { actionLine: additionalData?.actionLine }
        };
      }
      break;

    case 'killer':
    case 'murderer':
      if (skillType === 'fake_action_line') {
        return {
          type: 'set_fake_action_line',
          message: '凶手设置了虚假行动线',
          data: { actionLine: additionalData?.actionLine }
        };
      }
      break;
  }
  
  return {
    type: 'unknown',
    message: '技能执行',
  };
}

// ====================== 获取技能信息 ======================

export function getSkillInfo(role: RoleType): { name: string; description: string; hasMultipleSkills?: boolean } | null {
  const config = skillConfigs[role];
  if (!config) return null;
  
  return {
    name: config.name || '',
    description: config.description || '',
    hasMultipleSkills: role === 'accomplice' || role === 'bad_fan' || role === 'good_fan'
  };
}

// ====================== 推理迷相关 ======================

export function isFanRole(player: Player): boolean {
  return player.role === 'fan' || (player.role === 'innocent' && player.isFan === true);
}

export function canTransformFan(player: Player, round: number): boolean {
  return isFanRole(player) && round >= 3 && !player.transformedRole && player.actionPoints === 0;
}

// 推理迷技能选项
export const fanSkillOptions = {
  detective: [
    {
      id: 'action_line' as const,
      name: '获取行动线',
      description: '每轮可获取一名玩家在上一轮的行动线',
    },
    {
      id: 'vote_2' as const,
      name: '投凶（2分）',
      description: '每轮可在行动结束后投凶，且初始拥有2分',
    },
  ],
  killer: [
    {
      id: 'attack_fake' as const,
      name: '1次攻击+编造1次行动线',
      description: '可分两轮使用，也可在同一轮使用',
    },
    {
      id: 'vote_1' as const,
      name: '投凶（1分）',
      description: '每轮可在行动结束后投凶，且初始拥有1分',
    },
  ],
};

// ====================== 可放火地点 ======================

export function getFireableLocations(): string[] {
  // 排除：一楼大厅、二楼大厅、三个花园
  const excludedLocations = [
    'first_hall',      // 一楼大厅
    'second_hall',     // 二楼大厅
    'first_garden_north', // 北花园
    'first_garden_east',  // 东花园
    'first_garden_south', // 南花园
  ];
  
  return roomFragments
    .filter(r => !excludedLocations.includes(r.id))
    .map(r => r.id);
}

// ====================== 验证虚假行动线 ======================

export function validateFakeActionLine(actionLine: ActionStepDetail[]): { valid: boolean; reason?: string } {
  if (!actionLine || actionLine.length !== 8) {
    return { valid: false, reason: '行动线必须包含8个行动' };
  }
  
  // 检查每个行动是否有效
  for (let i = 0; i < actionLine.length; i++) {
    const step = actionLine[i];
    if (step.step !== i + 1) {
      return { valid: false, reason: `第${i+1}个行动的序号错误` };
    }
    if (!step.locationId) {
      return { valid: false, reason: `第${i+1}个行动缺少地点` };
    }
    const room = roomFragments.find(r => r.id === step.locationId);
    if (!room) {
      return { valid: false, reason: `第${i+1}个行动的地点无效` };
    }
  }
  
  return { valid: true };
}

// ====================== 辅助函数 ======================

/**
 * 获取玩家编号
 */
export function getPlayerNumber(playerId: string, players: Player[]): number {
  const index = players.findIndex(p => p.id === playerId);
  return index + 1;
}

/**
 * 检查地点是否是花园
 */
export function isGarden(locationId: string): boolean {
  return locationId.includes('garden');
}

/**
 * 检查地点是否是室内
 */
export function isIndoor(locationId: string): boolean {
  return !isGarden(locationId);
}