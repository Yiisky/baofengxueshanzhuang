// src/utils/settlement.ts
/**
 * 结算阶段处理模块
 */

import type { Player, GameState, SettlementInfo, ActionStepDetail } from '@/types/game';

/**
 * 检查两个玩家的行动线在同一行动步骤是否在同一地点
 */
export function checkActionOverlap(
  actionLine1: ActionStepDetail[],
  actionLine2: ActionStepDetail[]
): Array<{ step: number; locationId: string }> {
  const overlaps: Array<{ step: number; locationId: string }> = [];
  
  actionLine1.forEach(step1 => {
    const step2 = actionLine2.find(s => s.step === step1.step);
    if (step2 && step2.locationId === step1.locationId) {
      overlaps.push({
        step: step1.step,
        locationId: step1.locationId
      });
    }
  });
  
  return overlaps;
}

/**
 * 处理结算阶段
 * 修改：虚弱状态玩家不参与行动线重叠结算
 */
export function processSettlement(state: GameState): SettlementInfo {
  const settlement: SettlementInfo = {
    round: state.round,
    healthChanges: [],
    overlappingPlayers: [],
    exposedActionLines: [],
    fireDamage: [],
    attackDamage: [],
    healEffects: [],
    nextRoundFireLocations: [...state.fireLocations],
    nextRoundLightLocations: [...state.lightLocations],
    voteResults: []
  };

  // 记录已受到伤害的玩家（每轮每人最多受到1次攻击伤害和1次着火伤害）
  const damagedByAttack = new Set<string>();
  const damagedByFire = new Set<string>();

  // 1. 处理攻击（凶手和帮凶）
  const killers = state.players.filter(p => 
    (p.role === 'killer' || p.role === 'murderer' || p.role === 'accomplice' || p.role === 'bad_fan') && 
    p.isAlive &&
    !p.isWeakened && // 虚弱状态玩家不能攻击
    p.health > 0
  );

  killers.forEach(killer => {
    // 攻击使用真实行动线
    const actionLine = killer.actionLine || [];

    state.players.forEach(target => {
      // 不能攻击自己、已死亡、虚弱状态的玩家
      if (target.id === killer.id || !target.isAlive || target.isWeakened || target.health === 0) return;

      const overlaps = checkActionOverlap(actionLine, target.actionLine);
      
      // 每轮每人最多受到1次攻击伤害
      if (overlaps.length > 0 && !damagedByAttack.has(target.id)) {
        settlement.attackDamage.push({
          playerId: target.id,
          attackerId: killer.id
        });
        settlement.healthChanges.push({
          playerId: target.id,
          change: -1,
          reason: `被${killer.name}攻击`
        });
        damagedByAttack.add(target.id);
      }
    });
  });

  // 2. 处理着火伤害（每轮每人最多1点）
  state.fireLocations.forEach(locId => {
    state.players.forEach(p => {
      // 虚弱状态玩家不受着火伤害
      if (p.isAlive && !p.isWeakened && p.health > 0 && p.actionLine.some(step => step.locationId === locId)) {
        // 检查是否已经受到过着火伤害
        if (!damagedByFire.has(p.id)) {
          settlement.fireDamage.push({
            playerId: p.id,
            locationId: locId
          });
          settlement.healthChanges.push({
            playerId: p.id,
            change: -1,
            reason: '着火伤害'
          });
          damagedByFire.add(p.id);
        }
      }
    });
  });

  // 3. 处理医生治疗
  const doctors = state.players.filter(p => p.role === 'doctor' && p.isAlive && !p.isWeakened && p.health > 0);
  if (doctors.length >= 2) {
    for (let i = 0; i < doctors.length; i++) {
      for (let j = i + 1; j < doctors.length; j++) {
        const doc1 = doctors[i];
        const doc2 = doctors[j];
        
        const overlaps = checkActionOverlap(doc1.actionLine, doc2.actionLine);
        
        if (overlaps.length > 0) {
          // 医生1恢复生命（虚弱状态玩家不能恢复）
          if (doc1.health < doc1.maxHealth && doc1.health > 0 && !doc1.isWeakened) {
            settlement.healEffects.push({ playerId: doc1.id, healerId: doc2.id });
            settlement.healthChanges.push({
              playerId: doc1.id,
              change: 1,
              reason: '医生治疗'
            });
          }
          
          // 医生2恢复生命（虚弱状态玩家不能恢复）
          if (doc2.health < doc2.maxHealth && doc2.health > 0 && !doc2.isWeakened) {
            settlement.healEffects.push({ playerId: doc2.id, healerId: doc1.id });
            settlement.healthChanges.push({
              playerId: doc2.id,
              change: 1,
              reason: '医生治疗'
            });
          }
        }
      }
    }
  }

  // 4. 处理荧光粉暴露
  if (state.powderTarget) {
    const target = state.players.find(p => p.id === state.powderTarget);
    if (target) {
      settlement.exposedActionLines.push({
        playerId: target.id,
        actionLine: target.fakeActionLine || target.actionLine,
        isFake: !!target.fakeActionLine
      });
    }
  }

  // 5. 处理投票结果
  Object.entries(state.votes || {}).forEach(([voterId, targetId]) => {
    const killer = state.players.find(p => p.role === 'killer' || p.role === 'murderer');
    settlement.voteResults.push({
      voterId,
      targetId: targetId as string,
      isCorrect: targetId === killer?.id
    });
  });

  // 6. 更新玩家血量并检查虚弱状态
  settlement.healthChanges.forEach(change => {
    const player = state.players.find(p => p.id === change.playerId);
    if (player && !player.isWeakened) {
      const newHealth = Math.max(0, Math.min(player.maxHealth, player.health + change.change));
      player.health = newHealth;
      
      // 检查是否进入虚弱状态
      if (player.health === 0 && !player.isWeakened) {
        player.isWeakened = true;
        player.isAlive = false;
        player.score = 0; // 个人累积的分数全部失效
      }
    }
  });

  return settlement;
}

/**
 * 获取亮灯地点的重叠玩家（按行动步骤组织）
 * 修改：虚弱状态玩家不参与重叠结算
 */
export function getLightLocationOverlaps(
  players: Player[],
  lightLocations: string[]
): Record<number, Array<{ locationId: string; players: string[] }>> {
  const result: Record<number, Array<{ locationId: string; players: string[] }>> = {};

  lightLocations.forEach(locId => {
    // 按行动步骤统计在该地点的玩家
    const stepPlayers: Record<number, string[]> = {};

    players.forEach(p => {
      // 虚弱状态玩家不参与重叠结算
      if (!p.isAlive || p.isWeakened || p.health === 0) return;
      
      p.actionLine.forEach(step => {
        if (step.locationId === locId) {
          if (!stepPlayers[step.step]) {
            stepPlayers[step.step] = [];
          }
          stepPlayers[step.step].push(p.name);
        }
      });
    });

    // 只保留有重叠的步骤
    Object.entries(stepPlayers).forEach(([step, names]) => {
      if (names.length > 1) {
        const stepNum = Number(step);
        if (!result[stepNum]) {
          result[stepNum] = [];
        }
        result[stepNum].push({
          locationId: locId,
          players: names
        });
      }
    });
  });

  return result;
}

/**
 * 检查并更新虚弱状态
 * 虚弱状态定义：若玩家生命值归零，则生命值将锁定在0
 * 该玩家进入虚弱状态，后续每轮仅有4个行动点
 * 不参与行动线重叠的结算，个人累积的分数将全部失效
 */
export function checkAndUpdateWeakenedState(player: Player): boolean {
  // 如果血量归零且未进入虚弱状态
  if (player.health === 0 && !player.isWeakened) {
    player.isWeakened = true;
    player.isAlive = false;
    player.actionPoints = 4; // 虚弱状态每轮只有4个行动点
    player.score = 0; // 个人累积的分数全部失效
    return true;
  }
  
  // 确保虚弱状态玩家的血量不会低于0
  if (player.isWeakened) {
    player.health = 0;
    player.score = 0; // 保持分数为0
  }
  
  return false;
}
