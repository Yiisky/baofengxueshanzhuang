// src/hooks/usePlayerPanel.ts
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Player, RoleType, CampType } from '@/types/game';
import { useWebSocketStore } from '@/store/websocketStore';
import { roomFragments } from '@/data/roomFragments';
import { getRoleName, getRoleDescription } from '@/data/roles';
import { 
  specialStartRooms, 
  jumpRooms, 
  isGarden, 
  isIndoor, 
  isJumpMove, 
  getMoveCost,
  canUseRopeReverse,
  ropeReverseRoutes,
  getJumpCostWithRope
} from '@/utils/movementRules';
import { getRoomFeature } from '@/data/roomFeatures';

type AlertType = 'info' | 'warning' | 'error';

// 本地定义 isKiller 辅助函数
function isKiller(role?: RoleType): boolean {
  return role === 'killer' || role === 'murderer';
}

// 辅助函数：提取玩家编号
function extractPlayerNumber(str: string): number | null {
  if (!str) return null;
  const match = str.match(/(\d+)号玩家/);
  return match ? parseInt(match[1], 10) : null;
}

// 辅助函数：获取玩家编号（优先使用服务器返回的 number 字段）
function getPlayerNumber(playerId: string, players: Player[]): number {
  // 优先使用玩家对象中已有的 number 字段
  const player = players.find(p => p.id === playerId);
  if (player && (player as any).number && (player as any).number > 0) {
    return (player as any).number;
  }
  
  // 其次从 name 中提取
  if (player?.name) {
    const match = player.name.match(/(\d+)号玩家/);
    if (match) return parseInt(match[1], 10);
  }
  
  // 最后根据索引计算
  const index = players.findIndex(p => p.id === playerId);
  return index >= 0 ? index + 1 : 0;
}

// ===== 新增：角色信息类型定义 =====
export interface RoleRevealInfo {
  roleName: string;
  roleDescription: string;
  playerNumber: number;
  isAccomplice: boolean;
  accomplices?: Array<{ number: number; name: string; isMe: boolean }>;
  totalAccomplices?: number;
}

export function usePlayerPanel() {
  const store = useWebSocketStore();
  const { 
    players = [],
    phase = 'lobby', 
    round = 1,
    fireLocations = [],
    setPlayerLocation,
    sendMessage
  } = store;

  // ===== 调试：打印初始状态 =====
  console.log('[usePlayerPanel] 初始状态:', {
    initialPlayers: players.length,
    initialPhase: phase,
    initialMyPlayerId: store.myPlayerId,
    localStorageId: localStorage.getItem('myPlayerId'),
    localStorageName: localStorage.getItem('myPlayerName')
  });

  // ===== 关键修复：全新的 playerId 管理系统 =====
  // 使用 ref 来存储当前玩家的 ID，避免重复计算
  const playerIdStateRef = useRef<{
    currentId: string;
    isInitialized: boolean;
    lastUpdateTime: number;
    retryCount: number;
    deviceId: string; // 新增：设备唯一标识
  }>({
    currentId: '',
    isInitialized: false,
    lastUpdateTime: 0,
    retryCount: 0,
    deviceId: ''
  });
  
  const [isPlayerIdReady, setIsPlayerIdReady] = useState(false);
  
  // 弹窗状态
  const [showMyInfo, setShowMyInfo] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [initialSetupOpen, setInitialSetupOpen] = useState(false);
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false);
  const [endActionConfirmOpen, setEndActionConfirmOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ 
    title: string; 
    message: string | React.ReactNode; 
    type: AlertType 
  }>({ title: '', message: '', type: 'info' });
  
  // 移动相关状态
  const [pendingMoveTarget, setPendingMoveTarget] = useState<string>('');
  const [pendingMoveCost, setPendingMoveCost] = useState<number>(0);
  const [pendingHealthCost, setPendingHealthCost] = useState<number>(0);
  const [pendingUseRope, setPendingUseRope] = useState<boolean>(false);
  const [pendingDoubleMove, setPendingDoubleMove] = useState<boolean>(false);
  const [pendingDoubleMoveOptions, setPendingDoubleMoveOptions] = useState<string[]>([]);
  const [doubleMoveDialogOpen, setDoubleMoveDialogOpen] = useState<boolean>(false);
  const [firstMoveTarget, setFirstMoveTarget] = useState<string>('');

  // ===== 关键修改：通用身份确认弹窗（所有角色都会显示） =====
  const [roleRevealOpen, setRoleRevealOpen] = useState(false);
  const [roleRevealInfo, setRoleRevealInfo] = useState<RoleRevealInfo>({
    roleName: '',
    roleDescription: '',
    playerNumber: 0,
    isAccomplice: false
  });

  // 使用 ref 避免重复触发
  const roleRevealShownRef = useRef(false);

  // ===== 关键修复：生成或获取设备唯一标识 =====
  useEffect(() => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      localStorage.setItem('deviceId', deviceId);
    }
    playerIdStateRef.current.deviceId = deviceId;
    console.log('[usePlayerPanel] 设备ID:', deviceId);
  }, []);

  // ===== 根本性修复：安全的 playerId 获取函数 =====
  const getPlayerId = useCallback((): string => {
    const state = playerIdStateRef.current;
    
    // 1. 最高优先级：如果已经初始化且 ID 有效，直接使用
    if (state.isInitialized && state.currentId && state.currentId.length > 5) {
      return state.currentId;
    }
    
    // 2. 尝试从 store 获取（服务器返回的最新数据）
    if (store.myPlayerId && store.myPlayerId.length > 5) {
      // 验证 store 中的 ID 是否在 players 列表中
      const playerInList = players.find(p => p.id === store.myPlayerId);
      if (playerInList) {
        state.currentId = store.myPlayerId;
        state.lastUpdateTime = Date.now();
        console.log('[getPlayerId] 从 store 获取:', store.myPlayerId);
        return store.myPlayerId;
      }
    }
    
    // 3. 尝试从 players 数组匹配（通过 deviceId 或 name）
    const storedDeviceId = localStorage.getItem('deviceId');
    const storedName = localStorage.getItem('myPlayerName');
    
    if (Array.isArray(players) && players.length > 0) {
      // 3.1 尝试通过 deviceId 匹配（如果服务器支持）
      const matchedByDevice = players.find(p => (p as any).deviceId === storedDeviceId);
      if (matchedByDevice) {
        state.currentId = matchedByDevice.id;
        localStorage.setItem('myPlayerId', matchedByDevice.id);
        localStorage.setItem('myPlayerName', matchedByDevice.name);
        console.log('[getPlayerId] 通过 deviceId 匹配:', matchedByDevice.id);
        return matchedByDevice.id;
      }
      
      // 3.2 尝试通过 name 匹配
      if (storedName) {
        const matchedByName = players.find(p => p.name === storedName);
        if (matchedByName) {
          state.currentId = matchedByName.id;
          localStorage.setItem('myPlayerId', matchedByName.id);
          console.log('[getPlayerId] 通过 name 匹配:', matchedByName.id);
          return matchedByName.id;
        }
      }
      
      // 3.3 如果只有一个玩家，且当前没有有效的 ID，使用唯一玩家的 ID
      if (players.length === 1) {
        const onlyPlayer = players[0];
        if (onlyPlayer.id && onlyPlayer.id.length > 5) {
          state.currentId = onlyPlayer.id;
          localStorage.setItem('myPlayerId', onlyPlayer.id);
          localStorage.setItem('myPlayerName', onlyPlayer.name);
          console.log('[getPlayerId] 使用唯一玩家的 ID:', onlyPlayer.id);
          return onlyPlayer.id;
        }
      }
    }
    
    // 4. 最后尝试从 localStorage 获取（但要验证是否在 players 列表中）
    try {
      const storedId = localStorage.getItem('myPlayerId');
      if (storedId && storedId.length > 5 && Array.isArray(players) && players.length > 0) {
        // 验证这个 ID 是否在当前 players 列表中
        const playerExists = players.find(p => p.id === storedId);
        if (playerExists) {
          state.currentId = storedId;
          state.lastUpdateTime = Date.now();
          console.log('[getPlayerId] 从 localStorage 获取并验证:', storedId);
          return storedId;
        } else {
          console.warn('[getPlayerId] localStorage 中的 ID 不在当前 players 列表中:', storedId);
          // ID 不在列表中，清除过期的 localStorage 数据
          localStorage.removeItem('myPlayerId');
          localStorage.removeItem('myPlayerName');
        }
      }
    } catch (e) {
      console.error('[getPlayerId] localStorage access failed:', e);
    }
    
    console.error('[getPlayerId] 无法获取有效的 playerId');
    return '';
  }, [store.myPlayerId, players]);

  // ===== 根本性修复：ID 初始化逻辑 =====
  useEffect(() => {
    const state = playerIdStateRef.current;
    
    // 初始化函数
    const initializePlayerId = () => {
      const id = getPlayerId();
      
      if (id && id.length > 5) {
        state.currentId = id;
        state.isInitialized = true;
        setIsPlayerIdReady(true);
        console.log('[initializePlayerId] 初始化成功:', id);
        return true;
      }
      
      // 如果未成功初始化，增加重试计数
      if (state.retryCount < 30) {
        state.retryCount++;
        console.log(`[initializePlayerId] 重试 ${state.retryCount}/30...`);
        setTimeout(initializePlayerId, 500);
        return false;
      }
      
      // 即使失败也要标记为就绪，避免无限等待
      console.warn('[initializePlayerId] 达到最大重试次数，标记为就绪');
      state.isInitialized = true;
      setIsPlayerIdReady(true);
      return false;
    };
    
    // 延迟执行初始化，确保 store 数据已加载
    const initTimer = setTimeout(initializePlayerId, 300);
    
    // 设置定时器定期更新 ID
    const updateTimer = setInterval(() => {
      // 只在 store.myPlayerId 变化时更新
      if (store.myPlayerId && store.myPlayerId !== playerIdStateRef.current.currentId && store.myPlayerId.length > 5) {
        const playerInList = players.find(p => p.id === store.myPlayerId);
        if (playerInList) {
          playerIdStateRef.current.currentId = store.myPlayerId;
          console.log('[usePlayerPanel] 从 store 更新 playerId:', store.myPlayerId);
        }
      }
    }, 1000);
    
    // 清理函数
    return () => {
      clearTimeout(initTimer);
      clearInterval(updateTimer);
    };
  }, [getPlayerId, store.myPlayerId, players]);

  // 监听 store.myPlayerId 变化
  useEffect(() => {
    if (store.myPlayerId && store.myPlayerId.length > 5) {
      // 验证 store.myPlayerId 是否在 players 列表中
      const playerInList = players.find(p => p.id === store.myPlayerId);
      if (playerInList) {
        playerIdStateRef.current.currentId = store.myPlayerId;
        playerIdStateRef.current.isInitialized = true;
        console.log('[usePlayerPanel] store.myPlayerId 更新:', store.myPlayerId);
      }
    }
  }, [store.myPlayerId, players]);

  // ===== 关键修复：监听 players 变化，更新当前玩家信息 =====
  useEffect(() => {
    if (!Array.isArray(players) || players.length === 0) return;
    
    const state = playerIdStateRef.current;
    const currentId = state.currentId;
    
    // 如果当前有有效的 ID，检查对应的玩家信息是否更新
    if (currentId && currentId.length > 5) {
      const currentPlayerInList = players.find(p => p.id === currentId);
      if (currentPlayerInList) {
        // 更新 localStorage 中的 name
        localStorage.setItem('myPlayerName', currentPlayerInList.name);
        // 如果有 number 字段，也保存
        if ((currentPlayerInList as any).number) {
          localStorage.setItem('myPlayerNumber', String((currentPlayerInList as any).number));
        }
      }
    }
  }, [players]);

  // ===== 根本性修复：currentPlayer 计算逻辑 =====
  const currentPlayer: Player = useMemo(() => {
    const state = playerIdStateRef.current;
    
    // 获取有效的 playerId
    let effectiveId = '';
    
    // 1. 优先使用 ref 中的 ID（如果已验证）
    if (state.isInitialized && state.currentId && state.currentId.length > 5) {
      // 验证这个 ID 是否在当前 players 列表中
      const playerExists = players.find(p => p.id === state.currentId);
      if (playerExists) {
        effectiveId = state.currentId;
      }
    }
    
    // 2. 尝试从 store 获取
    if (!effectiveId && store.myPlayerId && store.myPlayerId.length > 5) {
      const playerInList = players.find(p => p.id === store.myPlayerId);
      if (playerInList) {
        effectiveId = store.myPlayerId;
        state.currentId = store.myPlayerId;
      }
    }
    
    // 3. 尝试通过 name 匹配
    if (!effectiveId && players.length > 0) {
      try {
        const storedName = localStorage.getItem('myPlayerName');
        if (storedName) {
          const matchedPlayer = players.find(p => p.name === storedName);
          if (matchedPlayer && matchedPlayer.id && matchedPlayer.id.length > 5) {
            effectiveId = matchedPlayer.id;
            state.currentId = matchedPlayer.id;
            localStorage.setItem('myPlayerId', matchedPlayer.id);
          }
        }
      } catch (e) {
        console.error('[useCurrentPlayer] 从 players 数组匹配失败:', e);
      }
    }
    
    // 4. 如果只有一个玩家，使用唯一玩家的 ID
    if (!effectiveId && players.length === 1) {
      const onlyPlayer = players[0];
      if (onlyPlayer.id && onlyPlayer.id.length > 5) {
        effectiveId = onlyPlayer.id;
        state.currentId = onlyPlayer.id;
        localStorage.setItem('myPlayerId', onlyPlayer.id);
        localStorage.setItem('myPlayerName', onlyPlayer.name);
      }
    }
    
    // 如果仍然没有有效的 ID，返回加载状态
    if (!effectiveId || effectiveId.length < 5) {
      return {
        ...createDefaultPlayer('loading'),
        name: '正在加载...',
        role: 'unknown' as RoleType,
        id: 'loading',
      };
    }
    
    // 确保 players 是有效数组
    if (!Array.isArray(players) || players.length === 0) {
      return {
        ...createDefaultPlayer(effectiveId),
        name: '等待数据...',
        role: 'unknown' as RoleType,
        id: effectiveId,
      };
    }
    
    // 查找当前玩家
    const found = players.find((p: Player) => p.id === effectiveId);
    
    if (found) {
      // 尝试从 localStorage 获取角色信息（作为备选）
      let effectiveRole = found.role;
      if (!effectiveRole || effectiveRole === 'unknown') {
        try {
          const savedRole = localStorage.getItem('myRole');
          if (savedRole && savedRole !== 'unknown') {
            effectiveRole = savedRole as RoleType;
          }
        } catch (e) {
          console.error('[useCurrentPlayer] 从 localStorage 获取角色失败:', e);
        }
      }
      
      // 构建合并后的玩家对象
      const merged: Player = {
        ...createDefaultPlayer(effectiveId),
        ...found,
        id: found.id || effectiveId,
        name: found.name || `玩家${getPlayerNumber(effectiveId, players)}`,
        role: effectiveRole || 'unknown',
        currentLocation: found.currentLocation || '',
        locationId: found.locationId || found.currentLocation || '',
      };
      
      // 设置玩家编号 - 关键修复：优先使用服务器返回的 number 字段
      const numberFromData = (found as any).number;
      const extractedNumber = extractPlayerNumber(found.name);
      const calculatedNumber = getPlayerNumber(effectiveId, players);
      
      (merged as any).number = numberFromData || extractedNumber || calculatedNumber || 0;
      
      // 保存有效信息到 localStorage
      try {
        localStorage.setItem('myPlayerId', effectiveId);
        localStorage.setItem('myPlayerName', merged.name);
        if (merged.role && merged.role !== 'unknown') {
          localStorage.setItem('myRole', merged.role);
        }
        if ((merged as any).number) {
          localStorage.setItem('myPlayerNumber', String((merged as any).number));
        }
      } catch (e) {
        console.error('[useCurrentPlayer] localStorage 写入失败:', e);
      }
      
      return merged;
    }
    
    // 如果在列表中找不到自己，但 ID 有效，返回临时对象
    const storedName = localStorage.getItem('myPlayerName');
    if (storedName) {
      const nameMatched = players.find(p => p.name === storedName);
      if (nameMatched) {
        const merged: Player = {
          ...createDefaultPlayer(nameMatched.id),
          ...nameMatched,
          id: nameMatched.id,
          name: nameMatched.name,
          role: nameMatched.role || 'unknown',
        };
        (merged as any).number = (nameMatched as any).number || extractPlayerNumber(nameMatched.name) || getPlayerNumber(nameMatched.id, players) || 0;
        
        // 更新 ref 和 localStorage
        playerIdStateRef.current.currentId = nameMatched.id;
        localStorage.setItem('myPlayerId', nameMatched.id);
        
        return merged;
      }
    }
    
    // 返回临时对象
    return {
      ...createDefaultPlayer(effectiveId),
      name: '同步中...',
      role: 'unknown' as RoleType,
      id: effectiveId,
    };
  }, [players, store.myPlayerId, phase, isPlayerIdReady]);

  // 计算当前玩家编号 - 关键修复：优先使用服务器返回的 number 字段
  const playerNumber = useMemo(() => {
    // 优先使用 currentPlayer 中已有的 number 字段
    const serverNumber = (currentPlayer as any).number;
    if (serverNumber && serverNumber > 0) {
      return serverNumber;
    }
    
    // 其次从 name 中提取
    if (currentPlayer.name) {
      const match = currentPlayer.name.match(/(\d+)号玩家/);
      if (match) return parseInt(match[1], 10);
    }
    
    // 最后通过辅助函数计算
    return getPlayerNumber(currentPlayer.id, players);
  }, [currentPlayer.id, currentPlayer.name, (currentPlayer as any).number, players]);

  // Alert 辅助函数
  const showAlert = useCallback((title: string, message: string | React.ReactNode, type: AlertType = 'info') => {
    setAlertConfig({ title, message, type });
    setAlertOpen(true);
  }, []);

  // ===== 关键修改：第一轮行动阶段显示身份确认弹窗（所有角色） =====
  useEffect(() => {
    // 只在第一轮行动阶段触发
    if (round !== 1 || phase !== 'action') {
      return;
    }
    
    // 如果已经显示过弹窗，不再显示
    if (roleRevealShownRef.current) {
      return;
    }

    // 确保当前玩家数据有效
    if (!currentPlayer.role || currentPlayer.role === 'unknown') {
      return;
    }

    // 延迟显示，确保状态已稳定
    const timer = setTimeout(() => {
      // 再次检查是否已显示（防止延迟期间重复触发）
      if (roleRevealShownRef.current) {
        return;
      }

      const playerNum = (currentPlayer as any).number || 
                        extractPlayerNumber(currentPlayer.name) || 
                        getPlayerNumber(currentPlayer.id, players) || 0;

      // 获取角色信息
      const roleName = getRoleName(currentPlayer.role);
      const roleDescription = getRoleDescription(currentPlayer.role);

      // 基础信息
      const revealInfo: RoleRevealInfo = {
        roleName,
        roleDescription,
        playerNumber: playerNum,
        isAccomplice: currentPlayer.role === 'accomplice'
      };

      // 如果是帮凶，添加同伴信息
      if (currentPlayer.role === 'accomplice') {
        const allAccomplices = players.filter(p => 
          p.role === 'accomplice' && p.isAlive
        );

        const accompliceList = allAccomplices.map(p => {
          const num = (p as any).number || 
                     extractPlayerNumber(p.name) || 
                     getPlayerNumber(p.id, players) || 0;
          return {
            number: num,
            name: p.name,
            isMe: p.id === currentPlayer.id
          };
        }).sort((a, b) => a.number - b.number);

        revealInfo.accomplices = accompliceList;
        revealInfo.totalAccomplices = allAccomplices.length;
      }

      // 更新状态并显示弹窗
      setRoleRevealInfo(revealInfo);
      setRoleRevealOpen(true);
      roleRevealShownRef.current = true;
      
    }, 1000);

    return () => clearTimeout(timer);
  }, [round, phase, currentPlayer.role, currentPlayer.id, currentPlayer.name, players]);

  // 处理房间点击
  const handleRoomClick = useCallback((roomId: string) => {
    const room = roomFragments.find(r => r.id === roomId);
    if (!room) return;

    // 第一轮初始位置选择
    if (round === 1 && !currentPlayer.currentLocation) {
      if (isKiller(currentPlayer.role) && !room.isCrimeScene) {
        showAlert('初始位置限制', '作为凶手，你只能从第一或第二案发现场开始行动', 'warning');
        return;
      }
      
      setPendingMoveTarget(roomId);
      setPendingMoveCost(1);
      setPendingHealthCost(0);
      setPendingUseRope(false);
      setPendingDoubleMove(false);
      setMoveConfirmOpen(true);
      return;
    }

    // 点击当前房间
    if (roomId === currentPlayer.currentLocation) {
      showAlert('提示', `你当前就在${room.name}`, 'info');
      return;
    }

    // 检查连接性  
    const currentRoom = roomFragments.find(r => r.id === currentPlayer.currentLocation);
    const isConnected = currentRoom?.connections.includes(roomId);
    
    if (!isConnected) {
      showAlert(
        '无法移动', 
        `从${currentRoom?.name || '当前位置'}无法直接到达${room.name}，必须经由相邻房间`,
        'warning'
      );
      return;
    }

    const hasSki = currentPlayer.items?.includes('ski') || false;
    const hasRope = currentPlayer.items?.includes('rope') || false;
    
    // 绳索反向攀爬
    if (hasRope && canUseRopeReverse(currentPlayer.currentLocation, roomId, hasRope)) {
      setPendingMoveTarget(roomId);
      setPendingMoveCost(0);
      setPendingHealthCost(0);
      setPendingUseRope(true);
      setPendingDoubleMove(false);
      setMoveConfirmOpen(true);
      return;
    }
    
    // 跳楼检查
    const jumpInfo = isJumpMove(currentPlayer.currentLocation, roomId);
    
    if (jumpInfo) {
      if (currentPlayer.health <= jumpInfo.minHealth - 1) {
        showAlert('生命值不足', `跳楼需要至少${jumpInfo.minHealth}点生命值`, 'error');
        return;
      }
      if (currentPlayer.actionPoints < jumpInfo.actionCost) {
        showAlert('行动点不足', `跳楼需要${jumpInfo.actionCost}点行动点`, 'error');
        return;
      }
      
      const jumpCost = getJumpCostWithRope(currentPlayer.currentLocation, roomId, hasRope);
      const actualHealthCost = jumpCost.healthCost;
      
      setPendingMoveTarget(roomId);
      setPendingMoveCost(jumpInfo.actionCost);
      setPendingHealthCost(actualHealthCost);
      setPendingUseRope(hasRope && actualHealthCost === 0);
      setPendingDoubleMove(false);
      setMoveConfirmOpen(true);
      return;
    }
    
    // 普通移动
    const cost = getMoveCost(currentPlayer.currentLocation, roomId, hasSki);
    
    if (currentPlayer.actionPoints < cost) {
      showAlert('行动点不足', `移动到${room.name}需要${cost}点行动点`, 'error');
      return;
    }

    // 双移动检查
    const isSpecialStart = specialStartRooms.includes(currentPlayer.currentLocation);
    const isFirstAction = currentPlayer.actionLine.length === 0;
    
    if (isSpecialStart && isFirstAction && cost === 1 && isIndoor(roomId) && !isGarden(roomId)) {
      const nextRoom = roomFragments.find(r => r.id === roomId);
      const secondOptions = nextRoom?.connections
        .filter(connId => {
          const connRoom = roomFragments.find(r => r.id === connId);
          return connId !== currentPlayer.currentLocation && 
                 isIndoor(connId) && 
                 !isGarden(connId) && 
                 connRoom?.floor === nextRoom?.floor;
        }) || [];
      
      if (secondOptions.length > 0) {
        setPendingDoubleMove(true);
        setPendingDoubleMoveOptions(secondOptions);
        setPendingMoveTarget(roomId);
        setPendingMoveCost(cost);
        setPendingHealthCost(0);
        setPendingUseRope(false);
        setMoveConfirmOpen(true);
        return;
      }
    }

    // 普通移动确认
    setPendingMoveTarget(roomId);
    setPendingMoveCost(cost);
    setPendingHealthCost(0);
    setPendingUseRope(false);
    setPendingDoubleMove(false);
    setMoveConfirmOpen(true);
  }, [currentPlayer, round, showAlert]);

  // ===== 根本性修复：确认移动 =====
  const confirmMove = useCallback(() => {
    const room = roomFragments.find(r => r.id === pendingMoveTarget);
    if (!room) return;

    try {
      // 关键修复：使用多种方式获取有效的 playerId
      let effectiveId = getPlayerId();
      
      // 关键修复：如果 getPlayerId 返回空，尝试直接从 localStorage 获取
      if (!effectiveId) {
        try {
          const storedId = localStorage.getItem('myPlayerId');
          if (storedId && storedId.length > 5) {
            // 验证这个 ID 是否在 players 列表中
            const playerExists = players.find(p => p.id === storedId);
            if (playerExists) {
              effectiveId = storedId;
              playerIdStateRef.current.currentId = storedId;
              console.log('[confirmMove] 从 localStorage 获取 playerId:', storedId);
            }
          }
        } catch (e) {
          console.error('[confirmMove] localStorage 读取失败:', e);
        }
      }
      
      // 关键修复：如果仍然为空，尝试从 store 获取
      if (!effectiveId && store.myPlayerId) {
        effectiveId = store.myPlayerId;
        playerIdStateRef.current.currentId = store.myPlayerId;
        console.log('[confirmMove] 从 store 获取 playerId:', store.myPlayerId);
      }
      
      // 关键修复：如果 players 只有一个玩家，直接使用该玩家的 ID
      if (!effectiveId && Array.isArray(players) && players.length === 1) {
        effectiveId = players[0].id;
        playerIdStateRef.current.currentId = effectiveId;
        localStorage.setItem('myPlayerId', effectiveId);
        console.log('[confirmMove] 使用唯一玩家的 ID:', effectiveId);
      }
      
      // 验证 ID 是否有效
      if (!effectiveId || effectiveId.length < 5) {
        showAlert('错误', '无法获取玩家ID，请刷新页面后重试', 'error');
        console.error('[confirmMove] 无法获取有效的 playerId');
        return;
      }
      
      // 绳索反向攀爬
      if (pendingUseRope && pendingMoveCost === 0 && pendingHealthCost === 0) {
        const hasRope = currentPlayer.items?.includes('rope') || false;
        if (hasRope && canUseRopeReverse(currentPlayer.currentLocation, pendingMoveTarget, hasRope)) {
          sendMessage({
            type: 'PLAYER_ACTION',
            action: 'MOVE',
            locationId: pendingMoveTarget,
            cost: 0,
            playerId: effectiveId,
            useRope: true
          });
          
          setMoveConfirmOpen(false);
          showAlert('移动成功', `使用绳索攀爬到${room.name}，消耗绳索但不消耗行动点`, 'info');
          return;
        }
      }
      
      // 双移动
      if (pendingDoubleMove && pendingMoveCost === 1) {
        setFirstMoveTarget(pendingMoveTarget);
        setDoubleMoveDialogOpen(true);
        setMoveConfirmOpen(false);
        return;
      }
      
      // 普通移动
      setPlayerLocation(effectiveId, pendingMoveTarget, pendingMoveCost);
      
      setMoveConfirmOpen(false);
      
      if (pendingMoveCost > 0) {
        let message = `已移动到${room.name}，消耗${pendingMoveCost}点行动点`;
        if (pendingHealthCost > 0) {
          message += `，受到${pendingHealthCost}点伤害`;
        }
        if (pendingUseRope && pendingHealthCost === 0) {
          message += '（使用绳索免除伤害）';
        }
        showAlert('移动成功', message, 'info');
      } else {
        showAlert('移动成功', `已移动到${room.name}`, 'info');
      }
      
      setPendingHealthCost(0);
      setPendingUseRope(false);
      setPendingDoubleMove(false);
    } catch (error) {
      console.error('移动失败:', error);
      showAlert('移动失败', '请检查网络连接后重试', 'error');
    }
  }, [currentPlayer, pendingMoveTarget, pendingMoveCost, pendingHealthCost, pendingUseRope, pendingDoubleMove, sendMessage, showAlert, setPlayerLocation, getPlayerId, players, store.myPlayerId]);

  // ===== 根本性修复：执行双移动第二步 =====
  const executeDoubleMove = useCallback((secondTarget: string) => {
    const effectiveId = getPlayerId();
    
    if (!effectiveId) {
      showAlert('错误', '无法获取玩家ID，请刷新页面重试', 'error');
      return;
    }
    
    const firstRoom = roomFragments.find(r => r.id === firstMoveTarget);
    const secondRoom = roomFragments.find(r => r.id === secondTarget);
    
    if (!firstRoom || !secondRoom) return;
    
    setPlayerLocation(effectiveId, firstMoveTarget, 1);
    
    setTimeout(() => {
      setPlayerLocation(effectiveId, secondTarget, 0);
      showAlert('双移动完成', `行动1: ${firstRoom.name} → ${secondRoom.name}，共消耗1点行动点`, 'info');
    }, 300);
    
    setDoubleMoveDialogOpen(false);
    setPendingDoubleMove(false);
    setFirstMoveTarget('');
  }, [firstMoveTarget, setPlayerLocation, showAlert, getPlayerId]);

  // ===== 根本性修复：取消双移动 =====
  const cancelDoubleMove = useCallback(() => {
    const effectiveId = getPlayerId();
    
    if (!effectiveId) {
      showAlert('错误', '无法获取玩家ID，请刷新页面重试', 'error');
      return;
    }
    
    setPlayerLocation(effectiveId, firstMoveTarget, 1);
    setDoubleMoveDialogOpen(false);
    setPendingDoubleMove(false);
    setFirstMoveTarget('');
  }, [firstMoveTarget, setPlayerLocation, showAlert, getPlayerId]);

  // ===== 根本性修复：停留 =====
  const handleStay = useCallback(() => {
    if (currentPlayer.actionPoints < 1) {
      showAlert('行动点不足', '停留需要1点行动点', 'error');
      return;
    }
    
    const effectiveId = getPlayerId();
    
    if (!effectiveId) {
      showAlert('错误', '无法获取玩家ID，请刷新页面重试', 'error');
      return;
    }
    
    setPlayerLocation(effectiveId, currentPlayer.currentLocation, 1);
    showAlert('停留', `你在当前位置停留，消耗1点行动点`, 'info');
  }, [currentPlayer, setPlayerLocation, showAlert, getPlayerId]);
  
  // 结束行动
  const handleEndAction = useCallback(() => {
    if (currentPlayer.actionPoints > 0) {
      setEndActionConfirmOpen(true);
    } else {
      doEndAction();
    }
  }, [currentPlayer.actionPoints]);

  // ===== 根本性修复：执行结束行动 =====
  const doEndAction = useCallback(() => {
    try {
      const effectiveId = getPlayerId();
      
      if (!effectiveId) {
        showAlert('错误', '无法获取玩家ID，请刷新页面重试', 'error');
        return;
      }
      
      sendMessage({
        type: 'PLAYER_ACTION',
        action: 'END_ACTION',
        playerId: effectiveId
      });
      setEndActionConfirmOpen(false);
      showAlert('行动结束', '等待其他玩家完成行动', 'info');
    } catch (error) {
      console.error('结束行动失败:', error);
      showAlert('操作失败', '请重试', 'error');
    }
  }, [sendMessage, showAlert, getPlayerId]);

  // ===== 新增：投票功能 =====
  const vote = useCallback((voterId: string, targetId: string) => {
    sendMessage({
      type: 'VOTE',
      voterId,
      targetId
    });
  }, [sendMessage]);

  // 计算当前房间名称和描述
  const currentRoomInfo = useMemo(() => {
    const currentRoomName = !currentPlayer.currentLocation 
      ? '请选择初始位置' 
      : roomFragments.find(r => r.id === currentPlayer.currentLocation)?.name || '未知位置';

    let currentRoomDesc = '';
    if (!currentPlayer.currentLocation) {
      currentRoomDesc = isKiller(currentPlayer.role) 
        ? '作为凶手，请从第一或第二案发现场开始' 
        : '请选择你的起始房间（消耗1点行动点）';
    } else {
      const currentRoom = roomFragments.find(r => r.id === currentPlayer.currentLocation);
      if (currentRoom) {
        const isSpecialRoom = specialStartRooms.includes(currentRoom.id);
        const isFirstAction = currentPlayer.actionLine.length === 0;
        
        if (isSpecialRoom && isFirstAction) {
          currentRoomDesc = '特殊起始位置：消耗1点可连续移动2个室内地点';
        } else {
          const hasRope = currentPlayer.items?.includes('rope');
          if (hasRope) {
            const ropeTargets = ropeReverseRoutes.filter(r => r.from === currentRoom.id);
            if (ropeTargets.length > 0) {
              const targetNames = ropeTargets
                .map(r => roomFragments.find(room => room.id === r.to)?.name)
                .filter((name): name is string => Boolean(name))
                .join('、');
              currentRoomDesc = `可使用绳索攀爬到：${targetNames}（消耗绳索，不消耗行动点）`;
            }
          }
          
          if (!currentRoomDesc && jumpRooms[currentRoom.id]) {
            const jumpConfig = jumpRooms[currentRoom.id];
            const hasRope = currentPlayer.items?.includes('rope');
            const ropeText = hasRope ? '（拥有绳索可免伤害）' : '';
            currentRoomDesc = `可跳楼至：${jumpConfig.targets.map(id => roomFragments.find(r => r.id === id)?.name).filter(Boolean).join('、')}（消耗${jumpConfig.actionCost}行动点+${jumpConfig.healthCost}生命值）${ropeText}`;
          }
          
          if (!currentRoomDesc) {
            const feature = getRoomFeature(currentRoom.id);
            if (feature && typeof feature === 'object' && 'description' in feature) {
              currentRoomDesc = `地点功能：${feature.description}`;
            }
          }
          
          if (!currentRoomDesc) {
            currentRoomDesc = '选择相邻房间进行移动';
          }
        }
      }
    }

    return { currentRoomName, currentRoomDesc };
  }, [currentPlayer.currentLocation, currentPlayer.role, currentPlayer.actionLine, currentPlayer.items]);

  return {
    // 状态
    players,
    phase,
    round,
    fireLocations,
    currentPlayer,
    isPlayerIdReady,
    playerNumber, // 新增：当前玩家编号
    
    // 弹窗状态
    showMyInfo,
    setShowMyInfo,
    showVoteDialog,
    setShowVoteDialog,
    showItemsDialog,
    setShowItemsDialog,
    showSkillDialog,
    setShowSkillDialog,
    initialSetupOpen,
    setInitialSetupOpen,
    moveConfirmOpen,
    setMoveConfirmOpen,
    endActionConfirmOpen,
    setEndActionConfirmOpen,
    alertOpen,
    setAlertOpen,
    alertConfig,
    doubleMoveDialogOpen,
    setDoubleMoveDialogOpen,
    
    // ===== 新增：身份确认弹窗状态 =====
    roleRevealOpen,
    setRoleRevealOpen,
    roleRevealInfo,
    
    // 移动相关
    pendingMoveTarget,
    pendingMoveCost,
    pendingHealthCost,
    pendingUseRope,
    pendingDoubleMove,
    pendingDoubleMoveOptions,
    firstMoveTarget,
    
    // 计算属性
    ...currentRoomInfo,
    
    // 方法
    showAlert,
    handleRoomClick,
    confirmMove,
    executeDoubleMove,
    cancelDoubleMove,
    handleStay,
    handleEndAction,
    doEndAction,
    vote, // 新增：投票方法
  };
}

// 辅助函数：创建默认玩家对象
export function createDefaultPlayer(id: string): Player {
  return {
    id: id || 'unknown',
    name: '加载中...',
    number: 0, // 确保 number 字段存在
    role: 'unknown' as RoleType,
    camp: 'neutral' as CampType,
    health: 3,
    maxHealth: 3,
    actionPoints: 8,
    items: [],
    locationId: '',
    currentLocation: '',
    actionLine: [],
    score: 0,
    isAlive: true,
    isExposed: false,
    visitedLocations: [],
    skillUsedThisRound: false,
    fakeActionLineCount: 0,
    fireCount: 0,
    hasCheckedFan: false,
    totalVotesCorrect: 0,
    isFan: true,
    skillUseCount: 0,
    canVote: false,
  };
}
