// src/data/locations.ts
/**
 * 游戏场景地点定义与相关工具函数
 */

// 楼层类型定义
export type Floor = 'attic' | 'second' | 'first' | 'basement';

// 地点类型定义
export interface Location {
  id: string;
  name: string;
  floor: Floor;
  type: 'normal' | 'special' | 'crime' | 'garden';
  connections: string[];
  description: string;
}

// 所有游戏地点数据（基于 roomFragments.ts 的26个房间）
export const locations: Location[] = [
  // 阁楼区域 (3个房间)
  {
    id: 'attic_main',
    name: '阁楼',
    floor: 'attic',
    type: 'normal',
    connections: ['attic_therapy', 'attic_balcony', 'second_storage'],
    description: '庄园的阁楼空间，位于建筑最顶层'
  },
  {
    id: 'attic_therapy',
    name: '理疗室',
    floor: 'attic',
    type: 'special',
    connections: ['attic_main'],
    description: '配备理疗设备的房间，用于康复和治疗'
  },
  {
    id: 'attic_balcony',
    name: '阁楼阳台',
    floor: 'attic',
    type: 'normal',
    connections: ['attic_main', 'first_garden_north', 'first_garden_east', 'first_garden_south'],
    description: '阁楼外的阳台，可以俯瞰整个庄园的花园'
  },
  
  // 二楼区域 (10个房间)
  {
    id: 'second_storage',
    name: '储物室',
    floor: 'second',
    type: 'normal',
    connections: ['attic_main', 'second_corridor', 'second_crime'],
    description: '存放杂物的房间，连接阁楼和二楼走廊'
  },
  {
    id: 'second_control',
    name: '中控室',
    floor: 'second',
    type: 'special',
    connections: ['second_corridor', 'second_tool'],
    description: '庄园的中央控制室，监控各种设备运行'
  },
  {
    id: 'second_tool',
    name: '工具间',
    floor: 'second',
    type: 'normal',
    connections: ['second_corridor', 'second_control'],
    description: '存放维修工具和设备的房间'
  },
  {
    id: 'second_corridor',
    name: '二楼走廊',
    floor: 'second',
    type: 'normal',
    connections: ['second_storage', 'second_control', 'second_tool', 'second_crime', 'second_bedroom_b', 'second_hall'],
    description: '连接二楼各个房间的主要通道'
  },
  {
    id: 'second_bedroom_b',
    name: '客房B',
    floor: 'second',
    type: 'normal',
    connections: ['second_corridor'],
    description: '二楼的客房，供宾客居住'
  },
  {
    id: 'second_hall',
    name: '二楼大厅',
    floor: 'second',
    type: 'normal',
    connections: ['second_corridor', 'second_crime', 'second_bedroom_a', 'first_hall'],
    description: '二楼的中央大厅，气派宽敞'
  },
  {
    id: 'second_crime',
    name: '第二案发现场',
    floor: 'second',
    type: 'crime',
    connections: ['second_storage', 'second_corridor', 'second_hall', 'second_balcony_north', 'second_bedroom_a'],
    description: '发生第二起案件的现场，留有重要线索'
  },
  {
    id: 'second_balcony_north',
    name: '二楼阳台北侧',
    floor: 'second',
    type: 'normal',
    connections: ['second_crime', 'second_balcony', 'first_garden_north'],
    description: '二楼北侧的阳台，朝向花园'
  },
  {
    id: 'second_bedroom_a',
    name: '客房A',
    floor: 'second',
    type: 'normal',
    connections: ['second_crime', 'second_balcony', 'second_hall'],
    description: '二楼的另一间客房，装修精致'
  },
  {
    id: 'second_balcony',
    name: '二楼阳台',
    floor: 'second',
    type: 'normal',
    connections: ['second_balcony_north', 'second_bedroom_a', 'first_garden_east'],
    description: '二楼的主要阳台，视野开阔'
  },
  
  // 一楼区域 - 花园 (3个房间)
  {
    id: 'first_garden_north',
    name: '北花园',
    floor: 'first',
    type: 'garden',
    connections: ['first_garden_east', 'basement_north'],
    description: '庄园北侧的花园，种植着高大的树木'
  },
  {
    id: 'first_garden_east',
    name: '东花园',
    floor: 'first',
    type: 'garden',
    connections: ['first_garden_north', 'first_hall', 'first_garden_south'],
    description: '庄园东侧的花园，阳光充足'
  },
  {
    id: 'first_garden_south',
    name: '南花园',
    floor: 'first',
    type: 'garden',
    connections: ['first_garden_east', 'first_crime'],
    description: '庄园南侧的花园，靠近主入口'
  },
  
  // 一楼区域 - 室内 (6个房间)
  {
    id: 'first_dining',
    name: '餐厅',
    floor: 'first',
    type: 'normal',
    connections: ['basement_south', 'first_crime', 'first_corridor'],
    description: '庄园的餐厅，可容纳多人用餐'
  },
  {
    id: 'first_crime',
    name: '第一案发现场',
    floor: 'first',
    type: 'crime',
    connections: ['first_corridor', 'first_hall', 'first_dining', 'first_garden_south'],
    description: '发生第一起案件的现场，是调查的关键区域'
  },
  {
    id: 'first_corridor',
    name: '一楼走廊',
    floor: 'first',
    type: 'normal',
    connections: ['first_living_b', 'first_hall', 'first_dining', 'first_crime'],
    description: '连接一楼各个房间的走廊'
  },
  {
    id: 'first_living_b',
    name: '起居室B',
    floor: 'first',
    type: 'normal',
    connections: ['first_corridor', 'first_living_a'],
    description: '一楼的后侧起居室，较为私密'
  },
  {
    id: 'first_living_a',
    name: '起居室A',
    floor: 'first',
    type: 'normal',
    connections: ['first_living_b', 'first_hall', 'first_cloakroom'],
    description: '一楼的主起居室，靠近大厅'
  },
  {
    id: 'first_cloakroom',
    name: '衣帽间',
    floor: 'first',
    type: 'normal',
    connections: ['first_living_a'],
    description: '存放衣物和帽子的房间'
  },
  {
    id: 'first_hall',
    name: '一楼大厅',
    floor: 'first',
    type: 'normal',
    connections: ['second_hall', 'first_corridor', 'first_crime', 'first_living_a', 'first_garden_east'],
    description: '庄园的主大厅，是迎宾和聚会的场所'
  },
  
  // 地下室区域 (3个房间)
  {
    id: 'basement_north',
    name: '地下室北走廊',
    floor: 'basement',
    type: 'normal',
    connections: ['first_garden_north', 'basement_south'],
    description: '地下室北侧的通道，较为阴暗'
  },
  {
    id: 'basement_south',
    name: '地下室南走廊',
    floor: 'basement',
    type: 'normal',
    connections: ['basement_north', 'first_dining', 'basement_storage'],
    description: '地下室南侧的通道，连接多个区域'
  },
  {
    id: 'basement_storage',
    name: '杂物间',
    floor: 'basement',
    type: 'normal',
    connections: ['basement_south'],
    description: '存放杂物的房间，堆满了各种物品'
  }
];

/**
 * 根据ID获取地点信息
 * @param id 地点ID
 * @returns 地点对象或undefined
 */
export function getLocationById(id: string): Location | undefined {
  return locations.find(location => location.id === id);
}

/**
 * 获取某个地点的所有连通地点
 * @param locationId 地点ID
 * @returns 连通的地点数组
 */
export function getConnectedLocations(locationId: string): Location[] {
  const location = getLocationById(locationId);
  if (!location) return [];
  
  return location.connections
    .map(connId => getLocationById(connId))
    .filter((loc): loc is Location => !!loc);
}

/**
 * 计算移动成本
 * @param from 出发地点ID
 * @param to 目标地点ID
 * @param hasSki 是否拥有滑雪套装
 * @returns 移动所需的行动点数
 */
export function getMoveCost(from: string, to: string, hasSki: boolean): number {
  const fromLocation = getLocationById(from);
  const toLocation = getLocationById(to);
  
  // 无效地点返回极高成本
  if (!fromLocation || !toLocation) return 999;
  
  // 花园特殊移动规则：
  // 1. 从室内到花园/花园到花园：消耗2点（有滑雪套装则1点）
  // 2. 从花园到室内：消耗1点（不受滑雪套装影响）
  
  if (fromLocation.type === 'garden' && toLocation.type !== 'garden') {
    return 1; // 从花园到室内固定1点
  }

  if (toLocation.type === 'garden') {
    return hasSki ? 1 : 2;
  }
  
  // 普通室内移动固定消耗1点
  return 1;
}

/**
 * 获取某一楼层的所有地点
 * @param floor 楼层
 * @returns 该楼层的地点数组
 */
export function getLocationsByFloor(floor: Floor): Location[] {
  return locations.filter(location => location.floor === floor);
}

/**
 * 获取特定类型的所有地点
 * @param type 地点类型
 * @returns 该类型的地点数组
 */
export function getLocationsByType(type: Location['type']): Location[] {
  return locations.filter(location => location.type === type);
}