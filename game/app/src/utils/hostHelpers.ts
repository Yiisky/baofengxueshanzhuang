// src/utils/hostHelpers.ts
/**
 * 主持人端辅助函数
 */

import type { Player, GameState, ActionStepDetail, RoleType } from '@/types/game';
import type { PlayerStatus, RoundActionInfo, OverlappingAction, PublicAnnouncement } from '@/types/host';
import { getLocationById } from '@/data/locations';
import { getRoleName, getRoleIcon } from '@/data/roles';
import { ItemNameMap } from '@/types/game';

/** 获取玩家状态显示 */
export function getPlayerStatus(player: Player): PlayerStatus {
  const location = getLocationById(player.currentLocation);
  
  return {
    playerId: player.id,
    name: player.name,
    role: player.role,
    roleDisplay: getRoleName(player.role),
    currentLocation: player.currentLocation,
    locationDisplay: location?.name || '未知地点',
    items: player.items || [],
    health: player.health,
    actionPoints: player.actionPoints,
    score: player.score,
    isAlive: player.isAlive
  };
}

/** 获取所有玩家状态 */
export function getAllPlayerStatuses(players: Player[]): PlayerStatus[] {
  return players.map(getPlayerStatus);
}

/** 获取本轮行动信息 */
export function getRoundActionInfo(player: Player, gameState: GameState): RoundActionInfo {
  let voteTarget: string | null = null;
  let voteTargetName: string | null = null;
  
  if (gameState.votes && gameState.votes[player.id]) {
    voteTarget = gameState.votes[player.id];
    const targetPlayer = gameState.players.find(p => p.id === voteTarget);
    voteTargetName = targetPlayer?.name || null;
  }
  
  const skillRecord = gameState.skillRecords?.find(
    r => r.playerId === player.id && r.round === gameState.round
  );
  
  return {
    playerId: player.id,
    playerName: player.name,
    role: player.role,
    roleDisplay: getRoleName(player.role),
    healthChange: 0,
    scoreChange: 0,
    voteTarget,
    voteTargetName,
    actionLine: player.actionLine || [],
    usedItem: null,
    itemTarget: null,
    skillUsed: !!skillRecord,
    skillType: skillRecord?.skillType || null,
    skillTarget: skillRecord?.targetId || null,
    skillResult: null,
    isExposed: gameState.powderTarget === player.id,
    fakeActionLine: player.fakeActionLine
  };
}

/** 计算亮灯地点的重叠行动线 */
export function calculateLightOverlaps(
  players: Player[],
  lightLocations: string[],
  round: number
): OverlappingAction[] {
  const overlaps: OverlappingAction[] = [];
  
  lightLocations.forEach(locId => {
    const location = getLocationById(locId);
    if (!location) return;
    
    const stepMap = new Map<number, { playerId: string; playerName: string; role: RoleType }[]>();
    
    players.forEach(p => {
      if (!p.isAlive) return;
      
      p.actionLine?.forEach(step => {
        if (step.locationId === locId) {
          if (!stepMap.has(step.step)) {
            stepMap.set(step.step, []);
          }
          stepMap.get(step.step)!.push({
            playerId: p.id,
            playerName: p.name,
            role: p.role
          });
        }
      });
    });
    
    stepMap.forEach((playerList, step) => {
      if (playerList.length >= 2) {
        overlaps.push({
          step,
          locationId: locId,
          locationName: location.name,
          players: playerList
        });
      }
    });
  });
  
  return overlaps.sort((a, b) => a.step - b.step);
}

/** 生成公示信息 */
export function generatePublicAnnouncement(
  gameState: GameState,
  settlementResult: any
): PublicAnnouncement {
  const { players, fireLocations, lightLocations, powderTarget, round } = gameState;
  
  const healthChanges = settlementResult?.healthChanges?.map((change: any) => {
    const player = players.find(p => p.id === change.playerId);
    return {
      playerId: change.playerId,
      playerName: player?.name || '未知',
      change: change.change,
      reason: change.reason
    };
  }) || [];
  
  const nextFireLocations = fireLocations.map(locId => ({
    locationId: locId,
    locationName: getLocationById(locId)?.name || locId
  }));
  
  let nextLightFloor: string | null = null;
  if (lightLocations.length > 0) {
    const firstLoc = getLocationById(lightLocations[0]);
    nextLightFloor = firstLoc?.floor || null;
  }
  
  const lightOverlaps = calculateLightOverlaps(players, lightLocations, round);
  
  const exposedPlayers: PublicAnnouncement['exposedPlayers'] = [];
  if (powderTarget) {
    const target = players.find(p => p.id === powderTarget);
    if (target) {
      exposedPlayers.push({
        playerId: target.id,
        playerName: target.name,
        actionLine: target.fakeActionLine || target.actionLine || [],
        isFake: !!target.fakeActionLine
      });
    }
  }
  
  return {
    round,
    healthChanges,
    nextFireLocations,
    nextLightFloor,
    lightOverlaps,
    exposedPlayers
  };
}

/** 格式化行动线为字符串 */
export function formatActionLine(actionLine: ActionStepDetail[]): string {
  if (!actionLine || actionLine.length === 0) return '无';
  
  return actionLine
    .sort((a, b) => a.step - b.step)
    .map(step => {
      const loc = getLocationById(step.locationId);
      return `${step.step}.${loc?.name || step.locationId}`;
    })
    .join(' → ');
}

/** 获取道具显示名称 */
export function getItemDisplayName(itemType: string): string {
  return ItemNameMap[itemType as keyof typeof ItemNameMap] || itemType;
}

/** 获取技能显示名称 */
export function getSkillDisplayName(skillType: string, role: RoleType): string {
  const skillNames: Record<string, Record<string, string>> = {
    detective: {
      action_line: '获取时间线',
      default: '获取时间线'
    },
    killer: {
      attack: '攻击',
      fake_action: '编造行动线',
      default: '攻击/编造行动线'
    },
    accomplice: {
      attack: '攻击',
      fire: '放火',
      default: '攻击/放火'
    },
    doctor: {
      heal: '治疗',
      default: '治疗'
    },
    engineer: {
      power: '供电',
      default: '供电'
    },
    hacker: {
      hack: '入侵电脑',
      default: '入侵电脑'
    },
    good_fan: {
      action_line: '获取行动线',
      vote_2: '投凶（2分）',
      default: '获取行动线/投凶'
    },
    bad_fan: {
      attack_fake: '1次攻击+编造1次行动线',
      vote_1: '投凶（1分）',
      default: '攻击+编造/投凶'
    }
  };
  
  const roleSkills = skillNames[role] || {};
  return roleSkills[skillType] || roleSkills.default || skillType;
}

/** 检查玩家是否可以执行某操作 */
export function canPlayerPerformAction(player: Player, action: string): boolean {
  if (!player.isAlive) return false;
  
  switch (action) {
    case 'vote':
      // 推理迷（fan）和未转变的推理迷不能投票
      if (player.role === 'fan') return false;
      // 检查 canVote 字段（如果存在）
      if (player.canVote === false) return false;
      return true;
      
    case 'use_skill':
      // 移除不存在的 canUseSkill 检查，只检查本轮是否已使用技能
      return !player.skillUsedThisRound;
      
    case 'move':
      return player.actionPoints > 0;
      
    case 'use_item':
      return player.actionPoints >= 1 && (player.items?.length || 0) > 0;
      
    default:
      return player.isAlive;
  }
}