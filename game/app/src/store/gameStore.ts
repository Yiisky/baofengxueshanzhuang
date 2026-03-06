import { useState, useCallback, useEffect } from 'react';
import type { 
  GameState, 
  Player, 
  Role, 
  // Camp,  // 暂时移除，使用字符串
  ActionStep, 
  ItemType,
  SettlementInfo,
  TradeRequest,
  // GameHistory  // 暂时移除，内联定义
} from '@/types/game';

// 临时类型定义
type Camp = 'killer' | 'detective' | 'neutral';

interface GameHistory {
  id: string;
  roomCode: string;
  startTime: number;
  endTime: number;
  players: Array<{
    name: string;
    role: string;
    camp: string;
    score: number;
    isAlive: boolean;
  }>;
  winner: string;
  rounds: number;
}
import { locations } from '@/data/locations';
import { defaultRoleDistribution, getRoleConfig } from '@/data/roles';

// 生成唯一ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 生成房间码
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// 创建新玩家
function createPlayer(name: string, role: Role, index: number): Player {
  const roleConfig = getRoleConfig(role);
  return {
    id: generateId(),
    name: name || `玩家${index + 1}`,
    number: index + 1, 
    role,
    camp: roleConfig?.camp || 'neutral',
    health: 3,
    maxHealth: 3,
    actionPoints: 8,
    currentLocation: '',
    locationId: '', // 修复：添加缺失的 locationId
    actionLine: [],
    items: [],
    score: roleConfig?.initialScore || 0,
    isAlive: true,
    isExposed: false,
    visitedLocations: [],
    skillUsedThisRound: false,
    fakeActionLineCount: role === 'killer' ? 2 : 0,
    fireCount: role === 'accomplice' ? 2 : 0,
    hasCheckedFan: false,
    totalVotesCorrect: 0,
    votesThisRound: null,
    fanJoinedCamp: undefined // 初始化
  };
}

// 初始状态
const initialState: GameState = {
  id: generateId(),
  roomCode: generateRoomCode(),
  round: 1,
  phase: 'lobby',
  players: [],
  locations: locations,
  fireLocations: [],
  lightLocations: [],
  currentPlayerIndex: 0,
  votes: {} as Record<string, string>,  // 改为Record类型
  voteRecords: [],
  tradeRequests: [],
  settings: {
    allowRoleReveal: false,
    timeLimit: 0
  }
};

// 全局状态
let globalState: GameState = { ...initialState };
let listeners: (() => void)[] = [];
let gameHistories: GameHistory[] = [];

// 关键修复：标记是否使用 WebSocket 模式（外部控制）
let useWebSocketMode = false;

// 设置 WebSocket 模式
export function setWebSocketMode(enabled: boolean) {
  useWebSocketMode = enabled;
  console.log('[GameStore] WebSocket 模式:', enabled);
}

function notifyListeners() {
  listeners.forEach(listener => listener());
}

// 保存游戏历史
function saveGameHistory(state: GameState) {
  const history: GameHistory = {
    id: generateId(),
    roomCode: state.roomCode,
    startTime: state.gameStartTime || Date.now(),
    endTime: Date.now(),
    players: state.players.map(p => ({
      name: p.name,
      role: p.role,
      camp: p.camp,
      score: p.score,
      isAlive: p.isAlive
    })),
    winner: state.winner || 'killer',
    rounds: state.round
  };
  gameHistories.push(history);
  localStorage.setItem('gameHistories', JSON.stringify(gameHistories));
}

// 加载游戏历史
function loadGameHistories(): GameHistory[] {
  const stored = localStorage.getItem('gameHistories');
  if (stored) {
    gameHistories = JSON.parse(stored);
  }
  return gameHistories;
}

// 游戏状态Hook
export function useGameStore() {
  const [, forceUpdate] = useState({});

  // 订阅状态变化
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  // ========== 游戏配置 ==========

  // 创建新游戏（主持人）
const createGame = useCallback((hostId: string) => {
  // 关键修复：WebSocket 模式下不创建本地游戏
  if (useWebSocketMode) {
    console.log('[GameStore] WebSocket 模式，跳过本地创建');
    return '';
  }
  
  globalState = { 
    ...initialState,
    id: generateId(),
    roomCode: generateRoomCode(),
    hostId
  };
  notifyListeners();
  return globalState.roomCode;
}, []);

  // 加入游戏
  const joinGame = useCallback((roomCode: string) => {
    // 这里应该验证房间码是否存在
    return globalState.roomCode === roomCode;
  }, []);

  // 设置游戏配置
  const setGameConfig = useCallback((playerNames: string[], roles?: Role[]) => {
    const assignedRoles = roles || defaultRoleDistribution;
    const players = playerNames.map((name, index) => 
      createPlayer(name, assignedRoles[index], index)
    );
    globalState = { ...globalState, players, phase: 'config' };
    notifyListeners();
  }, []);

  // 设置玩家身份（主持人专用）
  const setPlayerRole = useCallback((playerId: string, role: Role) => {
    const roleConfig = getRoleConfig(role);
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          role,
          camp: roleConfig?.camp || 'neutral',
          score: roleConfig?.initialScore || 0,
          fakeActionLineCount: role === 'killer' ? 2 : 0,
          fireCount: role === 'accomplice' ? 2 : 0
        };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // 开始游戏
  const startGame = useCallback(() => {
    globalState = { 
      ...globalState, 
      phase: 'action',
      round: 1,
      // 使用类型断言添加动态属性
      ...( { gameStartTime: Date.now() } as any ),
      roundStartTime: Date.now()
    };
    notifyListeners();
  }, []);

  // ========== 游戏流程控制 ==========

  // 进入下一阶段
  const nextPhase = useCallback(() => {
    const { phase, round } = globalState;
    if (phase === 'free') {
      globalState = { ...globalState, phase: 'action' };
    } else if (phase === 'action') {
      globalState = { ...globalState, phase: 'settlement' };
    } else if (phase === 'settlement') {
      if (round >= 5) {
        endGameInternal();
      } else {
        globalState = { ...globalState, phase: 'free' };
      }
    }
    notifyListeners();
  }, []);

  // 进入下一轮
  const nextRound = useCallback(() => {
    const { round } = globalState;
    
    // 保存本轮投票记录
    Object.entries(globalState.votes).forEach(([voterId, targetId]) => {
      const killer = globalState.players.find(p => p.role === 'killer');
      const isCorrect = targetId === killer?.id;
      
      globalState.voteRecords.push({
        round,
        voterId,
        targetId,
        isCorrect
      });

      // 投凶正确加分
      if (isCorrect) {
        const voter = globalState.players.find(p => p.id === voterId);
        if (voter) {
          voter.score += 1;
          voter.totalVotesCorrect += 1;
        }
      }
    });

    globalState = {
      ...globalState,
      round: round + 1,
      phase: 'free',
      fireLocations: [],
      lightLocations: [],
      powderTarget: undefined,
      detectiveTarget: undefined,
      hackerTarget: undefined,
      engineerRepaired: undefined,
      votes: {} as Record<string, string>,
      tradeRequests: []
    };

    // 重置玩家状态
    globalState.players = globalState.players.map(p => ({
      ...p,
      actionPoints: p.isAlive ? 8 : 4,
      actionLine: [],
      fakeActionLine: undefined,
      skillUsedThisRound: false,
      votesThisRound: undefined
    }));

    notifyListeners();
  }, []);

  // 结束游戏
  const endGame = useCallback(() => {
    endGameInternal();
    notifyListeners();
  }, []);

  function endGameInternal() {
    // 计算阵营总分
    const killerScore = globalState.players
      .filter(p => p.camp === 'killer' && p.isAlive)
      .reduce((sum, p) => sum + p.score, 0);
    
    const detectiveScore = globalState.players
      .filter(p => p.camp === 'detective' && p.isAlive)
      .reduce((sum, p) => sum + p.score, 0);

    (globalState as any).winner = killerScore >= detectiveScore ? 'killer' : 'detective';
    globalState.phase = 'ended';
    (globalState as any).gameEndTime = Date.now();

    saveGameHistory(globalState);
  }

  // ========== 玩家操作 ==========

  // 设置玩家位置
  const setPlayerLocation = useCallback((playerId: string, locationId: string) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        const visited = [...p.visitedLocations];
        if (!visited.includes(locationId)) {
          visited.push(locationId);
        }
        return { ...p, currentLocation: locationId, visitedLocations: visited };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // 添加行动步骤
  const addActionStep = useCallback((playerId: string, step: ActionStep) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        const actionLine = [...p.actionLine, step];
        return { ...p, actionLine };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // 清除行动线
  const clearActionLine = useCallback((playerId: string) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        return { ...p, actionLine: [] };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // 使用行动点
  const useActionPoint = useCallback((playerId: string, points: number) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        return { ...p, actionPoints: Math.max(0, p.actionPoints - points) };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // ========== 道具操作 ==========

  // 添加道具
  const addItem = useCallback((playerId: string, item: ItemType) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId && p.items.length < 5) {
        return { ...p, items: [...p.items, item] };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // 移除道具
  const removeItem = useCallback((playerId: string, item: ItemType) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        const itemIndex = p.items.indexOf(item);
        if (itemIndex > -1) {
          const items = [...p.items];
          items.splice(itemIndex, 1);
          return { ...p, items };
        }
      }
      return p;
    });
    notifyListeners();
  }, []);

  // 使用道具
  const useItem = useCallback((playerId: string, item: ItemType, target?: string) => {
    switch (item) {
      case 'powder':
        if (target) {
          globalState.powderTarget = target;
          removeItem(playerId, item);
        }
        break;
      case 'extinguisher':
        if (target) {
          globalState.fireLocations = globalState.fireLocations.filter(id => id !== target);
          removeItem(playerId, item);
        }
        break;
      case 'bandage':
        changeHealth(playerId, 1);
        removeItem(playerId, item);
        break;
    }
  }, []);

  // 创建交易请求
  const createTradeRequest = useCallback((fromPlayerId: string, toPlayerId: string, offerItem: ItemType, requestItem: ItemType) => {
    const trade: TradeRequest = {
      id: generateId(),
      fromPlayerId,
      toPlayerId,
      offerItem,
      requestItem,
      status: 'pending',
      createdAt: Date.now()
    };
    globalState.tradeRequests.push(trade);
    notifyListeners();
    return trade.id;
  }, []);

  // 响应交易请求
  const respondToTrade = useCallback((tradeId: string, accept: boolean) => {
    const trade = globalState.tradeRequests.find(t => t.id === tradeId);
    if (!trade) return;

    trade.status = accept ? 'accepted' : 'rejected';

    if (accept) {
      // 执行交易
      const fromPlayer = globalState.players.find(p => p.id === trade.fromPlayerId);
      const toPlayer = globalState.players.find(p => p.id === trade.toPlayerId);

      if (fromPlayer && toPlayer) {
        // 移除双方的道具
        const fromItemIndex = fromPlayer.items.indexOf(trade.offerItem);
        const toItemIndex = toPlayer.items.indexOf(trade.requestItem);

        if (fromItemIndex > -1 && toItemIndex > -1) {
          fromPlayer.items.splice(fromItemIndex, 1);
          toPlayer.items.splice(toItemIndex, 1);

          // 交换道具
          fromPlayer.items.push(trade.requestItem);
          toPlayer.items.push(trade.offerItem);
        }
      }
    }

    notifyListeners();
  }, []);

  // ========== 技能操作 ==========

  // 使用技能
  const useSkill = useCallback((playerId: string, target?: string) => {
    const player = globalState.players.find(p => p.id === playerId);
    if (!player) return;

    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        return { ...p, skillUsedThisRound: true };
      }
      return p;
    });

    switch (player.role) {
      case 'detective':
        if (target) {
          globalState.detectiveTarget = target;
        }
        break;
      case 'hacker':
        if (target) {
          globalState.hackerTarget = target;
        }
        break;
      case 'engineer':
        if (target) {
          globalState.engineerRepaired = target;
        }
        break;
      case 'killer':
        // 凶手使用编造行动线
        if (player.fakeActionLineCount > 0) {
          player.fakeActionLineCount--;
        }
        break;
      case 'accomplice':
        // 帮凶放火
        if (target && player.fireCount > 0) {
          globalState.fireLocations.push(target);
          player.fireCount--;
        }
        break;
      case 'fan':
      case 'good_fan':
      case 'bad_fan':
        // 推理迷查验身份
        if (target && !player.hasCheckedFan) {
          const targetPlayer = globalState.players.find(p => p.id === target);
          if (targetPlayer) {
            player.hasCheckedFan = true;
            globalState.fanChecked = {
              playerId: target,
              role: targetPlayer.role
            };

            // 转换阵营
            if (targetPlayer.role === 'detective') {
              player.role = 'good_fan';
              player.camp = 'detective';
              player.fanJoinedCamp = 'detective';
            } else if (targetPlayer.role === 'killer') {
              player.role = 'bad_fan';
              player.camp = 'killer';
              player.fanJoinedCamp = 'killer';
            }
          }
        }
        break;
    }

    notifyListeners();
  }, []);

  // 设置编造的行动线（凶手）
  const setFakeActionLine = useCallback((playerId: string, actionLine: ActionStep[]) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId && p.fakeActionLineCount > 0) {
        return { ...p, fakeActionLine: actionLine };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // ========== 生命值操作 ==========

  // 改变生命值
  const changeHealth = useCallback((playerId: string, delta: number) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        const newHealth = Math.max(0, Math.min(p.maxHealth, p.health + delta));
        return { 
          ...p, 
          health: newHealth,
          isAlive: newHealth > 0
        };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // 杀死玩家
  const killPlayer = useCallback((playerId: string) => {
    globalState.players = globalState.players.map(p => {
      if (p.id === playerId) {
        return { 
          ...p, 
          health: 0, 
          isAlive: false,
          actionPoints: 4
        };
      }
      return p;
    });
    notifyListeners();
  }, []);

  // ========== 投凶系统 ==========

  // 投凶
  const vote = useCallback((voterId: string, targetId: string) => {
    // 修复：votes 是 Record 类型，不是 Map
    (globalState.votes as any)[voterId] = targetId;
    
    // 更新玩家本轮投票
    globalState.players = globalState.players.map(p => {
      if (p.id === voterId) {
        return { ...p, votesThisRound: targetId };
      }
      return p;
    });

    notifyListeners();
  }, []);

  // 获取投票结果
  const getVoteResults = useCallback(() => {
    const killer = globalState.players.find(p => p.role === 'killer');
    const results: { voterId: string; targetId: string; isCorrect: boolean }[] = [];

      Object.entries(globalState.votes).forEach(([voterId, targetId]) => {
      results.push({
        voterId,
        targetId,
        isCorrect: targetId === killer?.id
      });
    });

    return results;
  }, []);

  // ========== 地点操作 ==========

  // 设置着火地点
  const setFireLocation = useCallback((locationId: string) => {
    if (!globalState.fireLocations.includes(locationId)) {
      globalState.fireLocations = [...globalState.fireLocations, locationId];
      notifyListeners();
    }
  }, []);

  // 移除着火地点
  const removeFireLocation = useCallback((locationId: string) => {
    globalState.fireLocations = globalState.fireLocations.filter(id => id !== locationId);
    notifyListeners();
  }, []);

  // 设置亮灯地点
  const setLightLocation = useCallback((locationId: string) => {
    if (!globalState.lightLocations.includes(locationId)) {
      globalState.lightLocations = [...globalState.lightLocations, locationId];
      notifyListeners();
    }
  }, []);

  // ========== 查询方法 ==========

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

  const getPlayersByCamp = useCallback((camp: Camp) => {
    return globalState.players.filter(p => p.camp === camp);
  }, []);

  // 获取待处理的交易请求
  const getPendingTradesForPlayer = useCallback((playerId: string) => {
    return globalState.tradeRequests.filter(
      t => t.toPlayerId === playerId && t.status === 'pending'
    );
  }, []);

  // ========== 结算计算 ==========

  const calculateSettlement = useCallback((): SettlementInfo => {
    const { players, fireLocations, lightLocations, powderTarget, votes } = globalState;
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

    // 1. 计算重叠玩家（亮灯地点）
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

    // 2. 计算着火伤害
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

    // 3. 计算攻击伤害（凶手和帮凶）
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

    // 4. 计算医生治疗
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

    // 5. 荧光粉暴露的行动线
    if (powderTarget) {
      const target = players.find(p => p.id === powderTarget);
      if (target) {
        settlement.exposedActionLines.push({
          playerId: target.id,
          actionLine: target.fakeActionLine || target.actionLine,
          isFake: !!target.fakeActionLine
        });
      }
    }

    // 6. 投票结果
    Object.entries(votes).forEach(([voterId, targetId]) => {
      const killer = players.find(p => p.role === 'killer');
      settlement.voteResults.push({
        voterId,
        targetId,
        isCorrect: targetId === killer?.id
      });
    });

    return settlement;
  }, []);

  // ========== 胜利条件判定 ==========

  const checkWinCondition = useCallback(() => {
    const { players } = globalState;
    
    // 获取所有地点ID
    const allLocationIds = locations.map(l => l.id);
    const crimeScenes = ['first_crime', 'second_crime'];

    // 检查每个存活玩家的胜利条件
    players.forEach(player => {
      if (!player.isAlive) return;

      // 凶手阵营无额外条件
      if (player.camp === 'killer') return;

      // 侦探阵营需要检查地点访问
      const visitedCrimeScenes = crimeScenes.filter(id => 
        player.visitedLocations.includes(id)
      );

      // 侦探和好推理迷需要访问两个案发现场
      if (player.role === 'detective' || player.role === 'good_fan') {
        if (visitedCrimeScenes.length < 2) {
          // 标记为无效分数
          player.score = 0;
        }
      } else {
        // 其他侦探阵营成员需要访问所有地点
        const visitedAll = allLocationIds.every(id => 
          player.visitedLocations.includes(id)
        );
        if (!visitedAll) {
          player.score = 0;
        }
      }
    });

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
      winner: killerScore >= detectiveScore ? 'killer' : 'detective' as Camp
    };
  }, []);

  // ========== 游戏历史 ==========

  const getGameHistories = useCallback(() => {
    return loadGameHistories();
  }, []);

  const clearGameHistories = useCallback(() => {
    gameHistories = [];
    localStorage.removeItem('gameHistories');
    notifyListeners();
  }, []);

  // ========== 重置游戏 ==========

  const resetGame = useCallback(() => {
    globalState = { ...initialState, roomCode: generateRoomCode() };
    notifyListeners();
  }, []);

  return {
    ...globalState,
    createGame,
    setWebSocketMode, // 导出设置函数
    joinGame,
    setGameConfig,
    setPlayerRole,
    startGame,
    nextPhase,
    nextRound,
    endGame,
    setPlayerLocation,
    addActionStep,
    clearActionLine,
    useActionPoint,
    addItem,
    removeItem,
    useItem,
    createTradeRequest,
    respondToTrade,
    useSkill,
    setFakeActionLine,
    changeHealth,
    killPlayer,
    vote,
    getVoteResults,
    setFireLocation,
    removeFireLocation,
    setLightLocation,
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
