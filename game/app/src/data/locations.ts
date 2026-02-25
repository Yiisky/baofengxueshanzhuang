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

// 所有游戏地点数据
export const locations: Location[] = [
  // 一楼区域
  {
    id: 'first_hall',
    name: '大厅',
    floor: 'first',
    type: 'normal',
    connections: ['first_dining', 'first_kitchen', 'first_stairs'],
    description: '庄园的主大厅，装饰华丽，是宾客聚集的主要场所'
  },
  {
    id: 'first_dining',
    name: '餐厅',
    floor: 'first',
    type: 'normal',
    connections: ['first_hall', 'first_kitchen'],
    description: '可容纳10人的大型餐厅，长桌上摆放着精致的餐具'
  },
  {
    id: 'first_kitchen',
    name: '厨房',
    floor: 'first',
    type: 'normal',
    connections: ['first_dining', 'first_hall'],
    description: '设备齐全的现代化厨房，有各种厨具和食材'
  },
  {
    id: 'first_stairs',
    name: '一楼楼梯间',
    floor: 'first',
    type: 'normal',
    connections: ['first_hall', 'second_stairs', 'basement_stairs'],
    description: '连接各楼层的主要楼梯间'
  },
  
  // 二楼区域
  {
    id: 'second_stairs',
    name: '二楼楼梯间',
    floor: 'second',
    type: 'normal',
    connections: ['first_stairs', 'second_bedroom1', 'second_bedroom2', 'second_study'],
    description: '二楼的楼梯间，通往各个卧室和书房'
  },
  {
    id: 'second_bedroom1',
    name: '1号卧室',
    floor: 'second',
    type: 'normal',
    connections: ['second_stairs'],
    description: '豪华的客房，配有独立卫浴'
  },
  {
    id: 'second_bedroom2',
    name: '2号卧室',
    floor: 'second',
    type: 'normal',
    connections: ['second_stairs'],
    description: '舒适的客房，窗外可以看到花园'
  },
  {
    id: 'second_study',
    name: '书房',
    floor: 'second',
    type: 'special',
    connections: ['second_stairs'],
    description: '主人的私人书房，收藏了大量书籍和文件'
  },
  
  // 阁楼区域
  {
    id: 'attic_stairs',
    name: '阁楼楼梯间',
    floor: 'attic',
    type: 'normal',
    connections: ['second_stairs', 'attic_storage'],
    description: '通往阁楼的狭窄楼梯'
  },
  {
    id: 'attic_storage',
    name: '阁楼储藏室',
    floor: 'attic',
    type: 'special',
    connections: ['attic_stairs'],
    description: '堆满杂物的储藏室，很少有人来'
  },
  
  // 地下室区域
  {
    id: 'basement_stairs',
    name: '地下室楼梯间',
    floor: 'basement',
    type: 'normal',
    connections: ['first_stairs', 'basement_cellar', 'basement_workshop'],
    description: '通往地下室的阴暗楼梯'
  },
  {
    id: 'basement_cellar',
    name: '酒窖',
    floor: 'basement',
    type: 'normal',
    connections: ['basement_stairs'],
    description: '存放各种葡萄酒的酒窖，温度恒定'
  },
  {
    id: 'basement_workshop',
    name: '工坊',
    floor: 'basement',
    type: 'special',
    connections: ['basement_stairs'],
    description: '主人的手工工坊，有各种工具和材料'
  },
  
  // 花园区域
  {
    id: 'garden_main',
    name: '主花园',
    floor: 'first',
    type: 'garden',
    connections: ['first_hall', 'garden_rose', 'garden_pool'],
    description: '庄园的主花园，种植着各种花卉'
  },
  {
    id: 'garden_rose',
    name: '玫瑰园',
    floor: 'first',
    type: 'garden',
    connections: ['garden_main'],
    description: '种满各色玫瑰的花园，香气宜人'
  },
  {
    id: 'garden_pool',
    name: '泳池区',
    floor: 'first',
    type: 'garden',
    connections: ['garden_main'],
    description: '带有泳池的休闲区，配有躺椅和遮阳伞'
  },
  
  // 犯罪现场
  {
    id: 'crime_scene',
    name: '案发地点',
    floor: 'second',
    type: 'crime',
    connections: ['second_study'],
    description: '受害者被发现的地方，是案件的核心区域'
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