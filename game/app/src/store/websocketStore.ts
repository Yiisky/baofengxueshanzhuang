// src/store/websocketStore.ts
// 完整的 WebSocket Store 实现，支持主持人重连和历史数据

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { 
  GameState, 
  RoleType, 
  ActionStep, 
  ActionStepDetail, 
  ItemType, 
  SettlementInfo,
  Player
} from '@/types/game';
import type { RoundHistory } from '@/types/roundTabs';
import { locations } from '@/data/locations';

function getCampFromRole(role: string): string {
  const killerRoles = ['killer', 'murderer', 'bad_fan', 'accomplice'];
  const detectiveRoles = ['detective', 'engineer', 'hacker', 'doctor', 'good_fan'];
  
  if (killerRoles.includes(role)) return 'killer';
  if (detectiveRoles.includes(role)) return 'detective';
  return 'neutral';
}

function extractPlayerNumber(name: string): number {
  if (!name) return 0;
  const match = name.match(/(\d+)号玩家/);
  return match ? parseInt(match[1], 10) : 0;
}

// 自动获取服务器地址
const getServerUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:8080';
  
  const hostname = window.location.hostname;
  const port = '8080';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  return `${protocol}//${hostname}:${port}`;
};

const SERVER_URL = getServerUrl();

console.log('[WebSocket] 自动获取服务器地址:', SERVER_URL);

const initialState: GameState = {
  id: '',
  roomCode: '',
  round: 1,
  phase: 'lobby',
  players: [],
  locations: locations,
  fireLocations: [],
  lightLocations: [],
  currentPlayerIndex: 0,
  votes: {},
  voteRecords: [],
  tradeRequests: [],
  settings: {
    allowRoleReveal: false,
    timeLimit: 0
  },
  skillRecords: [],
  hackerChecks: new Map(),
  powderTarget: undefined,
  detectiveTarget: undefined,
  hostId: undefined
};

let globalState: GameState = { ...initialState };
let myPlayerId: string = '';
let myHostId: string = '';
let listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function useWebSocketStore() {
  const { isConnected, sendMessage, lastMessage, error, reconnect } = useWebSocket(SERVER_URL);
  const [, forceUpdate] = useState({});
  const roomCodeResolveRef = useRef<((code: string) => void) | null>(null);
  
  // 重连状态跟踪
  const hasReconnectedRef = useRef(false);
  const isReconnectingRef = useRef(false);
  
  // 历史数据存储
  const [roundHistories, setRoundHistories] = useState<RoundHistory[]>([]);
  
  // ===== 关键修复：从 URL 参数或 localStorage 获取房间码 =====
  const getRoomCodeFromUrlOrStorage = useCallback((): string | null => {
    // 首先尝试从 URL 参数获取
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roomCodeFromUrl = urlParams.get('room');
      if (roomCodeFromUrl) {
        console.log('[Store] 从 URL 获取房间码:', roomCodeFromUrl);
        return roomCodeFromUrl;
      }
    }
    
    // 其次从 localStorage 获取
    const roomCodeFromStorage = localStorage.getItem('roomCode');
    if (roomCodeFromStorage) {
      console.log('[Store] 从 localStorage 获取房间码:', roomCodeFromStorage);
      return roomCodeFromStorage;
    }
    
    return null;
  }, []);

  // 增强自动重连逻辑，区分主持人和普通玩家
  useEffect(() => {
    // 关键修复：只有当连接状态从 false 变为 true 时才触发重连
    // 使用 ref 记录上一次的连接状态
    const wasConnected = hasReconnectedRef.current;
    
    const checkAndReconnect = () => {
      // 防止重复执行
      if (isReconnectingRef.current) {
        console.log('[Store] 正在重连中，跳过');
        return;
      }
      
      // 关键修复：如果已经重连成功过，不再重复重连
      if (hasReconnectedRef.current) {
        console.log('[Store] 已经重连成功，跳过');
        return;
      }
      
      // 关键修复：优先从 URL 参数获取房间码
      const savedRoomCode = getRoomCodeFromUrlOrStorage();
      const savedPlayerId = localStorage.getItem('myPlayerId');
      const savedHostId = localStorage.getItem('hostPlayerId');
      const savedIsHost = localStorage.getItem('isHost') === 'true';
      
      // 关键修复：优先使用 localStorage 中的 isHost 标记来判断
      // 其次才用 playerId === hostId 来判断
      let isHostReconnect = false;
      if (savedIsHost && savedHostId) {
        isHostReconnect = true;
      } else if (savedPlayerId && savedHostId && savedPlayerId === savedHostId) {
        isHostReconnect = true;
      }
      
      console.log('[Store] 检查重连:', { 
        savedRoomCode, 
        savedPlayerId, 
        savedHostId, 
        savedIsHost,
        isHostReconnect,
        hasReconnected: hasReconnectedRef.current,
        isConnected,
        myHostId,
        myPlayerId
      });

      if (savedRoomCode && savedPlayerId && isConnected) {
        isReconnectingRef.current = true;
        console.log('[Store] 开始重连:', isHostReconnect ? '主持人' : '普通玩家');
        
        if (isHostReconnect) {
          // 主持人重连：使用 RECONNECT_HOST
          // 关键修复：使用 savedHostId 而不是 savedPlayerId
          const hostIdToUse = savedHostId || savedPlayerId;
          
          sendMessage({
            type: 'RECONNECT_HOST',
            roomCode: savedRoomCode,
            hostPlayerId: hostIdToUse
          });
          
          // 立即更新全局变量，不要等待服务器响应
          myHostId = hostIdToUse;
          myPlayerId = hostIdToUse;
          
          console.log('[Store] 主持人身份已设置:', { myHostId, myPlayerId });
        } else {
          // 普通玩家重连
          sendMessage({
            type: 'JOIN_ROOM',
            roomCode: savedRoomCode,
            playerId: savedPlayerId,
            isReconnect: true
          });
          
          myPlayerId = savedPlayerId;
          if (savedHostId) {
            myHostId = savedHostId;
          }
        }
        
        // 5秒后如果还没收到响应，允许再次重连
        setTimeout(() => {
          isReconnectingRef.current = false;
        }, 5000);
      } else {
        console.log('[Store] 不满足重连条件:', { 
          hasRoomCode: !!savedRoomCode, 
          hasPlayerId: !!savedPlayerId, 
          isConnected 
        });
      }
    };

    // 只在连接成功时触发一次
    if (isConnected && !wasConnected) {
      console.log('[Store] WebSocket 已连接，准备检查重连');
      // 延迟执行，确保连接稳定
      const timer = setTimeout(checkAndReconnect, 800);
      return () => clearTimeout(timer);
    }
  }, [isConnected, sendMessage, getRoomCodeFromUrlOrStorage]);
  
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    console.log('[Store] 收到消息:', lastMessage.type, lastMessage);

    let message: any = lastMessage;
    
    if (typeof lastMessage === 'string') {
      try {
        message = JSON.parse(lastMessage);
      } catch (e) {
        console.error('[Store] 解析消息失败:', e);
        return;
      }
    }

    if (typeof message === 'string') {
      try {
        message = JSON.parse(message);
      } catch (e) {
        // 不是JSON，保持原样
      }
    }

    if (!message || !message.type) {
      console.warn('[Store] 收到无效消息格式:', message);
      return;
    }

    switch (message.type) {
      case 'SET_ROLE':
        console.log('[Store] 角色设置:', message.playerId, '->', message.role);
        if (message.state || message.gameState) {
          const newState = message.state || message.gameState;
          
          // 更新全局状态中的玩家角色
          if (newState.players) {
            globalState.players = newState.players.map((p: Player) => ({
              ...p,
              number: (p as any).number || extractPlayerNumber(p.name) || 0,
            }));
          }
          
          // 关键修复：如果这是当前玩家的角色更新，保存到 localStorage
          if (message.playerId === myPlayerId && message.role) {
            localStorage.setItem('myRole', message.role);
            console.log('[Store] 保存自己的角色到 localStorage:', message.role);
          }
          
          globalState = { ...globalState, ...newState };
          notifyListeners();
        }
        break;

      case 'CONNECTED':
        console.log('[Store] Connected to server, clientId:', message.clientId);
        // 连接成功后重置重连标记，但保留到下次连接变化
        if (message.serverRestarted) {
          hasReconnectedRef.current = false;
        }
        break;

      case 'ROOM_CREATED':
        console.log('[Store] 房间创建成功:', message.roomCode);
        
        // 关键修复：确保使用完整的 ID
        const fullHostId = message.hostPlayerId || message.playerId || message.clientId;
        
        if (!fullHostId || fullHostId.length < 10) {
          console.error('[Store] 收到不完整的 hostPlayerId:', fullHostId);
        }
        
        myPlayerId = fullHostId;
        myHostId = message.hostPlayerId || fullHostId;
        
        // 存储到 localStorage
        if (myPlayerId) {
          localStorage.setItem('myPlayerId', myPlayerId);
        }
        if (myHostId) {
          localStorage.setItem('hostPlayerId', myHostId);
        }
        localStorage.setItem('isHost', 'true');
        
        console.log('[Store] 主持人身份已设置:', { myHostId, myPlayerId, length: myHostId?.length });
        hasReconnectedRef.current = true; // 创建房间也算"已连接"
        
        if (message.roomCode) {
          globalState.roomCode = message.roomCode;
          localStorage.setItem('roomCode', message.roomCode);
          
          // 关键修复：更新 URL 参数
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('room', message.roomCode);
            window.history.replaceState({}, '', url.toString());
          }
        }
        
        if (message.gameState) {
          globalState = { ...globalState, ...message.gameState };
        }
        
        notifyListeners();
        
        if (roomCodeResolveRef.current && message.roomCode) {
          roomCodeResolveRef.current(message.roomCode);
          roomCodeResolveRef.current = null;
        }
        break;

      case 'SKILL_USED':
        console.log('[Store] 技能使用成功:', message.skillType);
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
        }
        notifyListeners();
        break;

      case 'FAKE_ACTION_LINE_SET':
        console.log('[Store] 虚假行动线设置成功，剩余次数:', message.remainingUses);
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
        }
        notifyListeners();
        break;

      case 'FAN_TRANSFORMED':
        console.log('[Store] 推理迷转变身份:', message.success ? '成功' : '失败');
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
        }
        notifyListeners();
        break;

      case 'FAN_SKILL_CHOSEN':
        console.log('[Store] 推理迷选择技能:', message.skillChoice);
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
        }
        notifyListeners();
        break;

      case 'ACTION_LINE_REVEALED':
        console.log('[Store] 行动线已揭示');
        break;
           
      case 'ROOM_JOINED':
        console.log('[Store] 房间加入成功:', {
          playerId: message.playerId,
          player: message.player,
          roomCode: message.roomCode,
          isHost: message.isHost,
          isReconnected: message.isReconnected
        });
        
        // 关键修复：优先使用 message.player 中的完整数据（包含 role 和 number）
        const joinedPlayerData = message.player || {};
        // 关键修复：优先使用 message.player.id，因为 server 在 JOIN_ROOM 中返回的 player 对象包含完整数据
        const receivedPlayerId = joinedPlayerData.id || message.playerId;
        
        // 关键修复：立即设置 myPlayerId 和更新全局变量
        if (receivedPlayerId) {
          myPlayerId = receivedPlayerId;
          localStorage.setItem('myPlayerId', receivedPlayerId);
          // 关键修复：设置全局变量供 usePlayerPanel 使用
          (window as any).__MY_PLAYER_ID__ = receivedPlayerId;
          console.log('[Store] playerId 已保存:', receivedPlayerId);
        } else {
          console.error('[Store] ROOM_JOINED 中没有 playerId!', message);
        }
        
        // 关键修复：如果服务器返回了角色，保存到 localStorage
        if (joinedPlayerData.role && joinedPlayerData.role !== 'unknown') {
          localStorage.setItem('myRole', joinedPlayerData.role);
          console.log('[Store] 角色已保存到 localStorage:', joinedPlayerData.role);
        }
        
        // 关键修复：如果服务器返回了玩家名称，保存到 localStorage
        // 优先使用服务器返回的 name，但如果没有，根据 number 生成
        let playerName = joinedPlayerData.name;
        if (!playerName && joinedPlayerData.number) {
          playerName = `${joinedPlayerData.number}号玩家`;
        }
        if (playerName) {
          localStorage.setItem('myPlayerName', playerName);
          console.log('[Store] 玩家名称已保存:', playerName);
        }
        
        // 关键修复：如果服务器返回了 number，保存到 localStorage
        if (joinedPlayerData.number) {
          localStorage.setItem('myPlayerNumber', String(joinedPlayerData.number));
        }
        
        // 深度克隆游戏状态 - 关键修复：确保 role 和 number 字段正确
        if (message.gameState) {
          const newPlayers = message.gameState.players ? message.gameState.players.map((p: Player) => {
            // 如果是当前加入的玩家，使用服务器返回的完整 player 数据（包含真实 role）
            const isCurrentPlayer = p.id === receivedPlayerId;
            const playerData = isCurrentPlayer && joinedPlayerData.number ? joinedPlayerData : p;
            
            // 关键修复：确保当前玩家的 name 和 number 正确
            let effectiveName = playerData.name || p.name;
            let effectiveNumber = playerData.number || (p as any).number || extractPlayerNumber(p.name) || 0;
            
            // 如果是当前玩家，强制使用服务器返回的数据
            if (isCurrentPlayer) {
              effectiveName = playerName || effectiveName;
              effectiveNumber = joinedPlayerData.number || effectiveNumber;
            }
            
            return {
              ...p,
              // 关键修复：优先使用服务器返回的 role，而不是 'unknown'
              role: playerData.role || p.role || 'unknown',
              camp: playerData.camp || p.camp || 'neutral',
              // 关键修复：确保 number 字段正确
              number: effectiveNumber,
              // 关键修复：确保 name 字段正确
              name: effectiveName,
              id: p.id, // 保持ID不变
            };
          }) : [];
          
          globalState = { 
            ...globalState, 
            ...message.gameState,
            players: newPlayers
          };
        }
        
        // 处理主持人身份
        if (message.isHost) {
          myHostId = receivedPlayerId;
          localStorage.setItem('hostPlayerId', myHostId);
          localStorage.setItem('isHost', 'true');
        } else {
          const hostId = message.hostId || message.hostPlayerId;
          if (hostId) {
            myHostId = hostId;
            localStorage.setItem('hostPlayerId', myHostId);
            localStorage.setItem('isHost', 'false');
          }
        }
        
        if (message.roomCode) {
          localStorage.setItem('roomCode', message.roomCode);
          globalState.roomCode = message.roomCode;
          
          // 关键修复：更新 URL 参数
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('room', message.roomCode);
            window.history.replaceState({}, '', url.toString());
          }
        }
        
        // 标记重连成功
        if (message.isReconnected) {
          hasReconnectedRef.current = true;
          isReconnectingRef.current = false;
        }
        
        // 强制多次通知确保更新
        notifyListeners();
        setTimeout(() => notifyListeners(), 50);
        setTimeout(() => notifyListeners(), 150);
        
        console.log('[Store] ROOM_JOINED 处理完成, 当前状态:', {
          myPlayerId,
          myHostId,
          roomCode: globalState.roomCode,
          playersCount: globalState.players.length
        });
        break;
        
      case 'RECONNECT_HOST_SUCCESS':
        console.log('[Store] 主持人重连成功:', message.hostPlayerId);
        
        // 关键修复：验证并设置完整的 ID
        const fullReconnectHostId = message.hostPlayerId || myHostId || myPlayerId;
        
        myPlayerId = fullReconnectHostId;
        myHostId = fullReconnectHostId;
        
        // 保存到 localStorage
        localStorage.setItem('myPlayerId', myPlayerId);
        localStorage.setItem('hostPlayerId', myHostId);
        localStorage.setItem('isHost', 'true');
        
        console.log('[Store] 主持人身份已更新:', { myHostId, length: myHostId?.length });        
        // 标记重连成功，防止重复重连
        hasReconnectedRef.current = true;
        isReconnectingRef.current = false;
        
        // 保存历史数据
        if (message.roundHistories) {
          setRoundHistories(message.roundHistories);
        }
        
        if (message.gameState) {
          globalState = { ...globalState, ...message.gameState };
          if (message.roomCode) {
            globalState.roomCode = message.roomCode;
            localStorage.setItem('roomCode', message.roomCode);
            
            // 关键修复：更新 URL 参数
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('room', message.roomCode);
              window.history.replaceState({}, '', url.toString());
            }
          }
        }
        
        notifyListeners();
        break;

      case 'GAME_STARTED':
        console.log('[Store] 游戏开始消息:', message.yourRole, message.yourNumber, 'playerId:', message.playerId);
        
        // 关键修复：更新 myPlayerId（如果服务器返回了）
        if (message.playerId) {
          myPlayerId = message.playerId;
          localStorage.setItem('myPlayerId', message.playerId);
          (window as any).__MY_PLAYER_ID__ = message.playerId;
          console.log('[Store] GAME_STARTED 中 playerId 已更新:', message.playerId);
        }
        
        // 关键修复：保存角色信息
        if (message.yourRole) {
          localStorage.setItem('myRole', message.yourRole);
          console.log('[Store] GAME_STARTED 中角色已保存:', message.yourRole);
        }
        
        // 关键修复：保存玩家编号
        if (message.yourNumber) {
          localStorage.setItem('myPlayerNumber', String(message.yourNumber));
        }
        
        if (message.state || message.gameState) {
          const newState = message.state || message.gameState;
          
          // 关键修复：使用服务器返回的 yourRole 和 yourNumber 更新当前玩家数据
          const serverRole = message.yourRole;
          const serverNumber = message.yourNumber;
          // 关键修复：使用已更新的 myPlayerId
          const serverPlayerId = myPlayerId || message.playerId;
          
          // 关键修复：如果服务器返回了 playerId，使用它
          if (message.playerId && !myPlayerId) {
            myPlayerId = message.playerId;
            localStorage.setItem('myPlayerId', message.playerId);
            (window as any).__MY_PLAYER_ID__ = message.playerId;
          }
          
          // 深拷贝并确保每个玩家对象的 number 和 role 字段正确
          const newPlayers = newState.players ? newState.players.map((p: Player) => {
            const isCurrentPlayer = p.id === serverPlayerId;
            
            return {
              ...p,
              // 关键修复：如果是当前玩家，使用服务器返回的真实 role
              role: isCurrentPlayer && serverRole ? serverRole : (p.role || 'unknown'),
              // 关键修复：确保 number 字段正确，优先使用服务器返回的
              number: isCurrentPlayer && serverNumber ? serverNumber : ((p as any).number || extractPlayerNumber(p.name) || 0),
              // 关键修复：确保 camp 字段也同步
              camp: isCurrentPlayer && serverRole ? getCampFromRole(serverRole) : (p.camp || 'neutral'),
            };
          }) : globalState.players;    
          
          // 关键修复：强制使用服务器返回的 phase 和 round
          globalState = { 
            ...globalState, 
            ...newState,
            phase: newState.phase || 'action',
            round: newState.round || 1,
            players: newPlayers
          };
          
          if (newState.roomCode) {
            globalState.roomCode = newState.roomCode;
          }
          
          // 关键修复：更新 hostId
          if (newState.hostId) {
            myHostId = newState.hostId;
            localStorage.setItem('hostPlayerId', myHostId);
          }
          
          console.log(`[Store] GAME_STARTED 更新，玩家数:`, globalState.players?.length, '阶段:', globalState.phase, '我的角色:', serverRole, '我的编号:', serverNumber);
        }
        
        // 关键修复：强制触发多次通知
        notifyListeners();
        setTimeout(() => notifyListeners(), 100);
        setTimeout(() => notifyListeners(), 300);
        break;

      case 'GAME_STATE':
        console.log('[Store] GAME_STATE 消息:', message.playerId, message.isHost);
        
        if (message.state || message.gameState) {
          const newState = message.state || message.gameState;
          
          // 关键修复：深拷贝并确保每个玩家对象的 number 字段
          const newPlayers = newState.players ? newState.players.map((p: Player) => ({
            ...p,
            // 确保 number 字段存在且有效（使用类型断言）
            number: (p as any).number || extractPlayerNumber(p.name) || 0,
            // 确保 role 字段有效
            role: p.role || 'unknown',
          })) : globalState.players;
          
          // 关键修复：强制使用服务器返回的 phase 和 round
          globalState = { 
            ...globalState, 
            ...newState,
            phase: newState.phase || globalState.phase, // 确保 phase 被更新
            round: newState.round || globalState.round, // 确保 round 被更新
            players: newPlayers
          };
          
          if (newState.roomCode) {
            globalState.roomCode = newState.roomCode;
          }
          // 更新 hostId 如果服务器返回了
          if (newState.hostId) {
            myHostId = newState.hostId;
            localStorage.setItem('hostPlayerId', myHostId);
          }
          
          console.log(`[Store] ${message.type} 更新，玩家数:`, globalState.players?.length, '阶段:', globalState.phase, '轮次:', globalState.round);
        }
        
        // 关键修复：强制触发通知，确保所有监听组件更新
        notifyListeners();
        break;
        
      case 'PHASE_CHANGED':
        if (message.state || message.gameState) {
          const newState = message.state || message.gameState;
          
          // 关键修复：深拷贝并确保每个玩家对象的 number 字段
          const newPlayers = newState.players ? newState.players.map((p: Player) => ({
            ...p,
            // 确保 number 字段存在且有效（使用类型断言）
            number: (p as any).number || extractPlayerNumber(p.name) || 0,
            // 确保 role 字段有效
            role: p.role || 'unknown',
          })) : globalState.players;
          
          // 关键修复：强制使用服务器返回的 phase 和 round
          globalState = { 
            ...globalState, 
            ...newState,
            phase: newState.phase || globalState.phase, // 确保 phase 被更新
            round: newState.round || globalState.round, // 确保 round 被更新
            players: newPlayers
          };
          
          if (newState.roomCode) {
            globalState.roomCode = newState.roomCode;
          }
          // 更新 hostId 如果服务器返回了
          if (newState.hostId) {
            myHostId = newState.hostId;
            localStorage.setItem('hostPlayerId', myHostId);
          }
          
          // 更新历史数据
          if (newState.roundHistories) {
            setRoundHistories(newState.roundHistories);
          }
          
          console.log(`[Store] ${message.type} 更新，玩家数:`, globalState.players?.length, '阶段:', globalState.phase, '轮次:', globalState.round);
        }
        
        // 关键修复：强制触发通知，确保所有监听组件更新
        notifyListeners();
        
        // 关键修复：对于 GAME_STARTED，多次触发通知确保页面切换
        if (message.type === 'GAME_STARTED') {
          // 立即通知
          notifyListeners();
          // 延迟再次通知以确保 React 重新渲染
          setTimeout(() => {
            notifyListeners();
            console.log('[Store] GAME_STARTED 延迟通知，当前阶段:', globalState.phase);
          }, 100);
          setTimeout(() => {
            notifyListeners();
            console.log('[Store] GAME_STARTED 二次延迟通知，当前阶段:', globalState.phase);
          }, 300);
        }
        break;

      case 'PLAYER_JOINED':
        console.log('[Store] 玩家加入:', message.player?.name || message.playerName, '当前玩家数:', globalState.players?.length);
        
        // 关键修复：强制更新玩家列表，确保新玩家被添加到全局状态
        if (message.gameState || message.state) {
          const newState = message.gameState || message.state;
          // 深合并玩家数组，确保引用变化触发React更新
          globalState = { 
            ...globalState, 
            ...newState,
            players: newState.players ? [...newState.players] : globalState.players
          };
          console.log('[Store] 更新后玩家数:', globalState.players?.length, '列表:', globalState.players?.map((p: Player) => p.name));
          notifyListeners();
        } else if (message.player) {
          // 兼容：如果只有player字段，手动添加到列表
          const existingIndex = globalState.players.findIndex(p => p.id === message.player.id);
          if (existingIndex === -1) {
            globalState.players = [...globalState.players, message.player];
            console.log('[Store] 手动添加玩家后数量:', globalState.players.length);
            notifyListeners();
          }
        }
        break;

      case 'PLAYER_ACTION_DONE':
        if (message.state || message.gameState) {
          const newState = message.state || message.gameState;
          globalState = { ...globalState, ...newState };
          notifyListeners();
        }
        break;

      case 'ROOM_FEATURE_USED':
        console.log('[Store] 房间功能使用成功:', message.featureAction);
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
          notifyListeners();
        }
        break;

      case 'ITEM_USED':
        console.log('[Store] 道具使用成功:', message.item);
        
        if (message.playerId) {
          const playerIndex = globalState.players.findIndex(p => p.id === message.playerId);
          if (playerIndex !== -1) {
            if (message.currentHealth !== undefined) {
              globalState.players[playerIndex].health = message.currentHealth;
            }
            if (message.actionPoints !== undefined) {
              globalState.players[playerIndex].actionPoints = message.actionPoints;
            }
            if (message.remainingItems !== undefined) {
              globalState.players[playerIndex].items = message.remainingItems;
            }
          }
        }
        
        if (message.effect === 'expose' && message.targetId) {
          globalState.powderTarget = message.targetId;
        }
        
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
        }
        
        notifyListeners();
        break;

      case 'VOTE_SUCCESS':
        console.log('[Store] 投凶成功');
        break;

      case 'TRADE_REQUEST':
        console.log('[Store] 收到交易请求');
        break;

      case 'TRADE_RESPONSE':
      case 'TRADE_CREATED':
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
          notifyListeners();
        }
        break;

      case 'NOTIFICATION':
        console.log('[Store] 通知:', message.message);
        break;

      case 'ERROR':
        console.error('[Store] Error:', message.message, 'ErrorCode:', message.errorCode);
        
        // 关键修复：主持人身份验证失败时，不要立即清除状态，允许重试
        const isHostAuthError = message.errorCode === 'HOST_EXPIRED' || 
                               message.errorCode === 'HOST_AUTH_FAILED';
        
        if (isHostAuthError) {
          console.log('[Store] 主持人认证错误，允许重试:', message.message);
          // 重置重连标记，允许再次尝试
          hasReconnectedRef.current = false;
          isReconnectingRef.current = false;
          // 不要清除 localStorage，让用户可以选择重试或创建新房间
        }
        
        if (message.errorCode === 'ROOM_NOT_FOUND' || 
            message.errorCode === 'ROOM_FULL' ||
            message.errorCode === 'GAME_ALREADY_STARTED') {
          
          // 清除本地存储
          localStorage.removeItem('roomCode');
          localStorage.removeItem('myPlayerId');
          localStorage.removeItem('hostPlayerId');
          localStorage.removeItem('myPlayerName');
          localStorage.removeItem('myPlayerNumber');
          localStorage.removeItem('isHost');
          localStorage.removeItem('myRole'); // 关键修复：清除角色信息
          
          globalState = { ...initialState };
          myPlayerId = '';
          myHostId = '';
          
          hasReconnectedRef.current = false;
          
          console.warn('[Store] Game state cleared due to error:', message.message);
        } else {
          // 非致命错误，显示提示
          if (typeof window !== 'undefined' && message.message) {
            setTimeout(() => {
              // 使用更友好的方式显示错误，而不是alert
              console.warn('[Store] 游戏错误:', message.message);
            }, 100);
          }
        }
        
        if (roomCodeResolveRef.current) {
          roomCodeResolveRef.current = null;
        }
        break;

      case 'PONG':
        break;

      default:
        console.warn('[Store] 未知消息类型:', message.type);
        if (message.state || message.gameState) {
          globalState = { ...globalState, ...(message.state || message.gameState) };
          notifyListeners();
        }
        break;
    }
  }, [lastMessage]);

  // 创建房间
  const createGame = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!isConnected) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      console.log('[Store] 发送创建房间请求');
      roomCodeResolveRef.current = resolve;
      
      sendMessage({
        type: 'CREATE_ROOM'
      });
      
      setTimeout(() => {
        if (roomCodeResolveRef.current) {
          roomCodeResolveRef.current = null;
          reject(new Error('创建房间超时'));
        }
      }, 10000);
    });
  }, [isConnected, sendMessage]);

  // 加入房间
  const joinGame = useCallback((roomCode: string, playerId?: string): boolean => {
    if (!isConnected) return false;
    
    sendMessage({
      type: 'JOIN_ROOM',
      roomCode,
      playerId
    });
    return true;
  }, [isConnected, sendMessage]);

  // 设置角色
  const setPlayerRole = useCallback((playerId: string, role: RoleType) => {
    sendMessage({
      type: 'SET_ROLE',
      playerId,
      role,
      hostPlayerId: myHostId || myPlayerId
    });
  }, [sendMessage, myHostId, myPlayerId]);

  // 开始游戏
  const startGame = useCallback(() => {
    // 关键修复：确保 hostPlayerId 有效且格式正确
    const effectiveHostId = myHostId || myPlayerId;
    
    if (!effectiveHostId) {
      console.error('[Store] 开始游戏失败：没有有效的 hostPlayerId');
      return;
    }
    
    sendMessage({ 
      type: 'START_GAME',
      hostPlayerId: effectiveHostId,
      // 关键修复：添加 roomCode 确保服务器能正确识别房间
      roomCode: globalState.roomCode
    });
  }, [sendMessage, myHostId, myPlayerId]);

  // 下一阶段
  const nextPhase = useCallback(() => {
    sendMessage({ 
      type: 'NEXT_PHASE',
      hostPlayerId: myHostId || myPlayerId
    });
  }, [sendMessage, myHostId, myPlayerId]);

  // 设置玩家位置
  const setPlayerLocation = useCallback((playerId: string, locationId: string, cost?: number) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'MOVE',
      locationId: locationId,
      cost: cost || 1,
      playerId: playerId
    });
  }, [sendMessage]);

  // 添加行动步骤
  const addActionStep = useCallback((playerId: string, step: ActionStepDetail) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'MOVE',
      locationId: step.locationId,
      cost: step.cost,
      playerId: playerId
    });
  }, [sendMessage]);

  // 清除行动线
  const clearActionLine = useCallback((playerId: string) => {
    console.log('[Store] 清除行动线:', playerId);
  }, []);

  // 使用道具
  const useItem = useCallback((playerId: string, item: ItemType, target?: string) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'USE_ITEM',
      item: item,
      target: target,
      playerId: playerId
    });
  }, [sendMessage]);

  // 创建交易请求
  const createTradeRequest = useCallback((
    fromPlayerId: string, 
    toPlayerId: string, 
    offerItem: ItemType, 
    requestItem: ItemType
  ) => {
    sendMessage({
      type: 'CREATE_TRADE',
      toPlayerId,
      offerItem,
      requestItem,
      fromPlayerId
    });
  }, [sendMessage]);

  // 响应交易
  const respondToTrade = useCallback((tradeId: string, accept: boolean) => {
    sendMessage({
      type: 'RESPOND_TRADE',
      tradeId,
      accept
    });
  }, [sendMessage]);

  // 使用技能
  const useSkill = useCallback((playerId: string, target?: string, skillType?: string, locationId?: string) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'USE_SKILL',
      skillType,
      target,
      locationId,
      playerId
    });
  }, [sendMessage]);

  // 设置虚假行动线
  const setFakeActionLine = useCallback((playerId: string, actionLine: ActionStep[]) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'SET_FAKE_ACTION_LINE',
      actionLine,
      playerId
    });
  }, [sendMessage]);

  // 投票
  const vote = useCallback((voterId: string, targetId: string) => {
    sendMessage({
      type: 'VOTE',
      targetId,
      voterId
    });
  }, [sendMessage]);

  // 获取投票结果
  const getVoteResults = useCallback(() => {
    const killer = globalState.players.find(p => p.role === 'killer');
    const results: { voterId: string; targetId: string; isCorrect: boolean }[] = [];

    Object.entries(globalState.votes || {}).forEach(([voterId, targetId]) => {
      results.push({
        voterId,
        targetId: targetId as string,
        isCorrect: targetId === killer?.id
      });
    });

    return results;
  }, []);

  // 添加 resetGame 函数
const resetGame = useCallback(() => {
  sendMessage({ type: 'RESET_ROOM' });
  // 重置本地状态
  globalState = { ...initialState };
  notifyListeners();
}, [sendMessage]);

// 添加 checkWinCondition 函数
const checkWinCondition = useCallback(() => {
  const { players } = globalState;
  
  // 计算阵营总分
  const killerScore = players
    .filter(p => p.camp === 'killer' && p.isAlive)
    .reduce((sum, p) => sum + p.score, 0);
  
  const detectiveScore = players
    .filter(p => p.camp === 'detective' && p.isAlive)
    .reduce((sum, p) => sum + p.score, 0);

  return {
    killerScore,
    detectiveScore,
    winner: killerScore >= detectiveScore ? 'killer' : 'detective' as const
  };
}, []);

return {
  ...globalState,
  myPlayerId,
  myHostId,
  isConnected,
  error,
  roundHistories,
  createGame,
  joinGame,
  setPlayerRole,
  startGame,
  nextPhase,
  setPlayerLocation,
  addActionStep,
  clearActionLine,
  useItem,
  createTradeRequest,
  respondToTrade,
  useSkill,
  setFakeActionLine,
  vote,
  getVoteResults,
  sendMessage,
  reconnect,
  resetGame,        // 添加
  checkWinCondition // 添加
};
}

// 导出全局状态供外部直接访问
export { globalState, myPlayerId, myHostId };
