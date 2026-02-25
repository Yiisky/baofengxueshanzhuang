import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { GameState, Role, ActionStep, ActionStepDetail, ItemType, SettlementInfo } from '@/types/game';
import { locations } from '@/data/locations';

// 自动获取服务器地址
const getServerUrl = () => {
  // 如果是服务器端渲染，返回默认地址
  if (typeof window === 'undefined') return 'ws://localhost:8080';
  
  // 获取当前页面的主机名和端口
  const hostname = window.location.hostname;
  const port = '8080'; // WebSocket 服务器端口
  
  // 构建 WebSocket URL
  // 如果当前是 https，使用 wss，否则使用 ws
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // 优先使用当前页面的主机名，这样无论 IP 怎么变都能自动连接
  return `${protocol}//${hostname}:${port}`;
};

// 备用地址（如果自动获取失败）
const BACKUP_URL = 'ws://localhost:8080';

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
  }
};

let globalState: GameState = { ...initialState };
let myPlayerId: string = '';
let myHostId: string = ''; // 主持人ID
let listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function useWebSocketStore() {
  const { isConnected, sendMessage, lastMessage, error, reconnect } = useWebSocket(SERVER_URL);
  const [, forceUpdate] = useState({});
  const roomCodeResolveRef = useRef<((code: string) => void) | null>(null);

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    console.log('[Store] 收到消息:', lastMessage.type);

    switch (lastMessage.type) {
      case 'CONNECTED':
        console.log('[Store] 已连接到服务器');
        break;

      case 'ROOM_CREATED':
        console.log('[Store] 房间创建成功:', lastMessage.roomCode);
        myPlayerId = lastMessage.playerId;
        // 创建房间的人就是主持人
        myHostId = lastMessage.hostId || myPlayerId;
        
        // 保存到 localStorage
        localStorage.setItem('myPlayerId', myPlayerId);
        localStorage.setItem('hostId', myHostId);
        
        if (lastMessage.roomCode) {
          globalState.roomCode = lastMessage.roomCode;
        }
        localStorage.setItem('roomCode', lastMessage.roomCode || '');
        if (lastMessage.gameState) {
          globalState = { ...globalState, ...lastMessage.gameState };
        }
        
        notifyListeners();
        
        if (roomCodeResolveRef.current) {
          roomCodeResolveRef.current(lastMessage.roomCode || '');
          roomCodeResolveRef.current = null;
        }
        break;

      case 'ROOM_JOINED':
        console.log('[Store] 加入房间成功:', lastMessage.roomCode);
        myPlayerId = lastMessage.playerId;
        myHostId = lastMessage.hostId || '';
        
        // 保存到 localStorage
        localStorage.setItem('roomCode', lastMessage.roomCode || '');
        localStorage.setItem('myPlayerId', myPlayerId);
        localStorage.setItem('hostId', myHostId);
        
        if (lastMessage.playerName) {
          localStorage.setItem('myPlayerName', lastMessage.playerName);
        }
        if (lastMessage.roomCode) {
          globalState.roomCode = lastMessage.roomCode;
        }
        if (lastMessage.gameState) {
          globalState = { ...globalState, ...lastMessage.gameState };
        }
        
        notifyListeners();
        break;

      case 'GAME_STATE':
      case 'GAME_STARTED':
      case 'PHASE_CHANGED':
        if (lastMessage.state) {
          globalState = { ...globalState, ...lastMessage.state };
          if (lastMessage.state.roomCode) {
            globalState.roomCode = lastMessage.state.roomCode;
          }
          // 更新主持人ID
          if (lastMessage.state.hostId) {
            myHostId = lastMessage.state.hostId;
            localStorage.setItem('hostId', myHostId);
          }
        }
        notifyListeners();
        break;

      case 'PLAYER_JOINED':
        console.log('[Store] 玩家加入:', lastMessage.player?.name);
        if (lastMessage.gameState) {
          globalState = { ...globalState, ...lastMessage.gameState };
          notifyListeners();
        }
        break;

      case 'VOTE_SUCCESS':
        console.log('[Store] 投凶成功');
        break;

      case 'TRADE_REQUEST':
        console.log('[Store] 收到交易请求');
        break;

      case 'TRADE_RESPONSE':
        if (lastMessage.state) {
          globalState = { ...globalState, ...lastMessage.state };
        }
        notifyListeners();
        break;

      case 'NOTIFICATION':
        console.log('[Store] 通知:', lastMessage.message);
        break;

case 'ERROR':
  console.error('[Store] 错误:', lastMessage.message);
  
  // 如果是房间不存在的错误，清除本地存储并触发重新登录
  if (lastMessage.message && (
    lastMessage.message.includes('房间不存在') ||
    lastMessage.message.includes('房间已满') ||
    lastMessage.message.includes('游戏已开始')
  )) {
    localStorage.removeItem('roomCode');
    localStorage.removeItem('myPlayerId');
    localStorage.removeItem('hostId');
    localStorage.removeItem('myPlayerName');
    
    // 可以在这里触发一个全局事件或回调，让 App.tsx 知道需要重置
  }
  
  alert(lastMessage.message);
  break;
    }
  }, [lastMessage]);

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

  const joinGame = useCallback((roomCode: string, playerId?: string): boolean => {
  if (!isConnected) return false;
  
  sendMessage({
    type: 'JOIN_ROOM',
    roomCode,
    playerId // 可选的 playerId，用于断线重连
  });
  return true;
}, [isConnected, sendMessage]);

  const setPlayerRole = useCallback((playerId: string, role: Role) => {
    sendMessage({
      type: 'SET_ROLE',
      playerId,
      role
    });
  }, [sendMessage]);

  const startGame = useCallback(() => {
    sendMessage({ type: 'START_GAME' });
  }, [sendMessage]);

  const nextPhase = useCallback(() => {
    sendMessage({ type: 'NEXT_PHASE' });
  }, [sendMessage]);

  const setPlayerLocation = useCallback((_playerId: string, locationId: string) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'MOVE',
      locationId
    });
  }, [sendMessage]);

const addActionStep = useCallback((_playerId: string, step: ActionStepDetail) => {
  sendMessage({
    type: 'PLAYER_ACTION',
    action: 'MOVE',
    locationId: step.locationId
  });
}, [sendMessage]);

  const clearActionLine = useCallback((_playerId: string) => {
    console.log('[Store] 清除行动线需要重新连接');
  }, []);

  const useItem = useCallback((_playerId: string, item: ItemType, target?: string) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'USE_ITEM',
      item,
      target
    });
  }, [sendMessage]);

  const createTradeRequest = useCallback((
    _fromPlayerId: string, 
    toPlayerId: string, 
    offerItem: ItemType, 
    requestItem: ItemType
  ) => {
    sendMessage({
      type: 'CREATE_TRADE',
      toPlayerId,
      offerItem,
      requestItem
    });
  }, [sendMessage]);

  const respondToTrade = useCallback((tradeId: string, accept: boolean) => {
    sendMessage({
      type: 'RESPOND_TRADE',
      tradeId,
      accept
    });
  }, [sendMessage]);

  const useSkill = useCallback((_playerId: string, target?: string) => {
    sendMessage({
      type: 'USE_SKILL',
      target
    });
  }, [sendMessage]);

  const setFakeActionLine = useCallback((_playerId: string, actionLine: ActionStep[]) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'SET_FAKE_ACTION_LINE',
      actionLine
    });
  }, [sendMessage]);

  const vote = useCallback((_voterId: string, targetId: string) => {
    sendMessage({
      type: 'VOTE',
      targetId
    });
  }, [sendMessage]);

  const getVoteResults = useCallback(() => {
    const killer = globalState.players.find(p => p.role === 'killer');
    const results: { voterId: string; targetId: string; isCorrect: boolean }[] = [];

    Object.entries(globalState.votes || {}).forEach(([voterId, targetId]) => {
      results.push({
        voterId,
        targetId,
        isCorrect: targetId === killer?.id
      });
    });

    return results;
  }, []);

  const setFireLocation = useCallback((locationId: string) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'SET_FIRE',
      locationId
    });
  }, [sendMessage]);

  const removeFireLocation = useCallback((locationId: string) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'REMOVE_FIRE',
      locationId
    });
  }, [sendMessage]);

  const setLightLocation = useCallback((locationId: string) => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'SET_LIGHT',
      locationId
    });
  }, [sendMessage]);

  const clearLightLocations = useCallback(() => {
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'CLEAR_LIGHTS'
    });
  }, [sendMessage]);

  const getPlayerById = useCallback((playerId: string) => {
    return globalState.players.find(p => p.id === playerId);
  }, []);

  const getPlayersByLocation = useCallback((locationId: string) => {
    return globalState.players.filter(p => p.currentLocation === locationId);
  }, []);

  const getOverlappingPlayers = useCallback((locationId: string) => {
    return globalState.players.filter(p => p.currentLocation === locationId && p.isAlive);
  }, []);

  const getAlivePlayers = useCallback(() => {
    return globalState.players.filter(p => p.isAlive);
  }, []);

  const getPlayersByCamp = useCallback((camp: 'killer' | 'detective' | 'neutral') => {
    return globalState.players.filter(p => p.camp === camp);
  }, []);

  const getPendingTradesForPlayer = useCallback((playerId: string) => {
    return globalState.tradeRequests.filter(
      t => t.toPlayerId === playerId && t.status === 'pending'
    );
  }, []);

  const calculateSettlement = useCallback((): SettlementInfo => {
    const { players, fireLocations, lightLocations } = globalState;
    const settlement: SettlementInfo = {
      round: globalState.round,
      healthChanges: [],
      overlappingPlayers: [],
      exposedActionLines: [],
      fireDamage: [],
      attackDamage: [],
      healEffects: [],
      nextRoundFireLocations: [...fireLocations],
      nextRoundLightLocations: [...lightLocations],
      voteResults: []
    };

    lightLocations.forEach(locId => {
      const overlapping = players.filter(p => 
        p.actionLine.some(step => step.locationId === locId)
      );
      if (overlapping.length > 1) {
        settlement.overlappingPlayers.push({
          locationId: locId,
          players: overlapping.map(p => p.id)
        });
      }
    });

    fireLocations.forEach(locId => {
      players.forEach(p => {
        if (p.isAlive && p.actionLine.some(step => step.locationId === locId)) {
          settlement.fireDamage.push({
            playerId: p.id,
            locationId: locId
          });
          settlement.healthChanges.push({
            playerId: p.id,
            change: -1,
            reason: '着火伤害'
          });
        }
      });
    });

    const killers = players.filter(p => 
      p.role === 'killer' || p.role === 'accomplice' || p.role === 'bad_fan'
    );
    killers.forEach(killer => {
      if (!killer.isAlive) return;
      
      const actionLine = killer.fakeActionLine || killer.actionLine;
      
      players.forEach(target => {
        if (target.id === killer.id || !target.isAlive) return;
        
        const hasOverlap = actionLine.some(kStep => 
          target.actionLine.some(tStep => 
            tStep.step === kStep.step && tStep.locationId === kStep.locationId
          )
        );
        
        if (hasOverlap) {
          settlement.attackDamage.push({
            playerId: target.id,
            attackerId: killer.id
          });
          settlement.healthChanges.push({
            playerId: target.id,
            change: -1,
            reason: `被${killer.name}攻击`
          });
        }
      });
    });

    const doctors = players.filter(p => p.role === 'doctor' && p.isAlive);
    if (doctors.length >= 2) {
      for (let i = 0; i < doctors.length; i++) {
        for (let j = i + 1; j < doctors.length; j++) {
          const doc1 = doctors[i];
          const doc2 = doctors[j];
          
          const hasOverlap = doc1.actionLine.some(s1 => 
            doc2.actionLine.some(s2 => s2.locationId === s1.locationId)
          );
          
          if (hasOverlap) {
            settlement.healEffects.push(
              { playerId: doc1.id, healerId: doc2.id },
              { playerId: doc2.id, healerId: doc1.id }
            );
            settlement.healthChanges.push(
              { playerId: doc1.id, change: 1, reason: '医生治疗' },
              { playerId: doc2.id, change: 1, reason: '医生治疗' }
            );
          }
        }
      }
    }

    if (globalState.powderTarget) {
      const target = players.find(p => p.id === globalState.powderTarget);
      if (target) {
        settlement.exposedActionLines.push({
          playerId: target.id,
          actionLine: target.fakeActionLine || target.actionLine,
          isFake: !!target.fakeActionLine
        });
      }
    }

    Object.entries(globalState.votes || {}).forEach(([voterId, targetId]) => {
      const killer = players.find(p => p.role === 'killer');
      settlement.voteResults.push({
        voterId,
        targetId,
        isCorrect: targetId === killer?.id
      });
    });

    return settlement;
  }, []);

  const checkWinCondition = useCallback(() => {
    const { players } = globalState;
    
    const allLocationIds = locations.map(l => l.id);
    const crimeScenes = ['first_crime', 'second_crime'];

    players.forEach(player => {
      if (!player.isAlive) return;
      if (player.camp === 'killer') return;

      const visitedCrimeScenes = crimeScenes.filter(id => 
        player.visitedLocations.includes(id)
      );

      if (player.role === 'detective' || player.role === 'good_fan') {
        if (visitedCrimeScenes.length < 2) {
          player.score = 0;
        }
      } else {
        const visitedAll = allLocationIds.every(id => 
          player.visitedLocations.includes(id)
        );
        if (!visitedAll) {
          player.score = 0;
        }
      }
    });

    const killerScore = players
      .filter(p => p.camp === 'killer' && p.isAlive)
      .reduce((sum, p) => sum + p.score, 0);
    
    const detectiveScore = players
      .filter(p => p.camp === 'detective' && p.isAlive)
      .reduce((sum, p) => sum + p.score, 0);

    return {
      killerScore,
      detectiveScore,
      winner: killerScore >= detectiveScore ? 'killer' : 'detective' as 'killer' | 'detective'
    };
  }, []);

  const getGameHistories = useCallback(() => {
    const stored = localStorage.getItem('gameHistories');
    return stored ? JSON.parse(stored) : [];
  }, []);

  const clearGameHistories = useCallback(() => {
    localStorage.removeItem('gameHistories');
  }, []);

  const resetGame = useCallback(() => {
    globalState = { ...initialState };
    myPlayerId = '';
    myHostId = '';
    localStorage.removeItem('myPlayerId');
    localStorage.removeItem('hostId');
    localStorage.removeItem('myPlayerName');
    localStorage.removeItem('roomCode');
    notifyListeners();
    reconnect();
  }, [reconnect]);

  // 判断是否是主持人
  const isHost = useCallback(() => {
    const storedHostId = localStorage.getItem('hostId');
    const storedPlayerId = localStorage.getItem('myPlayerId');
    return !!storedHostId && !!storedPlayerId && storedHostId === storedPlayerId;
  }, []);

  return {
    isConnected,
    connectionError: error,
    reconnect,
    ...globalState,
    myPlayerId,
    isHost: isHost(),
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
    setFireLocation,
    removeFireLocation,
    setLightLocation,
    clearLightLocations,
    getPlayerById,
    getPlayersByLocation,
    getOverlappingPlayers,
    getAlivePlayers,
    getPlayersByCamp,
    getPendingTradesForPlayer,
    calculateSettlement,
    checkWinCondition,
    getGameHistories,
    clearGameHistories,
    resetGame
  };
}