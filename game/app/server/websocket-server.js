/**
 * ============================================================
 * 暴风雪山庄游戏系统 - WebSocket服务器
 * ============================================================
 */

const WebSocket = require('ws');
const http = require('http');

// ============================================================
// 【配置区域】
// ============================================================
const PORT = 8080;
const HEARTBEAT_INTERVAL = 30000;

// ============================================================
// 【全局状态】
// ============================================================
const rooms = new Map();
const connections = new Map();

// ============================================================
// 【工具函数】
// ============================================================
function generateId() {
  return Math.random().toString(36).substring(2, 10);
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

// ============================================================
// 【游戏逻辑】
// ============================================================
function createRoom(hostId) {
  const roomCode = generateRoomCode();
  const room = {
    code: roomCode,
    hostId: hostId,
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
      votes: [],
      tradeRequests: [],
      voteRecords: []
    },
    clients: new Set(),
    createdAt: Date.now()
  };
  rooms.set(roomCode, room);
  return room;
}

function joinRoom(roomCode, ws) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  
  if (room.gameState.players.length >= 10) {
    return { error: '房间已满' };
  }
  
  if (room.gameState.phase !== 'config' && room.gameState.phase !== 'lobby') {
    return { error: '游戏已开始，无法加入' };
  }
  
  const playerId = generateId();
  const playerNumber = room.gameState.players.length + 1;
  const playerName = `${playerNumber}号玩家`;
  
  const player = {
    id: playerId,
    name: playerName,
    role: 'fan',
    camp: 'neutral',
    health: 3,
    maxHealth: 3,
    actionPoints: 8,
    currentLocation: '',
    actionLine: [],
    items: [],
    score: 0,
    isAlive: true,
    isExposed: false,
    visitedLocations: [],
    canUseSkill: true,
    skillUsedThisRound: false,
    fakeActionLineCount: 0,
    fireCount: 0,
    hasCheckedFan: false,
    totalVotesCorrect: 0,
    ws: ws
  };
  
  room.gameState.players.push(player);
  room.clients.add(ws);
  
  return player;
}

function setPlayerRole(room, playerId, role) {
  const player = room.gameState.players.find(p => p.id === playerId);
  if (!player) return false;
  
  player.role = role;
  
  const killerRoles = ['killer', 'accomplice', 'bad_fan'];
  const detectiveRoles = ['detective', 'engineer', 'hacker', 'doctor', 'good_fan'];
  
  if (killerRoles.includes(role)) {
    player.camp = 'killer';
    player.score = 1;
  } else if (detectiveRoles.includes(role)) {
    player.camp = 'detective';
    player.score = role === 'detective' ? 2 : 1;
  } else {
    player.camp = 'neutral';
    player.score = 0;
  }
  
  if (role === 'killer') {
    player.fakeActionLineCount = 2;
  } else if (role === 'accomplice') {
    player.fireCount = 2;
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
  
  state.players = state.players.map(p => {
    delete p.ws;
    const isSelf = p.id === requesterId;
    
    if (isHost || isSelf) {
      return p;
    } else {
      return {
        id: p.id,
        name: p.name,
        role: 'unknown',
        camp: 'unknown',
        health: p.health,
        maxHealth: p.maxHealth,
        isAlive: p.isAlive,
        score: p.score,
        currentLocation: p.currentLocation,
        actionPoints: p.actionPoints,
        items: [],
        actionLine: [],
        visitedLocations: p.visitedLocations,
        isExposed: p.isExposed
      };
    }
  });
  
  return state;
}

// ============================================================
// 【WebSocket服务器】
// ============================================================
const server = http.createServer();
const wss = new WebSocket.Server({ server });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║       暴风雪山庄游戏系统 - WebSocket服务器               ║`);
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
  
  ws.isAlive = true;
  
  console.log(`[连接] 新客户端连接: ${clientId} (${req.socket.remoteAddress})`);
  
  sendToPlayer(ws, {
    type: 'CONNECTED',
    clientId: clientId,
    message: '已连接到服务器'
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
          const room = createRoom(clientId);
          currentRoom = room;
          currentPlayerId = clientId; 
          room.hostId = clientId;
          room.clients.add(ws);
          
          sendToPlayer(ws, {
            type: 'ROOM_CREATED',
            roomCode: room.code,
            isHost: true,
            gameState: getSanitizedGameState(room, clientId)
          });
          
          console.log(`[房间] 创建成功: ${room.code}`);
          break;
        }
        
case 'JOIN_ROOM': {
  const room = rooms.get(message.roomCode);
  
  if (!room) {
    console.log(`[错误] 房间不存在: ${message.roomCode}`);
    sendToPlayer(ws, {
      type: 'ERROR',
      message: '房间不存在，请检查房间码或重新创建房间',
      errorCode: 'ROOM_NOT_FOUND'
    });
    break;
  }
  
  // 检查是否是断线重连（客户端发送了之前的 playerId）
  let player = null;
  if (message.playerId) {
    const existingPlayer = room.gameState.players.find(p => p.id === message.playerId);
    if (existingPlayer) {
      console.log(`[重连] 玩家 ${existingPlayer.name} (${message.playerId}) 重新连接`);
      
      // 更新 WebSocket 连接
      existingPlayer.ws = ws;
      
      // 从旧连接中移除（如果有）
      room.clients.forEach(client => {
        // 清理旧的断开连接
      });
      room.clients.add(ws);
      
      currentRoom = room;
      currentPlayerId = existingPlayer.id;
      
      sendToPlayer(ws, {
        type: 'ROOM_JOINED',
        roomCode: room.code,
        playerId: existingPlayer.id,
        playerName: existingPlayer.name,
        isReconnected: true, // 标记为重连
        gameState: getSanitizedGameState(room, existingPlayer.id)
      });
      
      // 通知其他玩家该玩家已重新连接
      broadcast(room, {
        type: 'NOTIFICATION',
        message: `${existingPlayer.name} 重新连接`,
        notificationType: 'info'
      }, ws);
      
      break; // 重连成功，跳出 case
    }
  }
  
  // 新玩家加入
  player = joinRoom(message.roomCode, ws);
          
          if (player.error) {
            sendToPlayer(ws, {
              type: 'ERROR',
              message: player.error
            });
            break;
          }
          
          currentRoom = room;
          currentPlayerId = player.id;
          
          sendToPlayer(ws, {
            type: 'ROOM_JOINED',
            roomCode: room.code,
            playerId: player.id,
            playerName: player.name,
            gameState: getSanitizedGameState(room, player.id)
          });
          
          broadcast(room, {
            type: 'GAME_STATE',
            state: getSanitizedGameState(room, room.hostId),
            message: `${player.name} 加入了房间`
          });
          
          console.log(`[房间] ${player.name} 加入房间 ${room.code}，当前${room.gameState.players.length}人`);
          break;
        }
        
        case 'SET_ROLE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          if (currentPlayerId !== currentRoom.hostId) {
            sendToPlayer(ws, { type: 'ERROR', message: '只有主持人可以设置身份' });
            break;
          }
          
          setPlayerRole(currentRoom, message.playerId, message.role);
          
          broadcast(currentRoom, {
            type: 'GAME_STATE',
            state: getSanitizedGameState(currentRoom, currentPlayerId)
          });
          
          console.log(`[身份] 设置 ${message.playerId} 为 ${message.role}`);
          break;
        }
        
        case 'START_GAME': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          if (currentPlayerId !== currentRoom.hostId) {
            sendToPlayer(ws, { type: 'ERROR', message: '只有主持人可以开始游戏' });
            break;
          }
          
          currentRoom.gameState.phase = 'action';
          currentRoom.gameState.round = 1;
          
          broadcast(currentRoom, {
            type: 'GAME_STARTED',
            state: getSanitizedGameState(currentRoom, currentPlayerId)
          });
          
          console.log(`[游戏] 房间 ${currentRoom.code} 游戏开始`);
          break;
        }
        
        case 'PLAYER_ACTION': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          const player = currentRoom.gameState.players.find(p => p.id === currentPlayerId);
          if (!player) {
            sendToPlayer(ws, { type: 'ERROR', message: '玩家不存在' });
            break;
          }
          
          if (message.action === 'MOVE') {
            player.currentLocation = message.locationId;
            if (!player.visitedLocations.includes(message.locationId)) {
              player.visitedLocations.push(message.locationId);
            }
            
            player.actionLine.push({
              step: player.actionLine.length + 1,
              locationId: message.locationId,
              action: 'move'
            });
          }
          
          broadcast(currentRoom, {
            type: 'PLAYER_ACTION_DONE',
            playerId: currentPlayerId,
            action: message.action,
            state: getSanitizedGameState(currentRoom, currentPlayerId)
          });
          
          break;
        }
        
        case 'VOTE': {
          if (!currentRoom) {
            sendToPlayer(ws, { type: 'ERROR', message: '未加入房间' });
            break;
          }
          
          if (currentRoom.gameState.round < 2) {
            sendToPlayer(ws, { type: 'ERROR', message: '第二轮开始才能投凶' });
            break;
          }
          
          const player = currentRoom.gameState.players.find(p => p.id === currentPlayerId);
          if (!player || !player.isAlive) {
            sendToPlayer(ws, { type: 'ERROR', message: '无法投凶' });
            break;
          }
          
          currentRoom.gameState.votes[currentPlayerId] = message.targetId;
          player.votesThisRound = message.targetId;
          
          sendToPlayer(ws, {
            type: 'VOTE_SUCCESS',
            message: '投凶成功'
          });
          
          const host = currentRoom.gameState.players.find(p => p.id === currentRoom.hostId);
          if (host && host.ws) {
            sendToPlayer(host.ws, {
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
          
          if (!fromPlayer.items.includes(message.offerItem)) {
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
          
          if (toPlayer.ws) {
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
          
          if (fromPlayer.ws) {
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
          
          if (currentPlayerId !== currentRoom.hostId) {
            sendToPlayer(ws, { type: 'ERROR', message: '只有主持人可以控制流程' });
            break;
          }
          
          const state = currentRoom.gameState;
          
          if (state.phase === 'free') {
            state.phase = 'action';
          } else if (state.phase === 'action') {
            state.phase = 'settlement';
          } else if (state.phase === 'settlement') {
            if (state.round >= 5) {
              state.phase = 'ended';
            } else {
              state.round++;
              state.phase = 'free';
              
              state.players.forEach(p => {
                p.actionPoints = p.isAlive ? 8 : 4;
                p.actionLine = [];
                p.skillUsedThisRound = false;
                p.votesThisRound = null;
              });
              
              state.votes = [];
            }
          }
          
          broadcast(currentRoom, {
            type: 'PHASE_CHANGED',
            phase: state.phase,
            round: state.round,
            state: getSanitizedGameState(currentRoom, currentPlayerId)
          });
          
          console.log(`[流程] 进入 ${state.phase} 阶段，第 ${state.round} 轮`);
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
      
      if (currentPlayerId === currentRoom.hostId) {
        broadcast(currentRoom, {
          type: 'NOTIFICATION',
          message: '主持人已断开连接',
          notificationType: 'warning'
        });
      }
      
      if (currentRoom.clients.size === 0) {
        rooms.delete(currentRoom.code);
        console.log(`[房间] ${currentRoom.code} 已删除（无人）`);
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