// server/websocket-server.js
/**
 * 暴风雪山庄游戏系统 - WebSocket服务器
 */

const WebSocket = require('ws');
const http = require('http');

// 历史数据存储（按房间）
const roomHistories = new Map(); // roomCode -> Array<RoundHistory>

// 保存轮次历史
function saveRoundHistory(room) {
  if (!roomHistories.has(room.code)) {
    roomHistories.set(room.code, []);
  }
  
  const histories = roomHistories.get(room.code);
  const existingIndex = histories.findIndex(h => h.round === room.gameState.round);
  
  const history = {
    round: room.gameState.round,
    phase: room.gameState.phase,
    players: JSON.parse(JSON.stringify(room.gameState.players.map(p => {
      // 移除ws引用
      const { ws, ...playerData } = p;
      return playerData;
    }))),
    fireLocations: [...room.gameState.fireLocations],
    lightLocations: [...room.gameState.lightLocations],
    votes: { ...room.gameState.votes },
    powderTarget: room.gameState.powderTarget,
    timestamp: Date.now()
  };
  
  if (existingIndex >= 0) {
    histories[existingIndex] = history;
  } else {
    histories.push(history);
  }
  
  // 同时保存到房间对象中，方便获取
  room.gameState.roundHistories = histories;
}

// ============================================================
// 【房间功能配置】
// ============================================================
const roomFeatures = [
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

// 跳楼配置
const jumpRooms = {
  'second_balcony_north': {
    targets: ['first_garden_north', 'first_garden_east'],
    healthCost: 1,
    actionCost: 1,
    minHealth: 2
  },
  'attic_balcony': {
    targets: ['first_garden_north', 'first_garden_east', 'first_garden_south'],
    healthCost: 2,
    actionCost: 1,
    minHealth: 3
  }
};

// 绳索反向移动配置
const ropeReverseRoutes = {
  'first_garden_east': ['second_balcony'],
  'first_garden_north': ['second_balcony_north']
};

// 花园列表
const gardenRooms = ['first_garden_north', 'first_garden_east', 'first_garden_south'];

// 可放火地点（排除大厅和花园）
const fireableLocations = [
  'attic_main', 'attic_therapy', 'attic_balcony',
  'second_storage', 'second_control', 'second_tool', 'second_corridor',
  'second_bedroom_b', 'second_bedroom_a', 'second_crime', 'second_balcony_north', 'second_balcony',
  'first_dining', 'first_crime', 'first_corridor', 'first_living_b', 'first_living_a', 'first_cloakroom',
  'basement_north', 'basement_south', 'basement_storage'
];

// 道具使用消耗
const ITEM_USE_COST = 1;

// 配置
const PORT = 8080;
const HEARTBEAT_INTERVAL = 30000;

// 全局状态
const rooms = new Map();
const connections = new Map();
const hostTokens = new Map();

// 工具函数
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
}

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function createRoom(hostId, hostPlayerId) {
  const roomCode = generateRoomCode();
  const room = {
    code: roomCode,
    hostId: hostPlayerId,
    hostToken: hostId,
    gameState: {
      id: generateId(),
      roomCode: roomCode,
      round: 1,
      phase: 'config',
      players: [],
      fireLocations: [],
      lightLocations: [],
      powderTarget: null,
      detectiveTarget: null,
      votes: {},
      tradeRequests: [],
      voteRecords: [],
      skillRecords: [],
      hackerChecks: new Map(),
      fanTransformed: false,
      settings: {
        allowRoleReveal: false,
        timeLimit: 0
      },
      roundHistories: []
    },
    clients: new Set(),
    hostConnections: new Set(),
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  rooms.set(roomCode, room);
  hostTokens.set(hostPlayerId, roomCode);
  return room;
}

// 修复 joinRoom 函数
// 修改：增加游戏开始后的顶替功能
function joinRoom(roomCode, ws, isReconnect = false, existingPlayerId = null, isReplace = false, replaceTargetId = null) {
  const room = rooms.get(roomCode);
  if (!room) return { error: '房间不存在', errorCode: 'ROOM_NOT_FOUND' };
  
  room.lastActivity = Date.now();
  
  // 游戏已开始的情况处理
  if (room.gameState.phase !== 'config' && room.gameState.phase !== 'lobby' && !isReconnect) {
    // 如果不是顶替请求，返回错误
    if (!isReplace) {
      return { error: '游戏已开始，无法加入', errorCode: 'GAME_ALREADY_STARTED', canReplace: true };
    }
    
    // 顶替功能：新玩家顶替现有玩家
    if (isReplace && replaceTargetId) {
      const targetPlayer = room.gameState.players.find(p => p.id === replaceTargetId);
      if (!targetPlayer) {
        return { error: '要顶替的玩家不存在', errorCode: 'TARGET_NOT_FOUND' };
      }
      
      // 创建新玩家，继承被顶替玩家的所有状态
      const newPlayerId = generateId();
      const newPlayer = {
        ...targetPlayer,
        id: newPlayerId,
        ws: ws,
        joinedAt: Date.now()
      };
      
      // 替换原玩家
      const playerIndex = room.gameState.players.findIndex(p => p.id === replaceTargetId);
      if (playerIndex !== -1) {
        // 保留原玩家的WebSocket连接（如果存在）用于通知
        const oldPlayer = room.gameState.players[playerIndex];
        if (oldPlayer.ws && oldPlayer.ws.readyState === WebSocket.OPEN) {
          sendToPlayer(oldPlayer.ws, {
            type: 'REPLACED',
            message: '你已被新玩家顶替',
            newPlayerId: newPlayerId
          });
          oldPlayer.ws.close();
        }
        
        room.gameState.players[playerIndex] = newPlayer;
        room.clients.add(ws);
        
        console.log(`[顶替] 新玩家顶替了 ${targetPlayer.name}，继承其位置、血量、道具、分数`);
        
        return { 
          player: newPlayer, 
          isReconnect: false, 
          isReplace: true,
          replacedPlayerName: targetPlayer.name 
        };
      }
    }
    
    return { error: '游戏已开始，无法加入', errorCode: 'GAME_ALREADY_STARTED' };
  }
  
  if (room.gameState.players.length >= 10 && !isReconnect) {
    return { error: '房间已满', errorCode: 'ROOM_FULL' };
  }
  
  // 重连逻辑
  if (isReconnect && existingPlayerId) {
    const existingPlayer = room.gameState.players.find(p => p.id === existingPlayerId);
    if (existingPlayer) {
      // 修复：确保清理旧的 WebSocket 引用
      if (existingPlayer.ws && existingPlayer.ws !== ws) {
        try {
          existingPlayer.ws.terminate();
        } catch(e) {}
      }
      existingPlayer.ws = ws;
      room.clients.add(ws);
      return { player: existingPlayer, isReconnect: true };
    }
  }
  
  // 创建新玩家
  const playerId = generateId();
  
  // 关键修复：基于当前实际玩家数量计算编号，并确保唯一性
  const existingNumbers = new Set(room.gameState.players.map(p => p.number).filter(n => n > 0));
  let playerNumber = 1;
  while (existingNumbers.has(playerNumber)) {
    playerNumber++;
  }
  
  const playerName = `${playerNumber}号玩家`;
  
  const player = {
    id: playerId,
    name: playerName,
    number: playerNumber,  // 确保 number 字段被正确设置
    role: 'fan',
    camp: 'neutral',
    health: 3,
    maxHealth: 3,
    actionPoints: 8,
    currentLocation: '',
    locationId: '',
    actionLine: [],
    items: [],
    score: 0,
    isAlive: true,
    isExposed: false,
    visitedLocations: [],
    canUseSkill: true,
    skillUsedThisRound: false,
    fakeActionLineCount: 2,
    fireCount: 0,
    hasCheckedFan: false,
    totalVotesCorrect: 0,
    hasCheckedOthersScore: false,
    transformedRole: null,
    isFan: true,
    skillUseCount: 0,
    fanChoiceRound: null,
    fanTargetId: null,
    fanTargetRole: null,
    fanSkillChoice: null,
    canVote: false,
    // 虚弱状态相关字段
    isWeakened: false,
    itemsObtainedThisRound: [],
    ws: ws,
    joinedAt: Date.now()
  };
  
  room.gameState.players.push(player);
  room.clients.add(ws);
  
  console.log(`[joinRoom] 新玩家创建: id=${playerId}, name=${playerName}, number=${playerNumber}, 当前总玩家数=${room.gameState.players.length}`);
  
  return { player: player, isReconnect: false };
}

function setPlayerRole(room, playerId, role) {
  const player = room.gameState.players.find(p => p.id === playerId);
  if (!player) return false;
  
  player.role = role;
  
  // 设置阵营
  const killerRoles = ['killer', 'murderer', 'bad_fan'];
  const detectiveRoles = ['detective', 'engineer', 'hacker', 'doctor', 'good_fan'];
  
  if (killerRoles.includes(role)) {
    player.camp = 'killer';
    player.score = role === 'killer' ? 2 : 1;
  } else if (detectiveRoles.includes(role)) {
    player.camp = 'detective';
    player.score = role === 'detective' ? 2 : 1;
  } else if (role === 'fan') {
    player.camp = 'neutral';
    player.score = 0;
    player.isFan = true;
  } else {
    player.camp = 'neutral';
    player.score = 0;
  }
  
  // 特殊初始化
  if (role === 'killer' || role === 'murderer') {
    player.fakeActionLineCount = 2;
  } else if (role === 'accomplice') {
    player.skillUseCount = 0;
  } else if (role === 'fan') {
    player.isFan = true;
  }
  
  return true;
}

function broadcast(room, message, exclude) {
  const data = JSON.stringify(message);
  room.clients.forEach(client => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function sendToPlayer(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function getSanitizedGameState(room, requesterId) {
  const state = JSON.parse(JSON.stringify(room.gameState));
  const isHost = requesterId === room.hostId;
  
  // 关键修复：确保 players 数组存在且包含所有玩家
  if (!state.players) {
    state.players = [];
  }
  
  // 关键修复：如果 requesterId 为空，尝试从房间中找到对应的玩家
  let effectiveRequesterId = requesterId;
  if (!effectiveRequesterId && room.gameState.players.length > 0) {
    // 尝试找到最近活跃的玩家作为备选
    console.log('[getSanitizedGameState] requesterId 为空，尝试匹配');
  }
  
  state.players = state.players.map(p => {
    // 创建副本，移除 ws 引用
    const playerData = { ...p };
    delete playerData.ws;
    
    // 关键修复：增强 isSelf 判断，处理可能的 ID 不匹配情况
    const isSelf = p.id === effectiveRequesterId;
    const isOwnData = isHost || isSelf;
    
    if (isOwnData) {
      // 主机和自己可以看到完整信息
      // 关键修复：确保 role 字段不为空
      if (!playerData.role || playerData.role === 'unknown') {
        // 尝试从原始玩家数据恢复 role
        const originalPlayer = room.gameState.players.find(op => op.id === p.id);
        if (originalPlayer && originalPlayer.role && originalPlayer.role !== 'unknown') {
          playerData.role = originalPlayer.role;
          playerData.camp = originalPlayer.camp;
        }
      }
      return playerData;
    } else {
      // 对其他玩家隐藏敏感信息
      return {
        id: p.id,
        name: p.name,
        number: p.number || 0,
        role: 'unknown',
        camp: 'unknown',
        health: p.health,
        maxHealth: p.maxHealth,
        isAlive: p.isAlive,
        score: p.score,
        currentLocation: p.currentLocation || '',
        actionPoints: p.actionPoints,
        items: [], // 隐藏道具
        actionLine: [], // 隐藏行动线
        visitedLocations: p.visitedLocations || [],
        isExposed: p.isExposed,
        skillUsedThisRound: p.skillUsedThisRound,
        canVote: p.canVote || false,
        isWeakened: p.isWeakened || false
      };
    }
  });
  
  // 关键修复：添加 hostId 到状态，帮助客户端识别
  state.hostId = room.hostId;
  
  return state;
}

function resetRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return false;
  
  broadcast(room, {
    type: 'ROOM_RESET',
    message: '房间已重置',
    roomCode: roomCode
  });
  
  room.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1000, '房间已重置');
    }
  });
  
  rooms.delete(roomCode);
  
  for (let [hostId, code] of hostTokens.entries()) {
    if (code === roomCode) {
      hostTokens.delete(hostId);
    }
  }
  
  return true;
}

function isHost(room, ws, hostPlayerId = null) {
  console.log(`[isHost] 验证:`, {
    providedHostId: hostPlayerId?.slice(0, 8),
    roomHostId: room.hostId?.slice(0, 8),
    hasHostConnections: !!room.hostConnections,
    inHostConnections: room.hostConnections?.has(ws)
  });
  
  // 优先通过 hostPlayerId 验证（更可靠）
  if (hostPlayerId && room.hostId === hostPlayerId) {
    console.log(`[isHost] 通过 hostPlayerId 验证成功`);
    return true;
  }
  
  // 其次通过 WebSocket 连接验证
  if (room.hostConnections && room.hostConnections.has(ws)) {
    console.log(`[isHost] 通过 hostConnections 验证成功`);
    return true;
  }
  
  // 关键修复：如果 WebSocket 在 room.clients 中且 hostId 匹配，也视为主持人
  if (room.clients && room.clients.has(ws) && hostPlayerId && room.hostId === hostPlayerId) {
    console.log(`[isHost] 通过 clients + hostId 验证成功`);
    return true;
  }
  
  console.log(`[isHost] 验证失败`);
  return false;
}

function checkJumpMove(from, to) {
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

function getRoomFeature(roomId) {
  return roomFeatures.find(f => f.roomId === roomId);
}

function isRopeReverseMove(from, to, hasRope) {
  if (!hasRope) return null;
  const targets = ropeReverseRoutes[from];
  if (targets && targets.includes(to)) {
    return {
      isRopeReverse: true,
      actionCost: 0,
      consumeRope: true,
      healthCost: 0
    };
  }
  return null;
}

function isGarden(roomId) {
  return gardenRooms.includes(roomId);
}

function calculateMoveCost(from, to, hasSki) {
  const fromIsGarden = isGarden(from);
  const toIsGarden = isGarden(to);
  
  // 关键修复：花园到室内固定1点，不受滑雪套装影响
  if (fromIsGarden && !toIsGarden) {
    return 1;
  }
  
  // 室内到花园
  if (!fromIsGarden && toIsGarden) {
    return hasSki ? 1 : 2;
  }
  
  // 花园到花园
  if (fromIsGarden && toIsGarden) {
    return hasSki ? 1 : 2;
  }
  
  // 室内到室内
  return 1;
}

// ============================================================
// 【结算阶段处理 - 关键修复】
// ============================================================

function processSettlement(room) {
  const state = room.gameState;
  const healthChanges = [];
  const attackDamage = [];
  const healEffects = [];
  const fireDamage = [];
  
  // 记录已经受到伤害的玩家（每轮每人最多受到1次攻击伤害和1次着火伤害）
  const damagedByAttack = new Set();  // 受到攻击伤害的玩家
  const damagedByFire = new Set();    // 受到着火伤害的玩家
  
  // 1. 处理攻击（凶手和帮凶）
  const killers = state.players.filter(p => 
    (p.role === 'killer' || p.role === 'murderer' || p.role === 'accomplice' || p.role === 'bad_fan') && 
    p.isAlive &&
    !p.isWeakened && // 虚弱状态玩家不能攻击
    p.health > 0
  );
  
  killers.forEach(killer => {
    // 获取行动线（优先使用假行动线用于公示，但攻击伤害按真实行动线）
    const realActionLine = killer.actionLine || [];
    
    // 攻击使用真实行动线计算
    const actionLineForAttack = realActionLine;
    
    state.players.forEach(target => {
      // 不能攻击自己、已死亡、虚弱状态的玩家
      if (target.id === killer.id || !target.isAlive || target.isWeakened || target.health === 0) return;
      
      // 检查同一行动在同一地点的重叠
      const hasOverlap = actionLineForAttack.some(kStep => 
        target.actionLine.some(tStep => 
          tStep.step === kStep.step && tStep.locationId === kStep.locationId
        )
      );
      
      if (hasOverlap) {
        // 检查目标本轮是否已经受到过攻击伤害
        if (!damagedByAttack.has(target.id)) {
          // 虚弱状态玩家不受伤害
          if (!target.isWeakened && target.health > 0) {
            target.health = Math.max(0, target.health - 1);
            if (target.health === 0) {
              target.isAlive = false;
              target.isWeakened = true;
              target.score = 0; // 个人累积的分数全部失效
            }
            
            damagedByAttack.add(target.id);
            attackDamage.push({
              playerId: target.id,
              attackerId: killer.id,
              damage: 1
            });
            
            healthChanges.push({
              playerId: target.id,
              change: -1,
              reason: `被${killer.name}攻击`
            });
          }
        }
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
          p.health = Math.max(0, p.health - 1);
          if (p.health === 0) {
            p.isAlive = false;
            p.isWeakened = true;
            p.score = 0; // 个人累积的分数全部失效
          }
          
          damagedByFire.add(p.id);
          fireDamage.push({
            playerId: p.id,
            locationId: locId
          });
          
          healthChanges.push({
            playerId: p.id,
            change: -1,
            reason: '着火伤害'
          });
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
        
        // 检查行动线是否有重叠（无论重叠几次都只恢复1点）
        const hasOverlap = doc1.actionLine.some(s1 => 
          doc2.actionLine.some(s2 => s2.locationId === s1.locationId)
        );
        
        if (hasOverlap) {
          // 医生1恢复生命（虚弱状态玩家不能恢复）
          if (doc1.health < doc1.maxHealth && doc1.health > 0 && !doc1.isWeakened) {
            doc1.health = Math.min(doc1.health + 1, doc1.maxHealth);
            healEffects.push({ playerId: doc1.id, healerId: doc2.id });
            healthChanges.push({
              playerId: doc1.id,
              change: 1,
              reason: '医生治疗'
            });
          }
          
          // 医生2恢复生命（虚弱状态玩家不能恢复）
          if (doc2.health < doc2.maxHealth && doc2.health > 0 && !doc2.isWeakened) {
            doc2.health = Math.min(doc2.health + 1, doc2.maxHealth);
            healEffects.push({ playerId: doc2.id, healerId: doc1.id });
            healthChanges.push({
              playerId: doc2.id,
              change: 1,
              reason: '医生治疗'
            });
          }
        }
      }
    }
  }
  
  return {
    healthChanges,
    attackDamage,
    healEffects,
    fireDamage,
    damagedPlayers: [...damagedByAttack, ...damagedByFire],
    eliminatedPlayers: state.players.filter(p => !p.isAlive && p.health === 0)
  };
}

// WebSocket服务器
const server = http.createServer();
const wss = new WebSocket.Server({ server });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║       暴风雪山庄游戏系统 - WebSocket服务器 v6.2           ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  服务器地址: ws://${getLocalIP()}:${PORT}              ║`);
  console.log(`║  HTTP地址: http://${getLocalIP()}:${PORT}              ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log('');
  console.log('等待连接...');
});

wss.on('connection', (ws, req) => {
  const clientId = generateId();
  let currentRoom = null;
  let currentPlayerId = null;
  let currentHostId = null;
  
  ws.isAlive = true;
  
  console.log(`[连接] 新客户端连接: ${clientId} (${req.socket.remoteAddress})`);
  
  sendToPlayer(ws, {
    type: 'CONNECTED',
    clientId: clientId,
    message: '已连接到服务器',
    serverRestarted: true
  });
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[消息] ${clientId}: ${message.type}`);
      
      switch (message.type) {
        case 'CREATE_ROOM': {
          const hostPlayerId = generateId();
          currentHostId = hostPlayerId;
          const room = createRoom(clientId, hostPlayerId);
          currentRoom = room;
          currentPlayerId = hostPlayerId;
          
          room.hostConnections.add(ws);
          room.clients.add(ws);
          
          sendToPlayer(ws, {
            type: 'ROOM_CREATED',
            roomCode: room.code,
            isHost: true,
            hostPlayerId: hostPlayerId,
            gameState: getSanitizedGameState(room, hostPlayerId)
          });
          
          console.log(`[房间] 创建成功: ${room.code}, 主持人ID: ${hostPlayerId}`);
          break;
        }
        
        case 'RECONNECT_HOST': {
          const { roomCode, hostPlayerId } = message;
          
          console.log(`[重连请求] 房间: ${roomCode}, 主持人ID: ${hostPlayerId}`);
          
          if (!roomCode || !hostPlayerId) {
            console.log('[重连失败] 信息不完整');
            sendToPlayer(ws, {
              type: 'ERROR',
              message: '重连信息不完整',
              errorCode: 'INVALID_RECONNECT'
            });
            break;
          }
          
          const room = rooms.get(roomCode);
          
          if (!room) {
            console.log(`[重连失败] 房间不存在: ${roomCode}`);
            sendToPlayer(ws, {
              type: 'ERROR',
              message: '房间不存在或已过期，请创建新房间',
              errorCode: 'HOST_EXPIRED',
              shouldReset: true
            });
            break;
          }
          
          // 验证主持人身份
          if (room.hostId !== hostPlayerId) {
            console.log(`[重连失败] 身份验证失败: ${hostPlayerId} !== ${room.hostId}`);
            sendToPlayer(ws, {
              type: 'ERROR',
              message: '主持人身份验证失败',
              errorCode: 'HOST_AUTH_FAILED',
              shouldReset: true
            });
            break;
          }
          
          console.log(`[重连成功] 主持人验证通过，更新连接信息`);
          
          // 更新连接信息
          currentRoom = room;
          currentPlayerId = hostPlayerId;
          currentHostId = hostPlayerId;
          
          room.hostConnections.add(ws);
          room.clients.add(ws);
          connections.set(clientId, { ws, room, playerId: hostPlayerId, isHost: true });
          
          // 恢复主持人状态
          const hostPlayer = room.gameState.players.find(p => p.id === hostPlayerId);
          if (hostPlayer) {
            hostPlayer.ws = ws;
            console.log(`[重连] 恢复主持人玩家状态: ${hostPlayer.name}`);
          }
          
          // 发送重连成功消息，包含完整游戏状态和历史数据
          const gameState = getSanitizedGameState(room, hostPlayerId);
          
          sendToPlayer(ws, {
            type: 'RECONNECT_HOST_SUCCESS',
            roomCode: room.code,
            hostPlayerId: hostPlayerId,
            isHost: true,
            isReconnected: true,
            gameState: gameState,
            roundHistories: room.gameState.roundHistories || []
          });
          
          // 广播通知其他玩家
          broadcast(room, {
            type: 'NOTIFICATION',
            message: '主持人重新连接',
            notificationType: 'info'
          }, ws);
          
          // 同时发送 GAME_STATE 更新给所有客户端
          broadcast(room, {
            type: 'GAME_STATE',
            state: gameState,
            message: '主持人重新连接，游戏状态已同步'
          });
          
          console.log(`[重连] 主持人成功重连到房间 ${room.code}，当前阶段: ${room.gameState.phase}, 轮次: ${room.gameState.round}`);
          break;
        }
        
        // server/websocket-server.js - 修复 JOIN_ROOM 部分
        case 'JOIN_ROOM': {
          console.log(`[JOIN_ROOM] 收到加入房间请求:`, message);
          const room = rooms.get(message.roomCode);
          
          if (!room) {
            console.log(`[错误] 房间不存在: ${message.roomCode}`);
            sendToPlayer(ws, {
              type: 'ERROR',
              message: '房间不存在，请检查房间码或重新创建房间',
              errorCode: 'ROOM_NOT_FOUND',
              shouldReset: true
            });
            break;
          }
          
          // 主持人重连逻辑
          if (message.hostPlayerId && room.hostId === message.hostPlayerId) {
            console.log(`[重连] 主持人通过 hostPlayerId 重新连接`);
            currentRoom = room;
            currentPlayerId = message.hostPlayerId;
            currentHostId = message.hostPlayerId;
            
            room.hostConnections.add(ws);
            room.clients.add(ws);
            
            sendToPlayer(ws, {
              type: 'ROOM_JOINED',
              roomCode: room.code,
              playerId: message.hostPlayerId,
              isHost: true,
              isReconnected: true,
              gameState: getSanitizedGameState(room, message.hostPlayerId)
            });
            
            broadcast(room, {
              type: 'NOTIFICATION',
              message: '主持人重新连接',
              notificationType: 'info'
            }, ws);
            break;
          }
          
          // 玩家重连逻辑
          let player = null;
          if (message.playerId) {
            const existingPlayer = room.gameState.players.find(p => p.id === message.playerId);
            if (existingPlayer) {
              console.log(`[重连] 玩家 ${existingPlayer.name} (${message.playerId}) 重新连接`);
              
              existingPlayer.ws = ws;
              room.clients.add(ws);
              
              currentRoom = room;
              currentPlayerId = existingPlayer.id;
              
              sendToPlayer(ws, {
                type: 'ROOM_JOINED',
                roomCode: room.code,
                playerId: existingPlayer.id,
                playerName: existingPlayer.name,
                isReconnected: true,
                gameState: getSanitizedGameState(room, existingPlayer.id)
              });
              
              // 修复：广播给所有其他玩家（包括主持人）通知该玩家重连
              broadcast(room, {
                type: 'PLAYER_RECONNECTED',
                playerId: existingPlayer.id,
                playerName: existingPlayer.name,
                message: `${existingPlayer.name} 重新连接`,
                notificationType: 'info'
              }, ws);
              
              // 修复：强制同步游戏状态给所有客户端
              broadcast(room, {
                type: 'GAME_STATE',
                state: getSanitizedGameState(room, room.hostId),
                message: `${existingPlayer.name} 重新连接，状态已同步`
              });
              
              break;
            }
          }
          
          // 新玩家加入或顶替
          const result = joinRoom(
            message.roomCode, 
            ws, 
            false, 
            null, 
            message.isReplace, 
            message.replaceTargetId
          );
          
          console.log(`[JOIN_ROOM] joinRoom 结果:`, {
            error: result.error,
            playerId: result.player?.id,
            playerName: result.player?.name,
            isReconnect: result.isReconnect,
            isReplace: result.isReplace
          });
          
          if (result.error) {
            // 如果是游戏已开始错误，告知客户端可以顶替
            if (result.errorCode === 'GAME_ALREADY_STARTED' && result.canReplace) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: result.error,
                errorCode: result.errorCode,
                canReplace: true,
                availablePlayers: room.gameState.players.map(p => ({
                  id: p.id,
                  name: p.name,
                  number: p.number,
                  isWeakened: p.isWeakened
                }))
              });
            } else {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: result.error,
                errorCode: result.errorCode,
                shouldReset: result.errorCode === 'ROOM_NOT_FOUND'
              });
            }
            break;
          }
          
          currentRoom = room;
          currentPlayerId = result.player.id;
          
          // 发送给新玩家 - 关键修复：包含完整的 player 数据（包括 role）
          const playerForResponse = result.player;
          sendToPlayer(ws, {
            type: 'ROOM_JOINED',
            roomCode: room.code,
            // 关键修复：playerId 和 player.id 必须一致
            playerId: playerForResponse.id,
            playerName: playerForResponse.name,
            // 关键修复：发送完整的 player 对象，包含 role、number 等字段
            player: {
              id: playerForResponse.id,
              name: playerForResponse.name,
              number: playerForResponse.number,
              role: playerForResponse.role,  // 确保包含 role
              camp: playerForResponse.camp,
              health: playerForResponse.health,
              maxHealth: playerForResponse.maxHealth,
              actionPoints: playerForResponse.actionPoints,
              currentLocation: playerForResponse.currentLocation,
              items: playerForResponse.items,
              isAlive: playerForResponse.isAlive,
              score: playerForResponse.score,
              isWeakened: playerForResponse.isWeakened
            },
            isReconnected: false,
            isReplace: result.isReplace || false,
            replacedPlayerName: result.replacedPlayerName,
            gameState: getSanitizedGameState(room, playerForResponse.id)
          });
          
          // 关键修复：确保新玩家数据包含 number 字段
          const playerNumber = result.player.number || result.player.name.match(/\d+/)?.[0] || '0';
          
          // 广播给所有其他玩家（包括主持人）有新玩家加入或顶替
          broadcast(room, {
            type: 'PLAYER_JOINED',
            playerId: result.player.id,
            playerName: result.player.name,
            playerNumber: playerNumber,
            totalPlayers: room.gameState.players.length,
            isReplace: result.isReplace || false,
            replacedPlayerName: result.replacedPlayerName,
            message: result.isReplace 
              ? `${result.replacedPlayerName} 被新玩家顶替`
              : `${result.player.name} 加入了房间`
          }, ws);
          
          // 关键修复：发送完整的 GAME_STATE 给新加入的玩家，确保数据同步
          sendToPlayer(ws, {
            type: 'GAME_STATE',
            state: getSanitizedGameState(room, result.player.id),
            message: '欢迎加入房间，数据已同步'
          });
          
          // 广播给所有其他玩家（包括主持人）状态更新
          broadcast(room, {
            type: 'GAME_STATE',
            state: getSanitizedGameState(room, room.hostId),
            message: result.isReplace
              ? `${result.replacedPlayerName} 被新玩家顶替`
              : `${result.player.name} 加入了房间，当前共 ${room.gameState.players.length} 人`
          }, ws);
          
          console.log(`[房间] ${result.player.name} ${result.isReplace ? '顶替' : '加入'}房间 ${room.code}，当前${room.gameState.players.length}人`);
          break;
        }
        
        case 'SET_ROLE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          const hostIdToCheck = message.hostPlayerId || currentHostId || currentPlayerId;
          if (!isHost(currentRoom, ws, hostIdToCheck)) {
            sendToPlayer(ws, { type: 'ERROR', message: '只有主持人可以设置身份' });
            break;
          }
          
          setPlayerRole(currentRoom, message.playerId, message.role);
          
          broadcast(currentRoom, {
            type: 'GAME_STATE',
            state: getSanitizedGameState(currentRoom, currentRoom.hostId)
          });
          
          console.log(`[身份] 设置 ${message.playerId} 为 ${message.role}`);
          break;
        }
        
        // server/websocket-server.js - 修复 START_GAME
        case 'START_GAME': {
          console.log(`[START_GAME] 收到开始游戏请求:`, message);
          
          try {
            // 关键修复：首先确保有有效的房间
            let targetRoom = currentRoom;
            
            // 如果 currentRoom 为 null，尝试通过 roomCode 查找
            if (!targetRoom && message.roomCode) {
              targetRoom = rooms.get(message.roomCode);
              console.log(`[START_GAME] 通过 roomCode 查找房间: ${message.roomCode}, 找到: ${!!targetRoom}`);
            }
            
            // 如果还是找不到，返回错误
            if (!targetRoom) {
              console.log(`[START_GAME] 错误: 找不到房间`);
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: '未加入房间或房间不存在', 
                errorCode: 'NO_ROOM',
                debug: { currentRoom: !!currentRoom, messageRoomCode: message.roomCode }
              });
              break;
            }
            
            // 关键修复：确定主持人 ID
            // 优先级: message.hostPlayerId > currentHostId > currentPlayerId > targetRoom.hostId
            let hostIdToCheck = message.hostPlayerId || currentHostId || currentPlayerId;
            
            // 如果都没有，尝试从 targetRoom 获取
            if (!hostIdToCheck && targetRoom.hostId) {
              hostIdToCheck = targetRoom.hostId;
              console.log(`[START_GAME] 使用房间存储的 hostId: ${hostIdToCheck}`);
            }
            
            console.log(`[START_GAME] 验证主持人身份:`, {
              hostIdToCheck: hostIdToCheck,
              roomHostId: targetRoom.hostId,
              messageHostId: message.hostPlayerId,
              currentHostId: currentHostId,
              currentPlayerId: currentPlayerId
            });
            
            // 验证 hostIdToCheck 有效性
            if (!hostIdToCheck) {
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: '无法验证主持人身份：缺少 hostPlayerId', 
                errorCode: 'NO_HOST_ID' 
              });
              break;
            }
            
            // 关键修复：验证主持人身份
            // 1. 检查 hostIdToCheck 是否匹配房间的 hostId
            const isHostById = targetRoom.hostId === hostIdToCheck;
            
            // 2. 检查 WebSocket 是否在 hostConnections 中
            const isHostByConnection = targetRoom.hostConnections && targetRoom.hostConnections.has(ws);
            
            // 3. 如果 ID 匹配但连接不在 hostConnections 中，自动修复
            if (isHostById && !isHostByConnection) {
              console.log(`[START_GAME] ID匹配但连接不在hostConnections中，自动修复`);
              targetRoom.hostConnections.add(ws);
              // 同时更新 currentRoom 和 currentHostId（如果它们为 null）
              if (!currentRoom) {
                currentRoom = targetRoom;
                currentHostId = hostIdToCheck;
                currentPlayerId = hostIdToCheck;
              }
            }
            
            // 最终验证
            if (!isHostById && !isHostByConnection) {
              console.log(`[START_GAME] 主持人验证失败`);
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: '只有主持人可以开始游戏', 
                errorCode: 'NOT_HOST',
                debug: { 
                  providedHostId: hostIdToCheck,
                  roomHostId: targetRoom.hostId,
                  isHostById,
                  isHostByConnection
                }
              });
              break;
            }
            
            console.log(`[START_GAME] 主持人验证通过，开始游戏初始化`);
            
            // 关键修复：先保存游戏状态
            targetRoom.gameState.phase = 'action';
            targetRoom.gameState.round = 1;
            
            // 给每个玩家发送个性化状态
            targetRoom.gameState.players.forEach(player => {
              if (player.ws && player.ws.readyState === WebSocket.OPEN) {
                // 创建全新的个性化状态
                const personalState = JSON.parse(JSON.stringify(targetRoom.gameState));
                
                // 移除 ws 引用
                personalState.players = personalState.players.map((p) => {
                  const { ws, ...playerData } = p;
                  return playerData;
                });
                
                // 强制设置当前玩家的真实 role
                const playerInState = personalState.players.find((p) => p.id === player.id);
                if (playerInState) {
                  playerInState.role = player.role;
                  playerInState.camp = player.camp;
                  playerInState.number = player.number;
                  playerInState.items = player.items || [];
                  playerInState.actionLine = player.actionLine || [];
                }
                
                // 对其他玩家隐藏敏感信息
                personalState.players = personalState.players.map((p) => {
                  if (p.id === player.id) {
                    return p;
                  }
                  return {
                    id: p.id,
                    name: p.name,
                    number: p.number || 0,
                    role: 'unknown',
                    camp: 'unknown',
                    health: p.health,
                    maxHealth: p.maxHealth,
                    isAlive: p.isAlive,
                    score: p.score,
                    currentLocation: p.currentLocation || '',
                    actionPoints: p.actionPoints,
                    items: [],
                    actionLine: [],
                    visitedLocations: p.visitedLocations || [],
                    isExposed: p.isExposed,
                    skillUsedThisRound: p.skillUsedThisRound,
                    canVote: p.canVote || false,
                    isWeakened: p.isWeakened || false
                  };
                });
                
                personalState.phase = 'action';
                personalState.round = 1;
                personalState.hostId = targetRoom.hostId;
                
                sendToPlayer(player.ws, {
                  type: 'GAME_STARTED',
                  state: personalState,
                  message: '游戏开始！',
                  playerId: player.id,
                  yourRole: player.role,
                  yourNumber: player.number
                });
                
                sendToPlayer(player.ws, {
                  type: 'GAME_STATE',
                  state: personalState,
                  message: '游戏开始状态同步'
                });
              }
            });

            // 给主持人也发送状态更新
            const hostState = getSanitizedGameState(targetRoom, targetRoom.hostId);
            hostState.phase = 'action';
            hostState.round = 1;
            
            targetRoom.hostConnections.forEach(hostWs => {
              if (hostWs.readyState === WebSocket.OPEN) {
                sendToPlayer(hostWs, {
                  type: 'GAME_STARTED',
                  state: hostState,
                  message: '游戏开始！',
                  isHost: true
                });
                
                sendToPlayer(hostWs, {
                  type: 'GAME_STATE',
                  state: hostState,
                  message: '游戏开始状态同步'
                });
              }
            });
            
            // 广播通用通知
            broadcast(targetRoom, {
              type: 'NOTIFICATION',
              message: '游戏开始！',
              notificationType: 'success'
            }, ws);
            
            console.log(`[START_GAME] 游戏开始成功，房间 ${targetRoom.code}`);
            
          } catch (error) {
            console.error(`[START_GAME] 处理异常:`, error);
            sendToPlayer(ws, {
              type: 'ERROR',
              message: '开始游戏时发生错误: ' + error.message,
              errorCode: 'START_GAME_ERROR'
            });
          }
          
          break;
        }
        
        case 'PLAYER_ACTION': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          // 修复：优先使用消息中的 playerId，其次使用 currentPlayerId
          const actionPlayerId = message.playerId || currentPlayerId;
          const player = currentRoom.gameState.players.find(p => p.id === actionPlayerId);
          
          if (!player) {
            sendToPlayer(ws, { type: 'ERROR', message: '玩家不存在' });
            break;
          }
          
          // 处理移动动作
          if (message.action === 'MOVE') {
            const targetLocation = message.locationId;
            const hasSki = player.items && player.items.includes('ski');
            const hasRope = player.items && player.items.includes('rope');
            
            // 检查是否是绳索反向移动
            const ropeReverseInfo = isRopeReverseMove(player.currentLocation, targetLocation, hasRope);
            
            if (ropeReverseInfo) {
              if (!hasRope) {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: '没有绳索，无法攀爬',
                  errorCode: 'NO_ROPE'
                });
                break;
              }
              
              const ropeIndex = player.items.indexOf('rope');
              if (ropeIndex > -1) {
                player.items.splice(ropeIndex, 1);
              }
              
              player.currentLocation = targetLocation;
              
              if (!player.visitedLocations.includes(targetLocation)) {
                player.visitedLocations.push(targetLocation);
              }
              
              const stepNumber = player.actionLine.length + 1;
              player.actionLine.push({
                step: stepNumber,
                locationId: targetLocation,
                action: 'rope_climb',
                cost: 0
              });
              
              broadcast(currentRoom, {
                type: 'PLAYER_ACTION_DONE',
                playerId: actionPlayerId,
                action: 'ROPE_REVERSE_MOVE',
                locationId: targetLocation,
                cost: 0,
                healthCost: 0,
                itemConsumed: 'rope',
                currentHealth: player.health,
                state: getSanitizedGameState(currentRoom, currentRoom.hostId)
              });
              
              console.log(`[绳索] ${player.name} 使用绳索从花园攀爬到阳台，消耗绳索`);
              break;
            }
            
            // 跳楼检测
            const jumpInfo = checkJumpMove(player.currentLocation, targetLocation);
            
            if (jumpInfo) {
              if (player.health < jumpInfo.minHealth) {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: `生命值不足，跳楼需要至少${jumpInfo.minHealth}点生命值`,
                  errorCode: 'INSUFFICIENT_HEALTH'
                });
                break;
              }
              if (player.actionPoints < jumpInfo.actionCost) {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: `行动点不足，跳楼需要${jumpInfo.actionCost}点`,
                  errorCode: 'INSUFFICIENT_ACTION_POINTS'
                });
                break;
              }
              
              const jumpCost = getJumpCostWithRope(player.currentLocation, targetLocation, hasRope);
              const actualHealthCost = jumpCost.healthCost;
              
              if (actualHealthCost > 0) {
                player.health -= actualHealthCost;
              }
              player.actionPoints -= jumpInfo.actionCost;
              player.currentLocation = targetLocation;
              
              if (!player.visitedLocations.includes(targetLocation)) {
                player.visitedLocations.push(targetLocation);
              }
              
              const stepNumber = player.actionLine.length + 1;
              player.actionLine.push({
                step: stepNumber,
                locationId: targetLocation,
                action: 'jump',
                cost: jumpInfo.actionCost
              });
              
              broadcast(currentRoom, {
                type: 'PLAYER_ACTION_DONE',
                playerId: actionPlayerId,
                action: 'JUMP',
                locationId: targetLocation,
                cost: jumpInfo.actionCost,
                healthCost: actualHealthCost,
                currentHealth: player.health,
                state: getSanitizedGameState(currentRoom, currentRoom.hostId)
              });
              
              console.log(`[跳楼] ${player.name} 跳楼到 ${targetLocation}，受到 ${actualHealthCost} 点伤害，剩余血量 ${player.health}`);
              break;
            }
            
            // 修复：第一轮初始位置选择特殊处理
            const isInitialSetup = currentRoom.gameState.round === 1 && !player.currentLocation;
            
            if (isInitialSetup) {
              // 初始位置选择：固定扣除1点行动点
              const initialCost = 1;
              
              if (player.actionPoints < initialCost) {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: `行动点不足，选择初始位置需要 ${initialCost} 点`,
                  errorCode: 'INSUFFICIENT_ACTION_POINTS'
                });
                break;
              }
              
              player.actionPoints -= initialCost;
              player.currentLocation = targetLocation;
              
              if (!player.visitedLocations.includes(targetLocation)) {
                player.visitedLocations.push(targetLocation);
              }
              
              const stepNumber = player.actionLine.length + 1;
              player.actionLine.push({
                step: stepNumber,
                locationId: targetLocation,
                action: 'initial_setup',
                cost: initialCost
              });
              
              broadcast(currentRoom, {
                type: 'PLAYER_ACTION_DONE',
                playerId: actionPlayerId,
                action: 'INITIAL_SETUP',
                locationId: targetLocation,
                cost: initialCost,
                healthCost: 0,
                currentHealth: player.health,
                state: getSanitizedGameState(currentRoom, currentRoom.hostId)
              });
              
              console.log(`[初始位置] ${player.name} 选择 ${targetLocation} 作为起点，消耗 ${initialCost} 行动点，剩余 ${player.actionPoints}`);
              break;
            }
            
            // 普通移动
            const cost = calculateMoveCost(player.currentLocation, targetLocation, hasSki);
            
            if (player.actionPoints < cost) {
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: `行动点不足，需要 ${cost} 点`,
                errorCode: 'INSUFFICIENT_ACTION_POINTS'
              });
              break;
            }
            
            player.actionPoints -= cost;
            player.currentLocation = targetLocation;
            
            if (!player.visitedLocations.includes(targetLocation)) {
              player.visitedLocations.push(targetLocation);
            }
            
            const stepNumber = player.actionLine.length + 1;
            player.actionLine.push({
              step: stepNumber,
              locationId: targetLocation,
              action: 'move',
              cost: cost
            });
            
            broadcast(currentRoom, {
              type: 'PLAYER_ACTION_DONE',
              playerId: actionPlayerId,
              action: message.action,
              locationId: targetLocation,
              cost: cost,
              healthCost: 0,
              currentHealth: player.health,
              state: getSanitizedGameState(currentRoom, currentRoom.hostId)
            });
            
            console.log(`[移动] ${player.name} 移动到 ${targetLocation}，消耗 ${cost} 行动点，剩余 ${player.actionPoints}`);
          }
          
          // 处理房间功能
          if (message.action === 'ROOM_FEATURE') {
            const feature = getRoomFeature(message.roomId);
            if (!feature) {
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: '该房间没有特殊功能',
                errorCode: 'NO_ROOM_FEATURE'
              });
              break;
            }
            
            if (player.actionPoints < feature.cost) {
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: `行动点不足，需要 ${feature.cost} 点`,
                errorCode: 'INSUFFICIENT_ACTION_POINTS'
              });
              break;
            }
            
            // 修改：同一种道具每轮每个玩家只能获取1次
            if (feature.itemReward) {
              // 检查本轮是否已经获取过该道具
              if (!player.itemsObtainedThisRound) {
                player.itemsObtainedThisRound = [];
              }
              
              if (player.itemsObtainedThisRound.includes(feature.itemReward)) {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: `你本轮已经获取过该道具，请等待下一轮`,
                  errorCode: 'ITEM_ALREADY_OBTAINED_THIS_ROUND'
                });
                break;
              }
              
              // 检查是否已拥有该道具（可选，根据需求决定是否保留）
              if (player.items && player.items.includes(feature.itemReward)) {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: `你已拥有该道具，无法重复获取`,
                  errorCode: 'ITEM_ALREADY_OWNED'
                });
                break;
              }
            }
            
            player.actionPoints -= feature.cost;
            
            const stepNumber = player.actionLine.length + 1;
            player.actionLine.push({
              step: stepNumber,
              locationId: message.roomId,
              action: 'room_feature',
              cost: feature.cost
            });
            
            if (feature.action === 'get_item' && feature.itemReward) {
              if (!player.items) player.items = [];
              player.items.push(feature.itemReward);
              
              // 记录本轮已获取的道具
              if (!player.itemsObtainedThisRound) {
                player.itemsObtainedThisRound = [];
              }
              player.itemsObtainedThisRound.push(feature.itemReward);
              
              sendToPlayer(ws, {
                type: 'NOTIFICATION',
                message: `获得道具: ${feature.itemReward}`,
                notificationType: 'success'
              });
              
              console.log(`[道具] ${player.name} 在 ${feature.roomName} 获得 ${feature.itemReward}`);
            } else if (feature.action === 'view_score') {
              sendToPlayer(ws, {
                type: 'NOTIFICATION',
                message: `当前分数: ${player.score} 分`,
                notificationType: 'info'
              });
              console.log(`[分数] ${player.name} 查看分数: ${player.score}`);
            }
            
            broadcast(currentRoom, {
              type: 'ROOM_FEATURE_USED',
              playerId: actionPlayerId,
              roomId: message.roomId,
              featureAction: feature.action,
              itemReward: feature.itemReward,
              cost: feature.cost,
              state: getSanitizedGameState(currentRoom, currentRoom.hostId)
            });
          }
          
          // 处理道具使用
          if (message.action === 'USE_ITEM') {
            const item = message.item;
            const targetId = message.target;
            
            if (!item) {
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: '未指定道具',
                errorCode: 'NO_ITEM_SPECIFIED'
              });
              break;
            }
            
            if (player.actionPoints < ITEM_USE_COST) {
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: `行动点不足，使用道具需要 ${ITEM_USE_COST} 点`,
                errorCode: 'INSUFFICIENT_ACTION_POINTS'
              });
              break;
            }
            
            if (!player.items || !player.items.includes(item)) {
              sendToPlayer(ws, { 
                type: 'ERROR', 
                message: '你没有这个道具',
                errorCode: 'ITEM_NOT_OWNED'
              });
              break;
            }
            
            let useSuccess = false;
            let effect = '';
            let value = 0;
            
            switch (item) {
              case 'bandage': {
                // 修改：虚弱状态玩家不能使用绷带
                if (player.isWeakened || player.health === 0) {
                  sendToPlayer(ws, { 
                    type: 'ERROR', 
                    message: '虚弱状态无法使用绷带',
                    errorCode: 'WEAKENED_CANNOT_USE'
                  });
                  break;
                }
                
                if (player.health >= player.maxHealth) {
                  sendToPlayer(ws, { 
                    type: 'ERROR', 
                    message: '生命值已满，无需使用绷带',
                    errorCode: 'HEALTH_FULL'
                  });
                  break;
                }
                
                const itemIndex = player.items.indexOf('bandage');
                if (itemIndex > -1) {
                  player.items.splice(itemIndex, 1);
                }
                
                player.actionPoints -= ITEM_USE_COST;
                player.health = Math.min(player.health + 1, player.maxHealth);
                
                useSuccess = true;
                effect = 'heal';
                value = 1;
                
                sendToPlayer(ws, {
                  type: 'NOTIFICATION',
                  message: `使用急救绷带，消耗1点行动点，恢复1点生命值，当前生命值：${player.health}/${player.maxHealth}`,
                  notificationType: 'success'
                });
                
                console.log(`[道具] ${player.name} 使用急救绷带，消耗1行动点，恢复1点生命`);
                break;
              }
              
              case 'powder': {
                if (!targetId) {
                  sendToPlayer(ws, { 
                    type: 'ERROR', 
                    message: '请选择要标记的目标玩家',
                    errorCode: 'NO_TARGET_SPECIFIED'
                  });
                  break;
                }
                
                const targetPlayer = currentRoom.gameState.players.find(p => p.id === targetId);
                if (!targetPlayer) {
                  sendToPlayer(ws, { 
                    type: 'ERROR', 
                    message: '目标玩家不存在',
                    errorCode: 'TARGET_NOT_FOUND'
                  });
                  break;
                }
                
                const itemIndex = player.items.indexOf('powder');
                if (itemIndex > -1) {
                  player.items.splice(itemIndex, 1);
                }
                
                player.actionPoints -= ITEM_USE_COST;
                currentRoom.gameState.powderTarget = targetId;
                
                useSuccess = true;
                effect = 'expose';
                
                sendToPlayer(ws, {
                  type: 'NOTIFICATION',
                  message: `消耗1点行动点，对 ${targetPlayer.name} 使用荧光粉，下一轮将暴露其行动线`,
                  notificationType: 'success'
                });
                
                console.log(`[道具] ${player.name} 对 ${targetPlayer.name} 使用荧光粉`);
                break;
              }
              
              case 'extinguisher': {
                if (!currentRoom.gameState.fireLocations || currentRoom.gameState.fireLocations.length === 0) {
                  sendToPlayer(ws, { 
                    type: 'ERROR', 
                    message: '当前没有着火的地点',
                    errorCode: 'NO_FIRE'
                  });
                  break;
                }
                
                const currentLoc = player.currentLocation;
                const fireIndex = currentRoom.gameState.fireLocations.indexOf(currentLoc);
                
                if (fireIndex === -1) {
                  sendToPlayer(ws, { 
                    type: 'ERROR', 
                    message: '你所在的房间没有着火',
                    errorCode: 'NO_FIRE_HERE'
                  });
                  break;
                }
                
                const itemIndex = player.items.indexOf('extinguisher');
                if (itemIndex > -1) {
                  player.items.splice(itemIndex, 1);
                }
                
                player.actionPoints -= ITEM_USE_COST;
                currentRoom.gameState.fireLocations.splice(fireIndex, 1);
                
                useSuccess = true;
                effect = 'extinguish';
                
                sendToPlayer(ws, {
                  type: 'NOTIFICATION',
                  message: `消耗1点行动点，使用灭火器扑灭当前房间的火灾`,
                  notificationType: 'success'
                });
                
                console.log(`[道具] ${player.name} 使用灭火器`);
                break;
              }
              
              case 'rope':
              case 'ski': {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: '该道具为被动生效，无需主动使用',
                  errorCode: 'PASSIVE_ITEM'
                });
                break;
              }
              
              default: {
                sendToPlayer(ws, { 
                  type: 'ERROR', 
                  message: `未知道具: ${item}`,
                  errorCode: 'UNKNOWN_ITEM'
                });
              }
            }
            
            if (useSuccess) {
              broadcast(currentRoom, {
                type: 'ITEM_USED',
                playerId: actionPlayerId,
                item: item,
                effect: effect,
                value: value,
                currentHealth: player.health,
                actionPoints: player.actionPoints,
                remainingItems: player.items,
                state: getSanitizedGameState(currentRoom, currentRoom.hostId)
              });
            }
            
            break;
          }
          
          // 处理技能使用
          if (message.action === 'USE_SKILL') {
            const { skillType, targetId, locationId, additionalData } = message;
 
            // 添加详细调试日志
            console.log(`\n========== [技能使用调试] ==========`);
            console.log(`玩家: ${player.name} (${player.role})`);
            console.log(`skillType: ${skillType} (类型: ${typeof skillType})`);
            console.log(`targetId: ${targetId}`);
            console.log(`locationId: ${locationId}`);
            console.log(`当前位置: ${player.currentLocation}`);
            console.log(`当前轮次: ${currentRoom.gameState.round}`);
            console.log(`当前阶段: ${currentRoom.gameState.phase}`);
            console.log(`已使用技能: ${player.skillUsedThisRound}`);              
            console.log(`=====================================\n`);

            const skillResult = validateSkillUse(player, currentRoom.gameState, skillType, targetId, locationId);
            
            console.log(`[技能使用调试] 验证结果:`, skillResult);


            if (!skillResult.valid) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: skillResult.reason,
                errorCode: 'SKILL_USE_FAILED'
              });
              break;
            }
            
            const skillEffect = executeSkillEffect(player, currentRoom.gameState, skillType, targetId, locationId, additionalData);
            
            console.log(`[技能使用调试] 执行结果:`, skillEffect);

            player.skillUsedThisRound = true;
            
            if (skillType === 'attack' && player.role === 'accomplice') {
              player.skillUseCount = (player.skillUseCount || 0) + 1;
            }
            
            if (player.role === 'hacker' && targetId !== player.id) {
              player.hasCheckedOthersScore = true;
              currentRoom.gameState.hackerChecks.set(player.id, true);
            }
            
            currentRoom.gameState.skillRecords.push({
              playerId: player.id,
              skillType,
              targetId,
              locationId,
              round: currentRoom.gameState.round,
              timestamp: Date.now()
            });
            
            broadcast(currentRoom, {
              type: 'SKILL_USED',
              playerId: actionPlayerId,
              skillType,
              effect: skillEffect,
              state: getSanitizedGameState(currentRoom, currentRoom.hostId)
            });
            
            console.log(`[技能] ${player.name} 使用技能 ${skillType}`);
            break;
          }
          
          // 处理设置虚假行动线
          if (message.action === 'SET_FAKE_ACTION_LINE') {
            const { actionLine } = message;
            
            if (!actionLine || actionLine.length !== 8) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '虚假行动线必须包含8个行动',
                errorCode: 'INVALID_ACTION_LINE'
              });
              break;
            }
            
            if (player.fakeActionLineCount <= 0) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '虚假行动线使用次数已用完',
                errorCode: 'NO_FAKE_ACTION_LINE_USES'
              });
              break;
            }
            
            player.fakeActionLine = actionLine;
            player.fakeActionLineCount--;
            
            broadcast(currentRoom, {
              type: 'FAKE_ACTION_LINE_SET',
              playerId: actionPlayerId,
              remainingUses: player.fakeActionLineCount,
              state: getSanitizedGameState(currentRoom, currentRoom.hostId)
            });
            
            sendToPlayer(ws, {
              type: 'NOTIFICATION',
              message: `已设置虚假行动线，剩余${player.fakeActionLineCount}次`,
              notificationType: 'success'
            });
            
            console.log(`[虚假行动线] ${player.name} 设置了虚假行动线，剩余${player.fakeActionLineCount}次`);
            break;
          }
          
          // 处理推理迷转变身份
          if (message.action === 'FAN_TRANSFORM') {
            const { targetId, guessedRole } = message;
            const round = currentRoom.gameState.round;
            
            if (round < 3) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '第3轮开始才能转变身份',
                errorCode: 'INVALID_ROUND'
              });
              break;
            }
            
            if (player.actionPoints !== 0) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '需要行动点为0才能转变身份',
                errorCode: 'ACTION_POINTS_NOT_ZERO'
              });
              break;
            }
            
            if (player.transformedRole) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '已经转变过身份',
                errorCode: 'ALREADY_TRANSFORMED'
              });
              break;
            }
            
            const target = currentRoom.gameState.players.find(p => p.id === targetId);
            if (!target) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '目标玩家不存在',
                errorCode: 'TARGET_NOT_FOUND'
              });
              break;
            }
            
            // 检查猜测是否正确
            const isCorrect = (guessedRole === 'detective' && target.role === 'detective') ||
                             (guessedRole === 'killer' && (target.role === 'killer' || target.role === 'murderer'));
            
            if (isCorrect) {
              // 猜测正确，转变身份
              if (guessedRole === 'detective') {
                player.role = 'good_fan';
                player.camp = 'detective';
                player.transformedRole = 'good_fan';
              } else {
                player.role = 'bad_fan';
                player.camp = 'killer';
                player.transformedRole = 'bad_fan';
              }
              
              player.fanChoiceRound = round;
              player.fanTargetId = targetId;
              player.fanTargetRole = guessedRole;
              
              currentRoom.gameState.fanTransformed = true;
              
              broadcast(currentRoom, {
                type: 'FAN_TRANSFORMED',
                playerId: actionPlayerId,
                newRole: player.role,
                success: true,
                state: getSanitizedGameState(currentRoom, currentRoom.hostId)
              });
              
              sendToPlayer(ws, {
                type: 'NOTIFICATION',
                message: `猜测正确！你已转变为${guessedRole === 'detective' ? '好推理迷' : '坏推理迷'}`,
                notificationType: 'success'
              });
            } else {
              // 猜测错误
              player.fanChoiceRound = round;
              player.fanTargetId = targetId;
              player.fanTargetRole = guessedRole;
              
              broadcast(currentRoom, {
                type: 'FAN_TRANSFORMED',
                playerId: actionPlayerId,
                success: false,
                state: getSanitizedGameState(currentRoom, currentRoom.hostId)
              });
              
              sendToPlayer(ws, {
                type: 'NOTIFICATION',
                message: '猜测错误，下一轮可继续尝试',
                notificationType: 'warning'
              });
            }
            
            console.log(`[推理迷转变] ${player.name} 选择${target.name}，猜测为${guessedRole}，结果：${isCorrect ? '正确' : '错误'}`);
            break;
          }
          
          // 处理推理迷选择技能
          if (message.action === 'FAN_CHOOSE_SKILL') {
            const { skillChoice } = message;
            
            if (!player.transformedRole) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '还未转变身份',
                errorCode: 'NOT_TRANSFORMED'
              });
              break;
            }
            
            // 验证技能选择是否合法
            const isGoodFan = player.role === 'good_fan';
            const validChoices = isGoodFan 
              ? ['action_line', 'vote_2']
              : ['attack_fake', 'vote_1'];
            
            if (!validChoices.includes(skillChoice)) {
              sendToPlayer(ws, {
                type: 'ERROR',
                message: '非法的技能选择',
                errorCode: 'INVALID_SKILL_CHOICE'
              });
              break;
            }
            
            player.fanSkillChoice = skillChoice;
            
            if (skillChoice === 'vote_2') {
              player.canVote = true;
              player.score = 2;
            } else if (skillChoice === 'vote_1') {
              player.canVote = true;
              player.score = 1;
            } else if (skillChoice === 'attack_fake') {
              player.fakeActionLineCount = 1;
            }
            
            broadcast(currentRoom, {
              type: 'FAN_SKILL_CHOSEN',
              playerId: actionPlayerId,
              skillChoice,
              state: getSanitizedGameState(currentRoom, currentRoom.hostId)
            });
            
            sendToPlayer(ws, {
              type: 'NOTIFICATION',
              message: `已选择技能：${getSkillChoiceName(skillChoice)}`,
              notificationType: 'success'
            });
            
            console.log(`[推理迷技能] ${player.name} 选择了 ${skillChoice}`);
            break;
          }
          
          break;
        }
        
        // 投票 - 修改：允许投自己
        case 'VOTE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          // 第一轮不能投票
          if (currentRoom.gameState.round < 2) {
            sendToPlayer(ws, { type: 'ERROR', message: '第一轮不能投凶' });
            break;
          }
          
          const player = currentRoom.gameState.players.find(p => p.id === currentPlayerId);
          if (!player || !player.isAlive) {
            sendToPlayer(ws, { type: 'ERROR', message: '无法投凶' });
            break;
          }
          
          // 检查推理迷是否可以投票
          if (player.role === 'fan' && !player.canVote) {
            sendToPlayer(ws, { type: 'ERROR', message: '推理迷无法投凶，请先转变身份并选择投凶技能' });
            break;
          }
          
          // 修改：允许投自己，移除不能投自己的限制
          // if (message.targetId === currentPlayerId) {
          //   sendToPlayer(ws, { type: 'ERROR', message: '不能投自己' });
          //   break;
          // }
          
          currentRoom.gameState.votes[currentPlayerId] = message.targetId;
          player.votesThisRound = message.targetId;
          
          sendToPlayer(ws, {
            type: 'VOTE_SUCCESS',
            message: '投凶成功'
          });
          
          // 关键修复：立即广播投票更新给所有客户端，包括主持人
          broadcast(currentRoom, {
            type: 'VOTE_UPDATED',
            voterId: currentPlayerId,
            voterName: player.name,
            targetId: message.targetId,
            state: getSanitizedGameState(currentRoom, currentRoom.hostId)
          });
          
          const hostWs = Array.from(currentRoom.hostConnections)[0];
          if (hostWs && hostWs.readyState === WebSocket.OPEN) {
            sendToPlayer(hostWs, {
              type: 'NOTIFICATION',
              message: `${player.name} 已完成投凶`,
              notificationType: 'info'
            });
          }
          
          console.log(`[投凶] ${player.name} 投了一票`);
          break;
        }
        
        case 'CREATE_TRADE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          const fromPlayer = currentRoom.gameState.players.find(p => p.id === currentPlayerId);
          const toPlayer = currentRoom.gameState.players.find(p => p.id === message.toPlayerId);
          
          if (!fromPlayer || !toPlayer) {
            sendToPlayer(ws, { type: 'ERROR', message: '玩家不存在' });
            break;
          }
          
          if (!fromPlayer.items || !fromPlayer.items.includes(message.offerItem)) {
            sendToPlayer(ws, { type: 'ERROR', message: '你没有这个道具' });
            break;
          }
          
          const tradeId = generateId();
          const trade = {
            id: tradeId,
            fromPlayerId: currentPlayerId,
            toPlayerId: message.toPlayerId,
            offerItem: message.offerItem,
            requestItem: message.requestItem,
            status: 'pending',
            createdAt: Date.now()
          };
          
          currentRoom.gameState.tradeRequests.push(trade);
          
          if (toPlayer.ws && toPlayer.ws.readyState === WebSocket.OPEN) {
            sendToPlayer(toPlayer.ws, {
              type: 'TRADE_REQUEST',
              trade: trade,
              fromPlayerName: fromPlayer.name
            });
          }
          
          sendToPlayer(ws, {
            type: 'TRADE_CREATED',
            tradeId: tradeId
          });
          
          console.log(`[交易] ${fromPlayer.name} 向 ${toPlayer.name} 发起交易`);
          break;
        }
        
        case 'RESPOND_TRADE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          const trade = currentRoom.gameState.tradeRequests.find(t => t.id === message.tradeId);
          if (!trade) {
            sendToPlayer(ws, { type: 'ERROR', message: '交易不存在' });
            break;
          }
          
          trade.status = message.accept ? 'accepted' : 'rejected';
          
          if (message.accept) {
            const fromPlayer = currentRoom.gameState.players.find(p => p.id === trade.fromPlayerId);
            const toPlayer = currentRoom.gameState.players.find(p => p.id === trade.toPlayerId);
            
            if (!fromPlayer.items) fromPlayer.items = [];
            if (!toPlayer.items) toPlayer.items = [];
            
            const fromIdx = fromPlayer.items.indexOf(trade.offerItem);
            const toIdx = toPlayer.items.indexOf(trade.requestItem);
            
            if (fromIdx > -1 && toIdx > -1) {
              fromPlayer.items.splice(fromIdx, 1);
              toPlayer.items.splice(toIdx, 1);
              fromPlayer.items.push(trade.requestItem);
              toPlayer.items.push(trade.offerItem);
            }
          }
          
          const fromPlayer = currentRoom.gameState.players.find(p => p.id === trade.fromPlayerId);
          const toPlayer = currentRoom.gameState.players.find(p => p.id === trade.toPlayerId);
          
          if (fromPlayer.ws && fromPlayer.ws.readyState === WebSocket.OPEN) {
            sendToPlayer(fromPlayer.ws, {
              type: 'TRADE_RESPONSE',
              tradeId: trade.id,
              accepted: message.accept,
              state: getSanitizedGameState(currentRoom, fromPlayer.id)
            });
          }
          
          sendToPlayer(ws, {
            type: 'TRADE_RESPONSE',
            tradeId: trade.id,
            accepted: message.accept,
            state: getSanitizedGameState(currentRoom, currentPlayerId)
          });
          
          console.log(`[交易] ${trade.id} ${message.accept ? '已接受' : '已拒绝'}`);
          break;
        }
        
        case 'NEXT_PHASE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          const hostIdToCheck = message.hostPlayerId || currentHostId || currentPlayerId;
          if (!isHost(currentRoom, ws, hostIdToCheck)) {
            sendToPlayer(ws, { type: 'ERROR', message: '只有主持人可以控制流程' });
            break;
          }
          
          const state = currentRoom.gameState;
          
          // 保存当前轮到历史记录
          if (state.phase === 'settlement') {
            saveRoundHistory(currentRoom);
          }
          
          if (state.phase === 'free') {
            state.phase = 'action';
            state.players.forEach(p => {
              // 虚弱状态玩家每轮只有4个行动点
              p.actionPoints = p.isWeakened ? 4 : (p.isAlive ? 8 : 4);
              p.skillUsedThisRound = false;
              // 重置本轮已获取道具记录
              p.itemsObtainedThisRound = [];
            });
          } else if (state.phase === 'action') {
            state.phase = 'settlement';
            
            const settlementResult = processSettlement(currentRoom);
            
            console.log('[结算] 处理结果:', settlementResult);
            
            broadcast(currentRoom, {
              type: 'SETTLEMENT_PROCESSED',
              result: settlementResult,
              state: getSanitizedGameState(currentRoom, currentRoom.hostId)
            });
            
          } else if (state.phase === 'settlement') {
            if (state.round >= 5) {
              state.phase = 'ended';
            } else {
              state.round++;
              state.phase = 'free';
              
              state.players.forEach(p => {
                p.actionPoints = 0;
                p.actionLine = [];
                p.skillUsedThisRound = false;
                p.votesThisRound = null;
                // 重置本轮已获取道具记录
                p.itemsObtainedThisRound = [];
              });
              
              state.votes = {};
            }
          }
          
          broadcast(currentRoom, {
            type: 'PHASE_CHANGED',
            phase: state.phase,
            round: state.round,
            state: getSanitizedGameState(currentRoom, currentRoom.hostId)
          });
          
          console.log(`[流程] 进入 ${state.phase} 阶段，第 ${state.round} 轮`);
          break;
        }
        
        case 'RESET_ROOM': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          const hostIdToCheck = message.hostPlayerId || currentHostId || currentPlayerId;
          if (!isHost(currentRoom, ws, hostIdToCheck)) {
            sendToPlayer(ws, { type: 'ERROR', message: '只有主持人可以重置房间' });
            break;
          }
          
          const roomCode = currentRoom.code;
          resetRoom(roomCode);
          
          sendToPlayer(ws, {
            type: 'RESET_SUCCESS',
            message: '房间已重置',
            roomCode: roomCode
          });
          
          console.log(`[重置] 房间 ${roomCode} 已被主持人重置`);
          break;
        }
        
        case 'REQUEST_STATE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          sendToPlayer(ws, {
            type: 'GAME_STATE',
            state: getSanitizedGameState(currentRoom, currentPlayerId)
          });
          break;
        }
        
        case 'ADMIN_COMMAND': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          const hostIdToCheck = message.hostPlayerId || currentHostId || currentPlayerId;
          if (!isHost(currentRoom, ws, hostIdToCheck)) {
            sendToPlayer(ws, { type: 'ERROR', message: '只有主持人可以执行管理命令' });
            break;
          }
          
          const { command } = message;
          if (!command || !command.targetPlayerId || !command.type) {
            sendToPlayer(ws, { type: 'ERROR', message: '命令格式错误' });
            break;
          }
          
          const targetPlayer = currentRoom.gameState.players.find(p => p.id === command.targetPlayerId);
          if (!targetPlayer) {
            sendToPlayer(ws, { type: 'ERROR', message: '目标玩家不存在' });
            break;
          }
          
          let result = { success: false, message: '', oldValue: null, newValue: null };
          
          switch (command.type) {
            case 'ADD_HEALTH': {
              const oldHealth = targetPlayer.health;
              // 修改：虚弱状态玩家可以通过主持人操作恢复血量
              targetPlayer.health = Math.min(targetPlayer.health + (command.value || 1), targetPlayer.maxHealth);
              
              // 如果血量恢复，解除虚弱状态
              if (targetPlayer.health > 0 && targetPlayer.isWeakened) {
                targetPlayer.isWeakened = false;
                targetPlayer.isAlive = true;
              }
              
              result = {
                success: true,
                message: `已为 ${targetPlayer.name} 增加 ${command.value || 1} 点生命值`,
                oldValue: oldHealth,
                newValue: targetPlayer.health
              };
              break;
            }
            
            case 'REMOVE_HEALTH': {
              const oldHealth = targetPlayer.health;
              // 修改：主持人不能减少玩家血量到低于0
              targetPlayer.health = Math.max(targetPlayer.health - (command.value || 1), 0);
              
              if (targetPlayer.health === 0 && oldHealth > 0) {
                targetPlayer.isAlive = false;
                targetPlayer.isWeakened = true;
                targetPlayer.score = 0;
              }
              
              result = {
                success: true,
                message: `已为 ${targetPlayer.name} 减少 ${command.value || 1} 点生命值`,
                oldValue: oldHealth,
                newValue: targetPlayer.health
              };
              break;
            }
            
            case 'ADD_ACTION_POINTS': {
              const oldPoints = targetPlayer.actionPoints;
              targetPlayer.actionPoints = targetPlayer.actionPoints + (command.value || 1);
              result = {
                success: true,
                message: `已为 ${targetPlayer.name} 增加 ${command.value || 1} 点行动点`,
                oldValue: oldPoints,
                newValue: targetPlayer.actionPoints
              };
              break;
            }
            
            case 'REMOVE_ACTION_POINTS': {
              const oldPoints = targetPlayer.actionPoints;
              targetPlayer.actionPoints = Math.max(targetPlayer.actionPoints - (command.value || 1), 0);
              result = {
                success: true,
                message: `已为 ${targetPlayer.name} 减少 ${command.value || 1} 点行动点`,
                oldValue: oldPoints,
                newValue: targetPlayer.actionPoints
              };
              break;
            }
            
            case 'ADD_ITEM': {
              if (!targetPlayer.items) targetPlayer.items = [];
              if (targetPlayer.items.includes(command.itemType)) {
                result = {
                  success: false,
                  message: `${targetPlayer.name} 已拥有该道具，无法重复添加`
                };
              } else {
                const oldItems = [...targetPlayer.items];
                targetPlayer.items.push(command.itemType);
                result = {
                  success: true,
                  message: `已为 ${targetPlayer.name} 添加道具 ${command.itemType}`,
                  oldValue: oldItems,
                  newValue: targetPlayer.items
                };
              }
              break;
            }
            
            case 'REMOVE_ITEM': {
              if (!targetPlayer.items || !targetPlayer.items.includes(command.itemType)) {
                result = {
                  success: false,
                  message: `${targetPlayer.name} 没有该道具，无法移除`
                };
              } else {
                const oldItems = [...targetPlayer.items];
                const index = targetPlayer.items.indexOf(command.itemType);
                targetPlayer.items.splice(index, 1);
                result = {
                  success: true,
                  message: `已从 ${targetPlayer.name} 移除道具 ${command.itemType}`,
                  oldValue: oldItems,
                  newValue: targetPlayer.items
                };
              }
              break;
            }
            
            default: {
              result = {
                success: false,
                message: `未知命令类型: ${command.type}`
              };
            }
          }
          
          sendToPlayer(ws, {
            type: 'ADMIN_COMMAND_RESULT',
            result: result,
            targetPlayerId: targetPlayer.id,
            command: command
          });
          
          if (result.success) {
            broadcast(currentRoom, {
              type: 'GAME_STATE',
              state: getSanitizedGameState(currentRoom, currentRoom.hostId),
              message: result.message
            });
          }
          
          console.log(`[管理命令] ${result.message}`);
          break;
        }
        
        case 'PING': {
          sendToPlayer(ws, { type: 'PONG' });
          break;
        }
        
        default: {
          console.log(`[警告] 未知消息类型: ${message.type}`);
          sendToPlayer(ws, {
            type: 'ERROR',
            message: `未知消息类型: ${message.type}`
          });
        }
      }
    } catch (error) {
      console.error('[错误] 处理消息失败:', error);
      sendToPlayer(ws, {
        type: 'ERROR',
        message: '消息格式错误'
      });
    }
  });
  
  ws.on('close', () => {
    console.log(`[断开] 客户端断开: ${clientId}`);
    
    if (currentRoom) {
      currentRoom.clients.delete(ws);
      if (currentRoom.hostConnections) {
        currentRoom.hostConnections.delete(ws);
      }
      
      if (currentPlayerId === currentRoom.hostId) {
        console.log(`[断开] 主持人断开连接，房间 ${currentRoom.code} 保持可用`);
        broadcast(currentRoom, {
          type: 'NOTIFICATION',
          message: '主持人暂时断开连接，请等待重连',
          notificationType: 'warning'
        });
      }
    }
    
    connections.delete(clientId);
  });
  
  ws.on('error', (error) => {
    console.error(`[错误] 客户端 ${clientId}:`, error);
  });
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[心跳] 客户端无响应，终止连接');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

process.on('SIGINT', () => {
  console.log('\n[系统] 正在关闭服务器...');
  clearInterval(heartbeat);
  wss.close(() => {
    console.log('[系统] 服务器已关闭');
    process.exit(0);
  });
});

// ============================================================
// 【技能验证和执行辅助函数】
// ============================================================

function validateSkillUse(player, gameState, skillType, targetId, locationId) {
  const round = gameState.round;
  
  console.log(`[validateSkillUse] 角色: ${player.role}, skillType: ${skillType}, 轮次: ${round}, 位置: ${player.currentLocation}`);
  
  // 标准化 skillType
  const normalizedSkillType = skillType?.toString().toLowerCase().trim();
  
  // 虚弱状态玩家不能使用需要生命值的技能
  if (player.isWeakened || player.health === 0) {
    if (player.role === 'killer' || player.role === 'murderer' || player.role === 'bad_fan') {
      return { valid: false, reason: '虚弱状态无法使用技能' };
    }
  }
  
  // 帮凶技能
  if (player.role === 'accomplice') {
    if (skillType === 'attack') {
      if (player.health <= 0 || player.isWeakened) {
        return { valid: false, reason: '生命值归零或虚弱状态，无法使用攻击技能' };
      }
      if (player.skillUseCount >= 1) {
        return { valid: false, reason: '攻击技能整局只能使用一次' };
      }
      return { valid: true };
    } else if (skillType === 'fire') {
      if (round !== 2 && round !== 4) {
        return { valid: false, reason: '放火只能在第2轮或第4轮使用' };
      }
      if (player.actionPoints < 1) {
        return { valid: false, reason: '行动点不足（需要1点）' };
      }
      if (!locationId) {
        return { valid: false, reason: '请选择放火地点' };
      }
      if (!fireableLocations.includes(locationId)) {
        return { valid: false, reason: '该地点不能放火（大厅和花园不能放火）' };
      }
      return { valid: true };
    } else {
      return { valid: false, reason: `帮凶未知的技能类型: ${skillType}` };
    }
  }
  
  // 侦探技能
  if (player.role === 'detective') {
    if (skillType === 'get_action_line' || skillType === 'check_role') {
      if (round < 3) {
        return { valid: false, reason: '第3轮开始才能使用' };
      }
      if (player.actionPoints < 1) {
        return { valid: false, reason: '行动点不足（需要1点）' };
      }
      if (player.skillUsedThisRound) {
        return { valid: false, reason: '本轮已使用过技能' };
      }
      if (!targetId) {
        return { valid: false, reason: '请选择要查验的目标' };
      }
      return { valid: true };
    } else {
      return { valid: false, reason: `侦探未知的技能类型: ${skillType}` };
    }
  }
  
  // 工程师技能 - 关键修复：支持多种 skillType 别名
  if (player.role === 'engineer') {
    // 支持多种可能的 skillType
    const validSkillTypes = ['power', 'repair', '供电', 'engineer', 'fix', 'light'];
    
    console.log(`[工程师技能] 检查 skillType: ${skillType}, 标准化: ${normalizedSkillType}`);
    console.log(`[工程师技能] 有效类型:`, validSkillTypes);
    console.log(`[工程师技能] 是否匹配:`, validSkillTypes.includes(normalizedSkillType));
    
    if (validSkillTypes.includes(normalizedSkillType) || validSkillTypes.includes(skillType)) {
      if (player.skillUsedThisRound) {
        return { valid: false, reason: '本轮已使用过技能' };
      }
      
      // 第1轮只能在地下室或阁楼使用
      if (round === 1) {
        const allowedFirstRoundRooms = ['basement_north', 'basement_south', 'basement_storage', 'attic_main', 'attic_therapy', 'attic_balcony'];
        if (!allowedFirstRoundRooms.includes(player.currentLocation)) {
          return { valid: false, reason: '第1轮只能在地下室或阁楼使用供电技能' };
        }
      }
      
      console.log(`[工程师技能] 验证通过`);
      return { valid: true };
    } else {
      return { valid: false, reason: `工程师未知的技能类型: ${skillType} (期望: power/repair/供电等)` };
    }
  }
  
  // 黑客技能
  if (player.role === 'hacker') {
    if (skillType === 'hack_score' || skillType === 'check_score') {
      if (player.skillUsedThisRound) {
        return { valid: false, reason: '本轮已使用过技能' };
      }
      if (player.actionPoints < 1) {
        return { valid: false, reason: '行动点不足（需要1点）' };
      }
      if (player.hasCheckedOthersScore && targetId !== player.id) {
        return { valid: false, reason: '你已经查看过他人分数' };
      }
      if (!targetId) {
        return { valid: false, reason: '请选择要查看的目标' };
      }
      return { valid: true };
    } else {
      return { valid: false, reason: `黑客未知的技能类型: ${skillType}` };
    }
  }
  
  // 医生技能
  if (player.role === 'doctor') {
    return { valid: false, reason: '医生技能为自动触发，无需手动使用' };
  }
  
  // 凶手/坏推理迷编造行动线
  if ((player.role === 'killer' || player.role === 'murderer' || player.role === 'bad_fan') && skillType === 'fake_action_line') {
    if (player.health <= 0 || player.isWeakened) {
      return { valid: false, reason: '生命值为0或虚弱状态无法使用' };
    }
    if (player.fakeActionLineCount <= 0) {
      return { valid: false, reason: '编造次数已用完' };
    }
    return { valid: true };
  }
  
  // 好推理迷获取行动线
  if (player.role === 'good_fan' && skillType === 'get_action_line') {
    if (player.actionPoints < 1) {
      return { valid: false, reason: '行动点不足（需要1点）' };
    }
    if (player.skillUsedThisRound) {
      return { valid: false, reason: '本轮已使用过技能' };
    }
    if (!targetId) {
      return { valid: false, reason: '请选择目标玩家' };
    }
    return { valid: true };
  }
  
  // 如果没有匹配到任何角色
  console.log(`[validateSkillUse] 未匹配到角色处理: ${player.role}, skillType: ${skillType}`);
  return { valid: false, reason: `角色 ${player.role} 没有匹配的技能验证，skillType: ${skillType}` };
}

function executeSkillEffect(player, gameState, skillType, targetId, locationId, additionalData) {
  const round = gameState.round;
  const normalizedSkillType = skillType?.toString().toLowerCase().trim();
  
  console.log(`[executeSkillEffect] 执行技能: ${skillType}, 角色: ${player.role}`);
  
  // 帮凶技能
  if (player.role === 'accomplice') {
    if (skillType === 'attack') {
      // 攻击在结算阶段处理，这里只记录
      return { success: true, message: '攻击标记已设置，将在结算阶段生效' };
    } else if (skillType === 'fire') {
      if (locationId && !gameState.fireLocations.includes(locationId)) {
        gameState.fireLocations.push(locationId);
        player.actionPoints -= 1;
        return { success: true, locationId, message: `在${locationId}放火成功` };
      }
    }
  }
  
  // 侦探技能
  if (player.role === 'detective') {
    if (skillType === 'get_action_line' || skillType === 'check_role') {
      const target = gameState.players.find(p => p.id === targetId);
      if (target) {
        player.actionPoints -= 1;
        // 返回目标上一轮的行动线
        return { 
          success: true, 
          targetId, 
          actionLine: target.actionLine,
          message: `查看了${target.name}的行动线`
        };
      }
    }
  }
  
  // 工程师技能 - 关键修复：正确的供电逻辑
  if (player.role === 'engineer') {
    const validSkillTypes = ['power', 'repair', '供电', 'engineer', 'fix', 'light'];
    
    if (validSkillTypes.includes(normalizedSkillType) || validSkillTypes.includes(skillType)) {
      // 获取当前所在楼层
      const currentLocation = player.currentLocation;
      let floor = null;
      let floorName = '';
      
      // 根据房间ID判断楼层
      if (currentLocation.startsWith('attic_')) {
        floor = 'attic';
        floorName = '阁楼';
      } else if (currentLocation.startsWith('second_')) {
        floor = 'second';
        floorName = '二楼';
      } else if (currentLocation.startsWith('first_')) {
        floor = 'first';
        floorName = '一楼';
      } else if (currentLocation.startsWith('basement_')) {
        floor = 'basement';
        floorName = '地下室';
      }
      
      if (!floor) {
        console.log(`[工程师技能] 无法识别楼层: ${currentLocation}`);
        return { success: false, reason: '无法识别当前楼层' };
      }
      
      console.log(`[工程师技能] 当前楼层: ${floor} (${floorName})`);
      
      // 将该楼层所有房间添加到亮灯列表
      const floorRooms = {
        'attic': ['attic_main', 'attic_therapy', 'attic_balcony'],
        'second': ['second_storage', 'second_control', 'second_tool', 'second_corridor', 'second_bedroom_b', 'second_bedroom_a', 'second_crime', 'second_balcony_north', 'second_balcony'],
        'first': ['first_dining', 'first_crime', 'first_corridor', 'first_living_b', 'first_living_a', 'first_cloakroom', 'first_hall', 'first_garden_north', 'first_garden_east', 'first_garden_south'],
        'basement': ['basement_north', 'basement_south', 'basement_storage']
      };
      
      const roomsToLight = floorRooms[floor] || [];
      
      // 将这些房间添加到亮灯列表（如果还没有的话）
      let addedCount = 0;
      roomsToLight.forEach(roomId => {
        if (!gameState.lightLocations.includes(roomId)) {
          gameState.lightLocations.push(roomId);
          addedCount++;
        }
      });
      
      // 标记工程师已修复该楼层
      if (!gameState.engineerRepaired) {
        gameState.engineerRepaired = {};
      }
      gameState.engineerRepaired[floor] = true;
      
      console.log(`[工程师技能] 成功修复 ${floorName}, 亮灯房间: ${roomsToLight.length} 个`);
      
      return { 
        success: true, 
        floor: floor,
        floorName: floorName,
        lightLocations: roomsToLight,
        addedCount: addedCount,
        message: `修复了${floorName}的电路，该楼层已亮灯`
      };
    }
  }
  
  // 黑客技能
  if (player.role === 'hacker') {
    if (skillType === 'hack_score' || skillType === 'check_score') {
      const target = gameState.players.find(p => p.id === targetId);
      if (target) {
        player.actionPoints -= 1;
        if (targetId !== player.id) {
          player.hasCheckedOthersScore = true;
        }
        return { 
          success: true, 
          targetId, 
          score: target.score, 
          role: target.role,
          message: `查看了${target.name}的分数：${target.score}`
        };
      }
    }
  }
  
  // 医生技能 - 自动触发，在结算阶段处理
  if (player.role === 'doctor') {
    return { success: false, reason: '医生技能为自动触发' };
  }
  
  // 好推理迷获取行动线
  if (player.role === 'good_fan' && skillType === 'get_action_line') {
    const target = gameState.players.find(p => p.id === targetId);
    if (target) {
      player.actionPoints -= 1;
      return {
        success: true,
        targetId,
        actionLine: target.actionLine,
        message: `获取了${target.name}的行动线`
      };
    }
  }
  
  console.log(`[executeSkillEffect] 未匹配到技能执行: ${skillType}, 角色: ${player.role}`);
  return { success: false, reason: '技能执行失败' };
}

function getSkillChoiceName(skillChoice) {
  const names = {
    'action_line': '查验行动线',
    'vote_2': '投凶（2票权重）',
    'attack_fake': '虚假行动线',
    'vote_1': '投凶（1票权重）'
  };
  return names[skillChoice] || skillChoice;
}

// 跳楼消耗计算（带绳索）
function getJumpCostWithRope(from, to, hasRope) {
  if (!hasRope) return { healthCost: jumpRooms[from]?.healthCost || 1 };
  
  const jumpConfig = jumpRooms[from];
  if (jumpConfig && jumpConfig.targets.includes(to)) {
    return { healthCost: 0 }; // 有绳索免除伤害
  }
  
  return { healthCost: jumpConfig?.healthCost || 1 };
}
