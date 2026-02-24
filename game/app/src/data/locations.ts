import type { Location, Floor } from '@/types/game';

// 所有地点定义
export const locations: Location[] = [
  // 阁楼
  {
    id: 'attic_therapy',
    name: '理疗室',
    floor: 'attic',
    type: 'special',
    connections: ['attic_main', 'attic_balcony'],
    description: '消耗1个行动点，获得一个"绷带"'
  },
  {
    id: 'attic_main',
    name: '阁楼',
    floor: 'attic',
    type: 'normal',
    connections: ['attic_therapy', 'attic_balcony', 'second_hall'],
    description: '普通房间'
  },
  {
    id: 'attic_balcony',
    name: '阁楼阳台',
    floor: 'attic',
    type: 'special',
    connections: ['attic_main', 'attic_therapy', 'first_north_garden', 'first_east_garden', 'first_south_garden'],
    description: '消耗1个行动点和2点生命值，跳入北花园、东花园或南花园。跳落伤害即时结算，若生命值≤2，则无法从此跳落'
  },
  
  // 二楼
  {
    id: 'second_storage',
    name: '储藏室',
    floor: 'second',
    type: 'special',
    connections: ['second_corridor', 'second_control'],
    description: '消耗1个行动点，获得一个"荧光粉"'
  },
  {
    id: 'second_control',
    name: '中控室',
    floor: 'second',
    type: 'special',
    connections: ['second_storage', 'second_tool', 'second_corridor'],
    description: '消耗1个行动点，查看上一轮结算后自己的总分'
  },
  {
    id: 'second_tool',
    name: '工具间',
    floor: 'second',
    type: 'special',
    connections: ['second_control', 'second_corridor'],
    description: '消耗1个行动点，获得一个"灭火器"'
  },
  {
    id: 'second_crime',
    name: '第二案发现场',
    floor: 'second',
    type: 'crime',
    connections: ['second_corridor', 'second_room_a', 'second_room_b'],
    description: '第一轮凶手可能从该地点开始行动'
  },
  {
    id: 'second_room_a',
    name: '客房A',
    floor: 'second',
    type: 'special',
    connections: ['second_crime', 'second_corridor', 'second_balcony_east'],
    description: '每轮从该地点开始行动的玩家，可消耗第1个行动点，连续移动2个地点'
  },
  {
    id: 'second_room_b',
    name: '客房B',
    floor: 'second',
    type: 'special',
    connections: ['second_crime', 'second_corridor', 'second_balcony_north'],
    description: '每轮从该地点开始行动的玩家，可消耗第1个行动点，连续移动2个地点'
  },
  {
    id: 'second_hall',
    name: '二楼大厅',
    floor: 'second',
    type: 'normal',
    connections: ['second_corridor', 'first_hall', 'attic_main'],
    description: '普通房间'
  },
  {
    id: 'second_corridor',
    name: '二楼走廊',
    floor: 'second',
    type: 'normal',
    connections: ['second_hall', 'second_storage', 'second_control', 'second_tool', 'second_crime', 'second_room_a', 'second_room_b'],
    description: '普通房间'
  },
  {
    id: 'second_balcony_north',
    name: '二楼阳台北侧',
    floor: 'second',
    type: 'special',
    connections: ['second_room_b', 'first_north_garden'],
    description: '消耗1个行动点和1点生命值，跳入北花园。跳落伤害即时结算，若生命值≤1，则无法从此跳落'
  },
  {
    id: 'second_balcony_east',
    name: '二楼阳台东侧',
    floor: 'second',
    type: 'special',
    connections: ['second_room_a', 'first_east_garden'],
    description: '消耗1个行动点和1点生命值，跳入东花园。跳落伤害即时结算，若生命值≤1，则无法从此跳落'
  },
  
  // 一楼
  {
    id: 'first_dining',
    name: '餐厅',
    floor: 'first',
    type: 'normal',
    connections: ['first_corridor', 'first_living_b'],
    description: '普通房间'
  },
  {
    id: 'first_living_a',
    name: '起居室A',
    floor: 'first',
    type: 'special',
    connections: ['first_corridor', 'first_hall', 'first_cloakroom'],
    description: '每轮从该地点开始行动的玩家，可消耗第1个行动点，连续移动2个地点'
  },
  {
    id: 'first_living_b',
    name: '起居室B',
    floor: 'first',
    type: 'special',
    connections: ['first_corridor', 'first_dining'],
    description: '每轮从该地点开始行动的玩家，可消耗第1个行动点，连续移动2个地点'
  },
  {
    id: 'first_corridor',
    name: '一楼走廊',
    floor: 'first',
    type: 'normal',
    connections: ['first_living_a', 'first_living_b', 'first_dining', 'first_crime', 'first_hall'],
    description: '普通房间'
  },
  {
    id: 'first_crime',
    name: '第一案发现场',
    floor: 'first',
    type: 'crime',
    connections: ['first_corridor', 'first_hall'],
    description: '第一轮凶手可能从该地点开始行动'
  },
  {
    id: 'first_hall',
    name: '一楼大厅',
    floor: 'first',
    type: 'normal',
    connections: ['first_crime', 'first_corridor', 'first_living_a', 'second_hall'],
    description: '普通房间'
  },
  {
    id: 'first_cloakroom',
    name: '衣帽间',
    floor: 'first',
    type: 'special',
    connections: ['first_living_a'],
    description: '消耗1个行动点，获得一个"滑雪套装"'
  },
  {
    id: 'first_north_garden',
    name: '北花园',
    floor: 'first',
    type: 'garden',
    connections: ['second_balcony_north', 'first_east_garden', 'first_south_garden', 'first_living_a'],
    description: '由于积雪深厚，玩家需消耗2个行动点才能移动至花园（包括从室内到花园、从花园到花园，但从花园到室内只消耗1个行动点），若剩余1个行动点，则无法移动至花园'
  },
  {
    id: 'first_east_garden',
    name: '东花园',
    floor: 'first',
    type: 'garden',
    connections: ['second_balcony_east', 'first_north_garden', 'first_south_garden'],
    description: '由于积雪深厚，玩家需消耗2个行动点才能移动至花园（包括从室内到花园、从花园到花园，但从花园到室内只消耗1个行动点），若剩余1个行动点，则无法移动至花园'
  },
  {
    id: 'first_south_garden',
    name: '南花园',
    floor: 'first',
    type: 'garden',
    connections: ['first_north_garden', 'first_east_garden'],
    description: '由于积雪深厚，玩家需消耗2个行动点才能移动至花园（包括从室内到花园、从花园到花园，但从花园到室内只消耗1个行动点），若剩余1个行动点，则无法移动至花园'
  },
  
  // 地下室
  {
    id: 'basement_north',
    name: '地下室北走廊',
    floor: 'basement',
    type: 'normal',
    connections: ['basement_south'],
    description: '普通房间'
  },
  {
    id: 'basement_south',
    name: '地下室南走廊',
    floor: 'basement',
    type: 'normal',
    connections: ['basement_north', 'basement_storage'],
    description: '普通房间'
  },
  {
    id: 'basement_storage',
    name: '杂物间',
    floor: 'basement',
    type: 'special',
    connections: ['basement_south'],
    description: '消耗1个行动点，获得一个"绳索"'
  }
];

// 获取地点 by ID
export function getLocationById(id: string): Location | undefined {
  return locations.find(loc => loc.id === id);
}

// 获取楼层地点
export function getLocationsByFloor(floor: Floor): Location[] {
  return locations.filter(loc => loc.floor === floor);
}

// 获取可连接地点
export function getConnectedLocations(locationId: string): Location[] {
  const location = getLocationById(locationId);
  if (!location) return [];
  return location.connections.map(id => getLocationById(id)).filter((loc): loc is Location => loc !== undefined);
}

// 检查两个地点是否相邻
export function areLocationsConnected(loc1: string, loc2: string): boolean {
  const location = getLocationById(loc1);
  if (!location) return false;
  return location.connections.includes(loc2);
}

// 获取移动消耗
export function getMoveCost(_from: string, to: string, hasSki: boolean): number {
  const toLocation = getLocationById(to);
  if (!toLocation) return 999;
  
  // 花园特殊规则
  if (toLocation.type === 'garden') {
    return hasSki ? 1 : 2;
  }
  
  // 室内移动消耗1点
  return 1;
}
