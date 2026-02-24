import type { RoleConfig, Role } from '@/types/game';

// 角色配置
export const roleConfigs: RoleConfig[] = [
  {
    role: 'killer',
    name: '凶手',
    description: '凶手阵营的核心角色，可以攻击其他玩家并编造虚假行动线',
    camp: 'killer',
    initialScore: 1,
    skillName: '攻击、编造行动线',
    skillDescription: '凶手会自动攻击与其行动线重叠的其他玩家（包括同阵营玩家），每轮每人最多受到1点攻击伤害。凶手可在整局游戏中编造两次虚假的行动线。若凶手编造了虚假行动线，则行动线重叠的公示、荧光粉的公示、侦探获取的行动线都将采用这条虚假行动线，但攻击伤害依旧按照真实行动线结算。',
    maxUses: 2
  },
  {
    role: 'accomplice',
    name: '帮凶',
    description: '凶手的帮手，可以攻击其他玩家并在特定轮次放火',
    camp: 'killer',
    initialScore: 1,
    skillName: '攻击、放火',
    skillDescription: '帮凶可任选一轮，攻击与其行动线重叠的其他玩家（包括同阵营玩家），每轮每人最多受到1点攻击伤害。帮凶在第二、四轮中，每轮可选择1个地点放火，无需本人在该地点（3个花园和2个大厅无法放火），该地点会在下一轮开始着火，经过或停留在着火点的玩家会受到1点伤害（初始从着火点离开不会受伤，每轮每人最多受到1点着火伤害）。',
    maxUses: 2
  },
  {
    role: 'detective',
    name: '侦探',
    description: '侦探阵营的核心角色，可以获取其他玩家的行动线',
    camp: 'detective',
    initialScore: 2,
    skillName: '获取行动线',
    skillDescription: '从第三轮开始，侦探每轮可选择1名玩家，获取其上一轮的完整行动线。',
    maxUses: 999
  },
  {
    role: 'engineer',
    name: '工程师',
    description: '可以修复电路使楼层亮灯，亮灯地点会公示重叠的行动线',
    camp: 'detective',
    initialScore: 1,
    skillName: '供电',
    skillDescription: '受暴风雪影响，山庄电力中断。每轮行动结束后，工程师可选择修复其当前所在楼层的电路（第一轮只能修复地下室或阁楼），使其在下一轮亮灯。结算阶段只会公示所有亮灯地点的重叠行动线。',
    maxUses: 999
  },
  {
    role: 'hacker',
    name: '黑客',
    description: '可以入侵中控室电脑查看玩家分数',
    camp: 'detective',
    initialScore: 1,
    skillName: '入侵电脑',
    skillDescription: '每轮行动阶段，黑客可入侵中控室电脑查看任意一名玩家上一轮的结算后的总分（包括自己），若选择查看其他玩家的分数，则后续轮次将不能再使用该技能。',
    maxUses: 1
  },
  {
    role: 'doctor',
    name: '医生',
    description: '两名医生行动线重叠时可以互相治疗',
    camp: 'detective',
    initialScore: 1,
    skillName: '治疗',
    skillDescription: '若两名医生在同一轮的行动线有重叠，无论重叠几次，则当轮结算阶段两人各恢复1点生命值。',
    maxUses: 999
  },
  {
    role: 'fan',
    name: '推理迷',
    description: '可以查验其他玩家身份，查验后可加入对应阵营',
    camp: 'neutral',
    initialScore: 0,
    skillName: '查验身份',
    skillDescription: '推理迷有时会被侦探的睿智吸引，有时也会折服于凶手的诡计。从第三轮开始，推理迷在个人行动结束后，可选择一位玩家确认其身份是侦探或凶手。若为侦探，则推理迷加入侦探阵营，成为好推理迷；若为凶手，则推理迷加入凶手阵营，成为坏推理迷；若既非侦探也非凶手，则无法获知其具体身份，推理迷暂时没有阵营，下一轮可继续使用该技能。推理迷在加入阵营后，需立即选择一个新技能，从下一轮开始使用。',
    maxUses: 999
  },
  {
    role: 'good_fan',
    name: '好推理迷',
    description: '已加入侦探阵营的推理迷',
    camp: 'detective',
    initialScore: 2,
    skillName: '获取行动线、投凶',
    skillDescription: '好推理迷可在"获取行动线"及"投凶"两个技能中任选其一。获取行动线：每轮可获取一名玩家在上一轮的行动线。投凶：每轮可在行动结束后投凶，且初始拥有2分。',
    maxUses: 999
  },
  {
    role: 'bad_fan',
    name: '坏推理迷',
    description: '已加入凶手阵营的推理迷',
    camp: 'killer',
    initialScore: 1,
    skillName: '攻击+编造行动线、投凶',
    skillDescription: '坏推理迷可在"1次攻击+编造1次行动线"及"投凶"两个技能中任选其一。1次攻击+编造1次行动线：可分两轮使用，也可在同一轮使用。投凶：每轮可在行动结束后投凶，且初始拥有1分。',
    maxUses: 999
  }
];

// 获取角色配置
export function getRoleConfig(role: Role): RoleConfig | undefined {
  return roleConfigs.find(config => config.role === role);
}

// 获取角色名称
export function getRoleName(role: Role): string {
  const config = getRoleConfig(role);
  return config?.name || role;
}

// 获取角色描述
export function getRoleDescription(role: Role): string {
  const config = getRoleConfig(role);
  return config?.description || '';
}

// 获取角色技能描述
export function getRoleSkillDescription(role: Role): string {
  const config = getRoleConfig(role);
  return config?.skillDescription || '';
}

// 获取阵营颜色
export function getCampColor(camp: string): string {
  switch (camp) {
    case 'killer':
      return '#c9302c'; // 红色
    case 'detective':
      return '#5bc0de'; // 蓝色
    default:
      return '#aaaaaa'; // 灰色
  }
}

// 获取角色图标
export function getRoleIcon(role: Role): string {
  switch (role) {
    case 'killer':
      return '🔪';
    case 'accomplice':
      return '🎭';
    case 'detective':
      return '🔍';
    case 'engineer':
      return '⚙️';
    case 'hacker':
      return '💻';
    case 'doctor':
      return '💉';
    case 'fan':
      return '🧠';
    case 'good_fan':
      return '🧠✨';
    case 'bad_fan':
      return '🧠🔪';
    default:
      return '👤';
  }
}

// 默认角色分配（10人局）
export const defaultRoleDistribution: Role[] = [
  'killer',      // 1个凶手
  'accomplice',  // 2个帮凶
  'accomplice',
  'detective',   // 1个侦探
  'engineer',    // 1个工程师
  'hacker',      // 2个黑客
  'hacker',
  'doctor',      // 2个医生
  'doctor',
  'fan'          // 1个推理迷
];

// 获取凶手阵营角色
export function getKillerRoles(): Role[] {
  return ['killer', 'accomplice', 'bad_fan'];
}

// 获取侦探阵营角色
export function getDetectiveRoles(): Role[] {
  return ['detective', 'engineer', 'hacker', 'doctor', 'good_fan'];
}

// 检查角色是否可以投凶
export function canVote(role: Role): boolean {
  return role !== 'fan' && role !== 'accomplice';
}

// 检查角色是否可以攻击
export function canAttack(role: Role): boolean {
  return ['killer', 'accomplice', 'bad_fan'].includes(role);
}
