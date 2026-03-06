// src/data/roomFeatures.ts
import type { ItemType } from '@/types/game';

export interface RoomFeature {
  roomId: string;
  roomName: string;
  cost: number;
  itemReward?: ItemType;
  action: 'get_item' | 'view_score';
  description: string;
}

// 可获取道具的房间配置
export const roomFeatures: RoomFeature[] = [
  {
    roomId: 'first_cloakroom',
    roomName: '衣帽间',
    cost: 1,
    itemReward: 'ski',
    action: 'get_item',
    description: '消耗1点行动点，获得滑雪套装'
  },
  {
    roomId: 'second_control',
    roomName: '中控室',
    cost: 1,
    action: 'view_score',
    description: '消耗1点行动点，查看上一轮结算后自己的总分'
  },
  {
    roomId: 'second_storage',
    roomName: '储物室',
    cost: 1,
    itemReward: 'powder',
    action: 'get_item',
    description: '消耗1点行动点，获得荧光粉'
  },
  {
    roomId: 'second_tool',
    roomName: '工具间',
    cost: 1,
    itemReward: 'extinguisher',
    action: 'get_item',
    description: '消耗1点行动点，获得灭火器'
  },
  {
    roomId: 'attic_therapy',
    roomName: '理疗室',
    cost: 1,
    itemReward: 'bandage',
    action: 'get_item',
    description: '消耗1点行动点，获得绷带'
  },
  {
    roomId: 'basement_storage',
    roomName: '杂物间',
    cost: 1,
    itemReward: 'rope',
    action: 'get_item',
    description: '消耗1点行动点，获得绳索'
  }
];

// 检查房间是否有特殊功能
export function getRoomFeature(roomId: string): RoomFeature | undefined {
  return roomFeatures.find(f => f.roomId === roomId);
}

// 检查玩家是否可以获取道具（不能重复获取已有道具）
export function canAcquireItem(
  roomId: string, 
  playerItems: ItemType[]
): { canAcquire: boolean; reason?: string } {
  const feature = getRoomFeature(roomId);
  if (!feature || !feature.itemReward) {
    return { canAcquire: false, reason: '该房间没有道具可获取' };
  }
  
  if (playerItems.includes(feature.itemReward)) {
    return { 
      canAcquire: false, 
      reason: `你已拥有${getItemName(feature.itemReward)}，无法重复获取` 
    };
  }
  
  return { canAcquire: true };
}

// 道具名称映射
export function getItemName(item: ItemType): string {
  const names: Record<ItemType, string> = {
    bandage: '急救绷带',
    powder: '荧光粉',
    extinguisher: '灭火器',
    rope: '登山绳',
    ski: '滑雪套装'
  };
  return names[item];
}

// 道具详细说明
export interface ItemDetail {
  id: ItemType;
  name: string;
  description: string;
  usage: string;
  effect: string;
  useCost: number;  // 使用消耗的行动点
  consumable: boolean;
}

export const itemDetails: ItemDetail[] = [
  {
    id: 'bandage',
    name: '急救绷带',
    description: '医疗用品，可用于恢复生命值',
    usage: '对自己使用',
    effect: '消耗1点行动点，立即恢复1点生命值',
    useCost: 1,  // 使用消耗1点行动点
    consumable: true
  },
  {
    id: 'powder',
    name: '荧光粉',
    description: '特殊的荧光粉末，可标记目标',
    usage: '对任意一名玩家使用',
    effect: '消耗1点行动点，下一轮该玩家的完整行动线将被公示',
    useCost: 1,  // 使用消耗1点行动点
    consumable: true
  },
  {
    id: 'extinguisher',
    name: '灭火器',
    description: '消防器材，可扑灭火灾',
    usage: '在自己所在的着火房间使用',
    effect: '消耗1点行动点，扑灭当前房间的火灾',
    useCost: 1,  // 使用消耗1点行动点
    consumable: true
  },
  {
    id: 'rope',
    name: '登山绳',
    description: '专业登山绳索，可用于安全跳楼',
    usage: '被动生效，无需主动使用',
    effect: '跳楼不受伤害或反向移动（无需消耗行动点）',
    useCost: 0,  // 被动道具，不消耗
    consumable: true  // 使用一次后消耗
  },
  {
    id: 'ski',
    name: '滑雪套装',
    description: '专业滑雪装备',
    usage: '被动生效，无需主动使用',
    effect: '从相邻地点移动至花园仅需消耗1点行动点（原为2点）',
    useCost: 0,  // 被动道具，不消耗
    consumable: false  // 永久道具，不消耗
  }
];