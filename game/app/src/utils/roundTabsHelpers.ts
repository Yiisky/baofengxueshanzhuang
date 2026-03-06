// src/utils/roundTabsHelpers.ts
// 新增：轮次信息选项卡辅助函数

import type { Player, ActionStepDetail} from '@/types/game';
import type { 
  RoundHistory, 
  HealthHistory, 
  DisplayActionStep, 
  OverlappingAction,
  SettlementResult 
} from '@/types/roundTabs';
import { getLocationById } from '@/data/locations';


/** 特殊2点消耗移动配置 */
const SPECIAL_2_COST_MOVES: { from: string; to: string }[] = [
  { from: 'first_hall', to: 'first_garden_east' },        // 一楼大厅 -> 东花园
  { from: 'first_crime', to: 'first_garden_south' },       // 第一案发现场 -> 南花园
  { from: 'basement_north', to: 'first_garden_north' },    // 地下室北走廊 -> 北花园
  { from: 'first_garden_east', to: 'first_garden_south' }, // 东花园 -> 南花园
  { from: 'first_garden_south', to: 'first_garden_east' }, // 南花园 -> 东花园
  { from: 'first_garden_east', to: 'first_garden_north' }, // 东花园 -> 北花园
  { from: 'first_garden_north', to: 'first_garden_east' }, // 北花园 -> 东花园
];

/** 检查是否是特殊2点消耗移动 */
export function isSpecial2CostMove(from: string, to: string): boolean {
  return SPECIAL_2_COST_MOVES.some(m => m.from === from && m.to === to);
}

/** 
 * 将行动线转换为显示格式（2点消耗显示为2次行动）
 * 规则：消耗2点的移动，显示为"移动到X" + "停留在X"
 * 修改：获得滑雪套装后不改变已发生的行动线显示
 */
export function convertToDisplayActionLine(
  actionLine: ActionStepDetail[],
  hasSki: boolean
): DisplayActionStep[] {
  if (!actionLine || actionLine.length === 0) return [];

  const result: DisplayActionStep[] = [];
  let displayStep = 1;

  // 按原始步骤排序
  const sortedSteps = [...actionLine].sort((a, b) => a.step - b.step);

  for (const step of sortedSteps) {
    const location = getLocationById(step.locationId);
    const locationName = location?.name || step.locationId;

    // 检查是否是2点消耗的移动
    const is2CostMove = step.cost === 2 || (step.cost === undefined && isSpecial2CostMoveByContext(step));

    // 关键修复：使用步骤中记录的原始消耗来判断，而不是当前的hasSki状态
    // 这样可以确保获得滑雪套装后不会改变已发生的行动线显示
    const was2CostWhenExecuted = step.cost === 2;

    if (was2CostWhenExecuted || (is2CostMove && !hasSki)) {
      // 2点消耗：显示为2次行动
      // 第一次：移动到目标地点
      result.push({
        displayStep: displayStep++,
        originalStep: step.step,
        locationId: step.locationId,
        locationName: locationName,
        isStayAction: false,
        cost: 1
      });

      // 第二次：停留在目标地点（如果还有步骤额度）
      if (displayStep <= 8) {
        result.push({
          displayStep: displayStep++,
          originalStep: step.step,
          locationId: step.locationId,
          locationName: locationName, // 修改：不再添加"(停留)"后缀
          isStayAction: true,
          cost: 1
        });
      }
    } else {
      // 普通1点消耗
      result.push({
        displayStep: displayStep++,
        originalStep: step.step,
        locationId: step.locationId,
        locationName: locationName,
        isStayAction: false,
        cost: step.cost || 1
      });
    }
  }

  // 只保留前8个显示步骤
  return result.slice(0, 8);
}

/** 根据上下文判断是否是2点消耗移动 */
function isSpecial2CostMoveByContext(step: ActionStepDetail): boolean {
  // 可以通过action字段判断
  return step.action === 'move' && step.cost === 2;
}

/** 获取某轮结算后的血量历史 */
export function getHealthHistoryForRound(
  round: number,
  roundHistory: RoundHistory[],
  players: Player[]
): HealthHistory | null {
  const history = roundHistory.find(h => h.round === round);
  if (!history) return null;

  return {
    round,
    afterSettlement: true,
    playerHealths: history.players.map(p => ({
      playerId: p.id,
      playerName: p.name,
      health: p.health,
      maxHealth: p.maxHealth,
      isAlive: p.isAlive
    }))
  };
}

/**
 * 计算重叠行动线
 * 规则：每一轮有8个行动，每个行动会到一个房间
 * 当第X次行动，有2人或多人在同一地点，视为重叠行动线
 * 修改：虚弱状态玩家不参与行动线重叠结算
 */
export function calculateOverlappingActions(
  players: Player[],
  lightLocations: string[],
  powderTarget: string | null,
  round: number
): {
  steps1_4: OverlappingAction[];
  steps5_8: OverlappingAction[];
  powderLocationOverlaps: OverlappingAction[];
} {
  const step1_4: OverlappingAction[] = [];
  const step5_8: OverlappingAction[] = [];
  const powderOverlaps: OverlappingAction[] = [];

  // 按步骤分组检查重叠（1-8步）
  for (let stepNum = 1; stepNum <= 8; stepNum++) {
    const stepOverlaps = new Map<string, string[]>(); // locationId -> playerIds

    players.forEach(p => {
      // 关键修复：虚弱状态玩家不参与行动线重叠结算
      if (p.isWeakened || p.health === 0) return;
      
      const stepAtNum = p.actionLine?.find(s => s.step === stepNum);
      if (stepAtNum) {
        const locId = stepAtNum.locationId;
        if (!stepOverlaps.has(locId)) {
          stepOverlaps.set(locId, []);
        }
        stepOverlaps.get(locId)!.push(p.id);
      }
    });

    // 检查每个地点是否有重叠（2人及以上）
    stepOverlaps.forEach((playerIds, locId) => {
      if (playerIds.length >= 2) {
        const location = getLocationById(locId);
const overlap: OverlappingAction = {
  step: stepNum,
  locationId: locId,
  locationName: location?.name || locId,
  playerIds: playerIds,
  playerNames: playerIds.map(id => players.find(p => p.id === id)?.name || '未知'),
  isPowderLocation: !!powderTarget && !!players.find(p => p.id === powderTarget)?.actionLine?.some(s => s.locationId === locId)
};
        // 分类存储
        if (stepNum <= 4) {
          step1_4.push(overlap);
        } else {
          step5_8.push(overlap);
        }

        // 检查是否是荧光粉相关
        if (lightLocations.includes(locId) || (powderTarget && isPowderLocation(locId, players, powderTarget))) {
          powderOverlaps.push(overlap);
        }
      }
    });
  }

  return {
    steps1_4: step1_4,
    steps5_8: step5_8,
    powderLocationOverlaps: powderOverlaps
  };
}

/**
 * 计算亮灯地点和荧光粉地点的重叠行动线（用于表格显示）
 * 修改：只公示被撒荧光粉玩家的行动线 或者 亮灯地点的重叠行动线
 * 规则：如果有重叠时间线，但该区域未亮灯则不进行公示；如果房间亮灯，但该房间无重叠时间线则不进行公示
 */
export function calculateOverlappingActionsForTable(
  players: Player[],
  lightLocations: string[],
  powderTarget: string | null,
  round: number
): {
  steps1_4: OverlappingAction[];
  steps5_8: OverlappingAction[];
  powderLocationOverlaps: OverlappingAction[];
} {
  const step1_4: OverlappingAction[] = [];
  const step5_8: OverlappingAction[] = [];
  const powderOverlaps: OverlappingAction[] = [];

  // 获取荧光粉目标玩家的行动线地点
  const powderTargetPlayer = powderTarget ? players.find(p => p.id === powderTarget) : null;
  const powderLocationIds = powderTargetPlayer 
    ? [...new Set(powderTargetPlayer.actionLine?.map(s => s.locationId) || [])]
    : [];

  // 按步骤分组检查重叠
  for (let stepNum = 1; stepNum <= 8; stepNum++) {
    const stepOverlaps = new Map<string, string[]>(); // locationId -> playerIds

    players.forEach(p => {
      // 虚弱状态玩家不参与行动线重叠结算
      if (p.isWeakened || p.health === 0) return;
      
      const stepAtNum = p.actionLine?.find(s => s.step === stepNum);
      if (stepAtNum) {
        const locId = stepAtNum.locationId;
        if (!stepOverlaps.has(locId)) {
          stepOverlaps.set(locId, []);
        }
        stepOverlaps.get(locId)!.push(p.id);
      }
    });

    // 检查每个地点是否有重叠（2人及以上）
    stepOverlaps.forEach((playerIds, locId) => {
      if (playerIds.length >= 2) {
        const location = getLocationById(locId);
        
        // 关键修复：只公示以下两种情况：
        // 1. 亮灯地点的重叠行动线
        // 2. 荧光粉玩家行动线经过的地点的重叠行动线
        const isLightLocation = lightLocations.includes(locId);
        const isPowderLocation = powderLocationIds.includes(locId);
        
        // 如果该地点既不是亮灯地点也不是荧光粉地点，则不公示
        if (!isLightLocation && !isPowderLocation) return;

        const overlap: OverlappingAction = {
          step: stepNum,
          locationId: locId,
          locationName: location?.name || locId,
          playerIds: playerIds,
          playerNames: playerIds.map(id => players.find(p => p.id === id)?.name || '未知'),
          isPowderLocation: isPowderLocation
        };

        // 分类存储
        if (stepNum <= 4) {
          step1_4.push(overlap);
        } else {
          step5_8.push(overlap);
        }

        // 如果是荧光粉相关，添加到荧光粉重叠列表
        if (isPowderLocation) {
          powderOverlaps.push(overlap);
        }
      }
    });
  }

  return {
    steps1_4: step1_4,
    steps5_8: step5_8,
    powderLocationOverlaps: powderOverlaps
  };
}

/** 检查是否是荧光粉标记的地点 */
function isPowderLocation(locationId: string, players: Player[], powderTarget: string): boolean {
  const target = players.find(p => p.id === powderTarget);
  if (!target) return false;
  return target.actionLine?.some(s => s.locationId === locationId) || false;
}

/** 生成下一轮预告信息 */
export function generateNextRoundPreview(
  round: number,
  fireLocations: string[],
  lightLocations: string[]
): {
  nextFireLocations: string[];
  nextLightFloor: string | null;
} {
  // 当前轮的fireLocations就是下轮的着火点预告
  // 当前轮的lightLocations就是下轮的亮灯楼层
  
  let nextLightFloor: string | null = null;
  if (lightLocations.length > 0) {
    const firstLoc = getLocationById(lightLocations[0]);
    nextLightFloor = firstLoc?.floor 
      ? { 'attic': '阁楼', 'second': '二楼', 'first': '一楼', 'basement': '地下室' }[firstLoc.floor] 
      : null;
  }

  return {
    nextFireLocations: fireLocations.map(id => getLocationById(id)?.name || id),
    nextLightFloor
  };
}

/** 格式化历史数据用于显示 */
export function formatRoundHistory(
  history: RoundHistory,
  allPlayers: Player[]
): {
  round: number;
  healthTable: HealthHistory;
  overlaps: ReturnType<typeof calculateOverlappingActionsForTable>;
  powderTargetName: string | null;
  nextPreview: ReturnType<typeof generateNextRoundPreview>;
} {
  return {
    round: history.round,
    healthTable: getHealthHistoryForRound(history.round, [history], allPlayers)!,
    overlaps: calculateOverlappingActionsForTable(
      history.players,
      history.lightLocations,
      history.powderTarget,
      history.round
    ),
    powderTargetName: history.powderTarget 
      ? history.players.find(p => p.id === history.powderTarget)?.name || null 
      : null,
    nextPreview: generateNextRoundPreview(history.round, history.fireLocations, history.lightLocations)
  };
}

/**
 * 处理血量变化
 * 遵循顺序：坠落伤害、医生相遇、着火伤害（每一轮最多1点）、攻击伤害（每一轮最多1点）、绷带治疗
 * 虚弱状态：血量归零后锁定在0，不会因游戏行为而回复或减少
 */
export function processHealthChanges(
  players: Player[],
  settlementResult: SettlementResult,
  round: number
): Array<{ playerId: string; change: number; reason: string }> {
  const healthChanges: Array<{ playerId: string; change: number; reason: string }> = [];
  
  // 记录已处理的伤害类型（每轮每种伤害最多1点）
  const processedFireDamage = new Set<string>();
  const processedAttackDamage = new Set<string>();
  
  players.forEach(player => {
    // 虚弱状态玩家不处理血量变化
    if (player.isWeakened || player.health === 0) {
      return;
    }
    
    let totalChange = 0;
    const reasons: string[] = [];
    
    // 1. 坠落伤害（已在移动时处理，这里只记录）
    // 坠落伤害在移动时已经扣除，这里不需要再处理
    
    // 2. 医生相遇治疗
    const healEffect = settlementResult.healEffects.find(h => h.playerId === player.id);
    if (healEffect && player.health < player.maxHealth && player.health > 0) {
      totalChange += 1;
      reasons.push('医生治疗');
    }
    
    // 3. 着火伤害（每轮最多1点）
    const fireDamage = settlementResult.fireDamage.find(f => f.playerId === player.id);
    if (fireDamage && !processedFireDamage.has(player.id) && player.health > 0) {
      totalChange -= 1;
      processedFireDamage.add(player.id);
      reasons.push('着火伤害');
    }
    
    // 4. 攻击伤害（每轮最多1点）
    const attackDamage = settlementResult.attackDamage.find(a => a.playerId === player.id);
    if (attackDamage && !processedAttackDamage.has(player.id) && player.health > 0) {
      totalChange -= 1;
      processedAttackDamage.add(player.id);
      reasons.push(`被${attackDamage.attackerName}攻击`);
    }
    
    // 5. 绷带治疗（在道具使用时已经处理，这里不需要再处理）
    
    if (totalChange !== 0) {
      healthChanges.push({
        playerId: player.id,
        change: totalChange,
        reason: reasons.join('、')
      });
    }
  });
  
  return healthChanges;
}

/**
 * 检查并更新虚弱状态
 * 虚弱状态定义：若玩家生命值归零，则生命值将锁定在0
 * 该玩家进入虚弱状态，后续每轮仅有4个行动点
 * 不参与行动线重叠的结算，个人累积的分数将全部失效
 */
export function checkAndUpdateWeakenedState(player: Player): void {
  // 如果血量归零且未进入虚弱状态
  if (player.health === 0 && !player.isWeakened) {
    player.isWeakened = true;
    player.isAlive = false;
    player.actionPoints = 4; // 虚弱状态每轮只有4个行动点
    player.score = 0; // 个人累积的分数全部失效
  }
  
  // 确保虚弱状态玩家的血量不会低于0
  if (player.isWeakened) {
    player.health = 0;
    player.score = 0; // 保持分数为0
  }
}
