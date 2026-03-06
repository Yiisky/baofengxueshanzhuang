export interface RoomFragmentData {
  id: string;
  name: string;
  floor: 'attic' | 'second' | 'first' | 'basement';
  position: {
    left: string;
    top: string;
    width: string;
    height: string;
  };
  clipPath: string;
  isCrimeScene?: boolean;
  maxPlayers?: number;
  connections: string[];
  // 添加 isBurning 可选属性（用于运行时状态）
  isBurning?: boolean;
}

// 图片分辨率
const IMG_WIDTH = 2160;
const IMG_HEIGHT = 2580;

// 房间名到ID的映射（用于处理相邻房间名称）
const roomNameToId: Record<string, string> = {
  '阁楼': 'attic_main',
  '理疗室': 'attic_therapy',
  '阁楼阳台': 'attic_balcony',
  '储物室': 'second_storage',
  '中控室': 'second_control',
  '工具间': 'second_tool',
  '二楼走廊': 'second_corridor',
  '客房B': 'second_bedroom_b',
  '二楼大厅': 'second_hall',
  '第二案发现场': 'second_crime',
  '二楼阳台北侧': 'second_balcony_north',
  '客房A': 'second_bedroom_a',
  '二楼阳台': 'second_balcony',
  '北花园': 'first_garden_north',
  '东花园': 'first_garden_east',
  '南花园': 'first_garden_south',
  '餐厅': 'first_dining',
  '第一案发现场': 'first_crime',
  '一楼走廊': 'first_corridor',
  '起居室B': 'first_living_b',
  '起居室A': 'first_living_a',
  '衣帽间': 'first_cloakroom',
  '一楼大厅': 'first_hall',
  '地下室北走廊': 'basement_north',
  '地下室南走廊': 'basement_south',
  '杂物间': 'basement_storage'
};

// 辅助函数：解析坐标字符串 "x,y" -> [x, y]
function parseCoord(coord: string): [number, number] {
  const [x, y] = coord.split(',').map(Number);
  return [x, y];
}

// 辅助函数：多边形转边界框和clipPath
function createRoomFragment(
  id: string,
  name: string,
  floor: RoomFragmentData['floor'],
  coordStrings: string[],
  neighborNames: string[],
  options: { isCrimeScene?: boolean; maxPlayers?: number } = {}
): RoomFragmentData {
  // 过滤空坐标
  const points = coordStrings
    .filter(s => s && s.includes(','))
    .map(parseCoord);
  
  if (points.length < 3) {
    console.error(`房间 ${name} 坐标不足`, coordStrings);
    throw new Error(`房间 ${name} 需要至少3个坐标点`);
  }
  
  // 计算边界框
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // 防止除零
  const safeWidth = width || 1;
  const safeHeight = height || 1;
  
  // 转换为百分比
  const leftPct = (minX / IMG_WIDTH * 100).toFixed(2);
  const topPct = (minY / IMG_HEIGHT * 100).toFixed(2);
  const widthPct = (width / IMG_WIDTH * 100).toFixed(2);
  const heightPct = (height / IMG_HEIGHT * 100).toFixed(2);
  
  // 生成clipPath（相对于元素本身的百分比）
  const clipPath = points.map(p => {
    const relX = ((p[0] - minX) / safeWidth * 100).toFixed(1);
    const relY = ((p[1] - minY) / safeHeight * 100).toFixed(1);
    return `${relX}% ${relY}%`;
  }).join(', ');
  
  // 转换相邻房间名称到ID
  const connections = neighborNames
    .filter(name => name && roomNameToId[name])
    .map(name => roomNameToId[name]);
  
  return {
    id,
    name,
    floor,
    position: {
      left: `${leftPct}%`,
      top: `${topPct}%`,
      width: `${widthPct}%`,
      height: `${heightPct}%`,
    },
    clipPath: `polygon(${clipPath})`,
    connections,
    ...options
  };
}

// ====================== 26个房间数据（严格按表格） ======================

export const roomFragments: RoomFragmentData[] = [
  // 房间1: 阁楼
  createRoomFragment(
    'attic_main',
    '阁楼',
    'attic',
    ['882,250', '923,225', '1011,259', '1077,216', '1524,374', '1196,599', '925,500', '925,484', '886,470','1070,354','1070,316'],
    ['理疗室', '阁楼阳台', '储物室']
  ),
  
  // 房间2: 理疗室
  createRoomFragment(
    'attic_therapy',
    '理疗室',
    'attic',
    ['841,278', '1017,340', '838,454', '652,387'],
    ['阁楼']
  ),
  
  // 房间3: 阁楼阳台
  createRoomFragment(
    'attic_balcony',
    '阁楼阳台',
    'attic',
    ['1409,208', '1758,336', '1276,678', '895,545', '907,536', '1200,638', '1579,376', '1579,356', '1322,265'],
    ['阁楼','北花园','东花园','南花园']
  ),
  
  // 房间4: 储物室
  createRoomFragment(
    'second_storage',
    '储物室',
    'second',
    ['679,629', '518,715', '874,837', '954,790','903,775','903,703'],
    ['阁楼', '二楼走廊', '第二案发现场']
  ),
  
  // 房间5: 中控室
  createRoomFragment(
    'second_control',
    '中控室',
    'second',
    ['223,865', '458,744', '566,779', '352,905'],
    ['二楼走廊','工具间']
  ),
  
  // 房间6: 工具间
  createRoomFragment(
    'second_tool',
    '工具间',
    'second',
    ['390,922', '528,966', '612,911', '479,870'],
    ['二楼走廊','中控室']
  ),
  
  // 房间7: 二楼走廊
  createRoomFragment(
    'second_corridor',
    '二楼走廊',
    'second',
    ['527,844', '607,797', '1108,965', '1028,1013'],
    ['储物室', '中控室', '工具间', '第二案发现场', '客房B', '二楼大厅']
  ),
  
  // 房间8: 客房B
  createRoomFragment(
    'second_bedroom_b',
    '客房B',
    'second',
    ['664,933', '982,1036', '902,1090', '579,984'],
    ['二楼走廊']
  ),
  
  // 房间9: 二楼大厅
  createRoomFragment(
    'second_hall',
    '二楼大厅',
    'second',
    ['945,1109', '1164,1182', '1225,1142', '1303,1170','1435,1077','1139,980'],
    ['二楼走廊', '第二案发现场', '客房A', '一楼大厅']
  ),
  
  // 房间10: 第二案发现场
  createRoomFragment(
    'second_crime',
    '第二案发现场',
    'second',
    ['922,852', '1080,760', '1450,882', '1279,980'],
    ['储物室', '二楼走廊', '二楼大厅', '二楼阳台北侧', '客房A'],
    { isCrimeScene: true }
  ),
  
  // 房间11: 二楼阳台北侧
  createRoomFragment(
    'second_balcony_north',
    '二楼阳台北侧',
    'second',
    ['1407,833', '1482,778', '1900,920', '1832,974'],
    ['第二案发现场', '二楼阳台','北花园']
  ),
  
  // 房间12: 客房A
  createRoomFragment(
    'second_bedroom_a',
    '客房A',
    'second',
    ['1333,996', '1487,892', '1652,948', '1522,1037', '1502,1031', '1479,1046'],
    ['第二案发现场', '二楼阳台', '二楼大厅']
  ),
  
  // 房间13: 二楼阳台
  createRoomFragment(
    'second_balcony',
    '二楼阳台',
    'second',
    ['1565,1053', '1678,1093', '1796,1000', '1693,967'],
    ['二楼阳台北侧', '客房A','东花园']
  ),
  
  // 房间14: 北花园
  createRoomFragment(
    'first_garden_north',
    '北花园',
    'first',
    ['762,1243', '861,1176', '1368,1346','1368,1417','1457,1448','1522,1404','1755,1473','1673,1559'],
    ['东花园', '地下室北走廊']
  ),
  
  // 房间15: 东花园
  createRoomFragment(
    'first_garden_east',
    '东花园',
    'first',
    ['1848,1489', '1962,1528', '1962,1646', '1491,1992', '1253,1910'],
    ['北花园', '一楼大厅', '南花园']
  ),
  
  // 房间16: 南花园
  createRoomFragment(
    'first_garden_south',
    '南花园',
    'first',
    ['245,1591', '200,1622', '200,1687', '1372,2074', '1470,2010'],
    ['东花园', '第一案发现场']
  ),
  
  // 房间17: 餐厅
  createRoomFragment(
    'first_dining',
    '餐厅',
    'first',
    ['329,1546', '481,1597', '862,1348', '795,1325','729,1368','643,1339'],
    ['地下室南走廊', '第一案发现场', '一楼走廊']
  ),
  
  // 房间18: 第一案发现场
  createRoomFragment(
    'first_crime',
    '第一案发现场',
    'first',
    ['524,1610', '626,1547', '952,1660', '889,1706','890,1716','866,1734'],
    ['一楼走廊', '一楼大厅', '餐厅', '南花园'],
    { isCrimeScene: true }
  ),
  
  // 房间19: 一楼走廊
  createRoomFragment(
    'first_corridor',
    '一楼走廊',
    'first',
    ['669,1519', '723,1482', '1061,1596', '1005,1633'],
    ['起居室B', '一楼大厅', '餐厅', '第一案发现场']
  ),
  
  // 房间20: 起居室B
  createRoomFragment(
    'first_living_b',
    '起居室B',
    'first',
    ['767,1452', '902,1365', '1228,1474','1215,1481','1210,1478', '1090,1561'],
    ['一楼走廊', '起居室A']
  ),
  
  // 房间21: 起居室A
  createRoomFragment(
    'first_living_a',
    '起居室A',
    'first',
    ['1271,1487', '1435,1544', '1358,1593', '1219,1543','1221,1532','1211,1528'],
    ['起居室B', '一楼大厅','衣帽间']
  ),
  
  // 房间22: 衣帽间
  createRoomFragment(
    'first_cloakroom',
    '衣帽间',
    'first',
    ['1401,1609', '1475,1557', '1593,1597', '1520,1649'],
    ['起居室A']
  ),
  
  // 房间23: 一楼大厅
  createRoomFragment(
    'first_hall',
    '一楼大厅',
    'first',
    ['908,1747','1161,1565', '1485,1674', '1300,1812', '1300,1795','1210,1764','1195,1773','1195,1786','1181,1795','1178,1809','1158,1833'],
    ['二楼大厅', '一楼走廊', '第一案发现场', '起居室A', '东花园']
  ),
  
  // 房间24: 地下室北走廊
  createRoomFragment(
    'basement_north',
    '地下室北走廊',
    'basement',
    ['994,2138', '1285,2237', '1286,2242', '1380,2273','1435,2233','1436,2236','1381,2219','1381,2156','1116,2062'],
    ['北花园', '地下室南走廊']
  ),
  
  // 房间25: 地下室南走廊
  createRoomFragment(
    'basement_south',
    '地下室南走廊',
    'basement',
    ['591,2127', '1275,2365', '1361,2307', '780,2105','707,2149','619,2115'],
    ['地下室北走廊', '餐厅','杂物间']
  ),
  
  // 房间26: 杂物间
  createRoomFragment(
    'basement_storage',
    '杂物间',
    'basement',
    ['1318,2380', '1403,2324', '1564,2379', '1474,2434'],
    ['地下室南走廊']
  ),
];

// 验证所有房间ID唯一
const ids = roomFragments.map(r => r.id);
const uniqueIds = new Set(ids);
if (ids.length !== uniqueIds.size) {
  console.error('房间ID重复!', ids);
  throw new Error('房间ID重复');
}

// 验证相邻房间都存在
roomFragments.forEach(room => {
  room.connections.forEach(connId => {
    if (!ids.includes(connId)) {
      console.warn(`房间 ${room.name} 的相邻房间 ${connId} 不存在`);
    }
  });
});

export default roomFragments;