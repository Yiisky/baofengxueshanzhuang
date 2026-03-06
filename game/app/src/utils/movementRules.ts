// src/utils/movementRules.ts
/**
 * 移动规则管理模块
 * 管理所有房间移动、跳楼、绳索、滑雪套装等规则
 */

import { roomFragments } from '@/data/roomFragments';
import type { ItemType } from '@/types/game';

// ====================== 常量定义 ======================

/**
 * 检查地点是否是花园
 */
//export function isGarden(locationId: string): boolean {
  //const room = roomFragments.find(r => r.id === locationId);
  //return room?.id.includes('garden') || false;
//}

/**
 * 检查地点是否是室内
 */
//export function isIndoor(locationId: string): boolean {
  //const room = roomFragments.find(r => r.id === locationId);
  //return room ? !isGarden(locationId) : true;
//}

/** 特殊起始房间（可双移动） */
export const specialStartRooms = [
  'second_bedroom_a',  // 客房A
  'second_bedroom_b',  // 客房B
  'first_living_a',    // 起居室A
  'first_living_b',    // 起居室B
];

/** 跳楼房间配置 - 修复：明确区分二楼阳台和二楼阳台北侧 */
export const jumpRooms: Record<string, {
  targets: string[];
  healthCost: number;
  actionCost: number;
  minHealth: number;
}> = {
  // 二楼阳台东侧（在代码中标注为 second_balcony）-> 东花园
  'second_balcony': {
    targets: ['first_garden_east'],
    healthCost: 1,
    actionCost: 1,
    minHealth: 2
  },
  // 二楼阳台北侧 -> 北花园
  'second_balcony_north': {
    targets: ['first_garden_north'],
    healthCost: 1,
    actionCost: 1,
    minHealth: 2
  },
  // 阁楼阳台 -> 三个花园
  'attic_balcony': {
    targets: ['first_garden_north', 'first_garden_east', 'first_garden_south'],
    healthCost: 2,
    actionCost: 1,
    minHealth: 3
  }
};

/** 绳索可使用的反向移动路线（花园到阳台）- 修复：明确消耗绳索 */
export const ropeReverseRoutes: { from: string; to: string }[] = [
  { from: 'first_garden_east', to: 'second_balcony' },        // 东花园 -> 二楼阳台东侧
  { from: 'first_garden_north', to: 'second_balcony_north' },  // 北花园 -> 二楼阳台北侧
];

/** 花园房间ID列表 */
const gardenRooms = [
  'first_garden_north',
  'first_garden_east', 
  'first_garden_south'
];

/** 消耗2点行动点的特殊移动（无滑雪套装时） */
const specialCost2Moves: { from: string; to: string }[] = [
  // 地下室北走廊 -> 北花园（2点）
  { from: 'basement_north', to: 'first_garden_north' },
  
  // 花园之间的移动（双向都是2点）
  { from: 'first_garden_east', to: 'first_garden_south' },
  { from: 'first_garden_south', to: 'first_garden_east' },
  { from: 'first_garden_east', to: 'first_garden_north' },
  { from: 'first_garden_north', to: 'first_garden_east' },
  
  // 一楼大厅 -> 东花园（2点）
  { from: 'first_hall', to: 'first_garden_east' },
  
  // 第一案发现场 -> 东花园（2点）
  { from: 'first_crime', to: 'first_garden_east' },
];

/** 消耗1点行动点的反向移动（对应上面的2点移动） */
const specialCost1Moves: { from: string; to: string }[] = [
  // 北花园 -> 地下室北走廊（1点）
  { from: 'first_garden_north', to: 'basement_north' },
  
  // 东花园 -> 一楼大厅（1点）
  { from: 'first_garden_east', to: 'first_hall' },
  
  // 东花园 -> 第一案发现场（1点）
  { from: 'first_garden_east', to: 'first_crime' },
];

/** 室内房间ID列表（非花园） */
const indoorRooms = roomFragments
  .filter(r => !gardenRooms.includes(r.id))
  .map(r => r.id);

// ====================== 辅助函数 ======================

/** 检查是否是花园 */
export function isGarden(roomId: string): boolean {
  return gardenRooms.includes(roomId);
}

/** 检查是否是室内房间 */
export function isIndoor(roomId: string): boolean {
  return indoorRooms.includes(roomId);
}

/** 检查是否是跳楼移动 */
export function isJumpMove(from: string, to: string): {
  isJump: boolean;
  healthCost: number;
  actionCost: number;
  minHealth: number;
} | null {
  const jumpConfig = jumpRooms[from];
  if (jumpConfig && jumpConfig.targets.includes(to)) {
    return {
      isJump: true,
      healthCost: jumpConfig.healthCost,
      actionCost: jumpConfig.actionCost,
      minHealth: jumpConfig.minHealth
    };
  }
  return null;
}

/** 检查是否可以使用绳索反向移动（花园到阳台）- 修复：消耗1行动点 */
export function canUseRopeReverse(from: string, to: string, hasRope: boolean): boolean {
  if (!hasRope) return false;
  return ropeReverseRoutes.some(route => route.from === from && route.to === to);
}

/** 获取跳楼成本（考虑绳索）- 修复：绳索免除伤害，只消耗1行动点 */
export function getJumpCostWithRope(
  from: string, 
  to: string, 
  hasRope: boolean
): { healthCost: number; actionCost: number } {
  const jumpInfo = isJumpMove(from, to);
  if (!jumpInfo) return { healthCost: 0, actionCost: 1 };
  
  // 所有跳楼路线都可以使用绳索免除伤害
  const ropeRoutes = [
    { from: 'second_balcony', to: 'first_garden_east' },        // 二楼阳台东侧 -> 东花园
    { from: 'second_balcony_north', to: 'first_garden_north' }, // 二楼阳台北侧 -> 北花园
    { from: 'attic_balcony', to: 'first_garden_north' },        // 阁楼阳台 -> 北花园
    { from: 'attic_balcony', to: 'first_garden_east' },         // 阁楼阳台 -> 东花园
    { from: 'attic_balcony', to: 'first_garden_south' }         // 阁楼阳台 -> 南花园
  ];
  
  const isRopeRoute = ropeRoutes.some(r => r.from === from && r.to === to);
  
  // 修复：使用绳索时，只消耗1行动点，不消耗血量
  if (hasRope && isRopeRoute) {
    return { healthCost: 0, actionCost: 1 };
  }
  
  return { healthCost: jumpInfo.healthCost, actionCost: jumpInfo.actionCost };
}

/** 检查是否是特殊2点消耗移动 */
function isSpecialCost2Move(from: string, to: string): boolean {
  return specialCost2Moves.some(m => m.from === from && m.to === to);
}

/** 检查是否是特殊1点消耗移动 */
function isSpecialCost1Move(from: string, to: string): boolean {
  return specialCost1Moves.some(m => m.from === from && m.to === to);
}

/** 获取移动成本（考虑滑雪套装和花园移动）- 完全重写以匹配需求 */
export function getMoveCost(
  from: string,
  to: string,
  hasSki: boolean
): number {
  const fromIsGarden = isGarden(from);
  const toIsGarden = isGarden(to);
  
  // ========== 特殊规则优先 ==========
  
  // 1. 检查是否是绳索反向移动（花园到阳台）- 修复：消耗1行动点
  if (canUseRopeReverse(from, to, true)) {
    return 1; // 消耗1个行动点
  }
  
  // 2. 特殊2点消耗移动（可被滑雪套装减免）
  if (isSpecialCost2Move(from, to)) {
    return hasSki ? 1 : 2;
  }
  
  // 3. 特殊1点消耗移动（不受滑雪套装影响）
  if (isSpecialCost1Move(from, to)) {
    return 1;
  }
  
  // 4. 花园之间的移动（南、东、北）
  if (fromIsGarden && toIsGarden) {
    // 没有滑雪套装时，花园之间移动消耗2点
    return hasSki ? 1 : 2;
  }
  
  // 5. 从室内到花园（非特殊规则已处理的情况）
  if (!fromIsGarden && toIsGarden) {
    return hasSki ? 1 : 2;
  }
  
  // 6. 从花园到室内（非特殊规则已处理的情况）
  if (fromIsGarden && !toIsGarden) {
    return 1;
  }
  
  // 7. 室内到室内
  return 1;
}

/** 获取玩家起始位置 */
export function getPlayerStartLocation(player: { role?: string }): string {
  // 根据角色返回默认起始位置，实际游戏中由玩家选择
  return '';
}

/** 检查绳索移动是否消耗道具 - 修复：反向移动消耗绳索，跳楼不消耗 */
export function shouldConsumeRope(from: string, to: string): boolean {
  // 绳索反向移动（花园到阳台）消耗绳索
  if (ropeReverseRoutes.some(r => r.from === from && r.to === to)) {
    return true;
  }
  // 跳楼使用绳索免除伤害不消耗绳索
  return false;
}

/** 获取移动描述 - 修复：准确描述消耗 + 补充缺失的 fromIsGarden/toIsGarden 变量 */
export function getMoveDescription(
  from: string,
  to: string,
  hasSki: boolean,
  hasRope: boolean
): string {
  const fromRoom = roomFragments.find(r => r.id === from);
  const toRoom = roomFragments.find(r => r.id === to);
  
  if (!fromRoom || !toRoom) return '未知移动';
  
  // 修复：补充缺失的变量定义（调用已导出的 isGarden 函数）
  const fromIsGarden = isGarden(from);
  const toIsGarden = isGarden(to);
  
  // 检查绳索反向移动
  if (canUseRopeReverse(from, to, hasRope)) {
    return `使用绳索从${fromRoom.name}攀爬到${toRoom.name}（消耗1行动点，消耗绳索）`;
  }
  
  // 检查跳楼
  const jumpInfo = isJumpMove(from, to);
  if (jumpInfo) {
    const cost = getJumpCostWithRope(from, to, hasRope);
    if (hasRope && cost.healthCost === 0) {
      return `使用绳索安全跳楼到${toRoom.name}（消耗1行动点，绳索免除伤害，不消耗绳索）`;
    }
    return `跳楼到${toRoom.name}（消耗${jumpInfo.actionCost}行动点，${jumpInfo.healthCost}点生命值）`;
  }
  
  // 普通移动 - 使用与实际消耗一致的计算
  const cost = getMoveCost(from, to, hasSki);
  
  // 构建消耗说明
  let costDescription = `消耗${cost}点行动点`;
  
  // 添加滑雪套装减免提示
  if (hasSki && isSpecialCost2Move(from, to)) {
    costDescription += '（滑雪套装减免）';
  } else if (hasSki && fromIsGarden && toIsGarden) {
    costDescription += '（滑雪套装减免）';
  }
  
  return `移动到${toRoom.name}（${costDescription}）`;
}

/** 检查移动是否有效 */
export function isValidMove(from: string, to: string): boolean {
  const fromRoom = roomFragments.find(r => r.id === from);
  return fromRoom?.connections.includes(to) || false;
}

/** 获取所有可移动的目标房间 */
export function getValidMoveTargets(currentLocation: string): string[] {
  const currentRoom = roomFragments.find(r => r.id === currentLocation);
  return currentRoom?.connections || [];
}