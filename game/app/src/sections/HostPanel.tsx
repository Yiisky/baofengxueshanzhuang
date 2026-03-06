// src/sections/HostPanel.tsx
// 修改：支持历史数据传递和更好的重连体验

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocketStore } from '@/store/websocketStore';
import { Button } from '@/components/ui/button';
import { 
  Trophy,
  Play,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  Users,
  Wifi
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 导入组件
import { PlayerAdminPanel } from '@/components/host/PlayerAdminPanel';
import { GameReviewDialog } from '@/components/host/GameReviewDialog';
import { RoundTabsPanel } from '@/components/host/RoundTabsPanel';
import { PlayerStatusCards } from '@/components/host/PlayerStatusCards';
import { RoleAssignmentPanel } from '@/components/host/RoleAssignmentPanel';
import type { Player, RoleType, GameState } from '@/types/game';
import type { RoundHistory } from '@/types/roundTabs';

// 本地存储键名
const STORAGE_KEYS = {
  HOST_PLAYER_ID: 'hostPlayerId',
  ROOM_CODE: 'roomCode',
  IS_HOST: 'isHost'
};

// WebSocket 消息数据类型
interface WsMessageData {
  type: string;
  serverRestarted?: boolean;
  isHost?: boolean;
  hostPlayerId?: string;
  roomCode?: string;
  roundHistories?: RoundHistory[];
  shouldReset?: boolean;
  message?: string;
  playerId?: string;
  role?: RoleType;
}

// src/sections/HostPanel.tsx

export function HostPanel() {
  const store = useWebSocketStore();
  
  // 使用 useState 和 useEffect 强制监听 players 变化
  const [displayPlayers, setDisplayPlayers] = useState<Player[]>([]);
  // ✅ 添加：定义 lastUpdateTime state（如果你需要它）
  const [, setLastUpdateTime] = useState<number>(Date.now());
  
  const { 
    round = 1, 
    phase = 'config', 
    players = [],
    roomCode = '',
    myPlayerId,
    isConnected = false,
    myHostId,
    resetGame,  // ✅ 确保从 store 解构
    sendMessage,  // ✅ 确保从 store 解构
    roundHistories: storeHistories  // ✅ 重命名获取
  } = store;

  // 关键修复：确保 players 变化时更新 displayPlayers，添加更严格的检查
  useEffect(() => {
    console.log('[HostPanel] players 变化:', players?.length, '列表:', players?.map((p: Player) => ({name: p.name, number: p.number, role: p.role})));
    
    if (Array.isArray(players)) {
      // 深拷贝确保 React 检测到变化
      const newPlayers = players.map(p => ({
        ...p,
        // 确保 number 字段有效
        number: (p as any).number || parseInt(p.name?.match(/(\d+)号玩家/)?.[1] || '0') || 0,
      }));
      setDisplayPlayers(newPlayers);
      setLastUpdateTime(Date.now());
    }
  }, [players, round, phase]); // 添加 round 和 phase 作为依赖，确保阶段切换时更新

  // 强制刷新机制
  useEffect(() => {
    const interval = setInterval(() => {
      if (Array.isArray(store.players) && store.players.length !== displayPlayers.length) {
        console.log('[HostPanel] 检测到玩家数量不匹配，强制刷新');
        setDisplayPlayers([...store.players]);
        setLastUpdateTime(Date.now());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [store.players, displayPlayers.length]);

  const isHost = !!myHostId && !!myPlayerId && myHostId === myPlayerId;

  // 修复：使用 displayPlayers 确保实时更新
  const allPlayers = displayPlayers.length > 0 ? displayPlayers : (store as any).players || [];
  console.log('[HostPanel] allPlayers:', allPlayers.length, allPlayers.map((p: Player) => p.name));

  const [showReconnectDialog, setShowReconnectDialog] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [showPlayerAdmin, setShowPlayerAdmin] = useState<boolean>(false);
  const [showGameReview, setShowGameReview] = useState<boolean>(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  
  // 本地历史数据备份
  const [localHistories, setLocalHistories] = useState<RoundHistory[]>([]);

  const phaseNames: Record<string, string> = {
    lobby: '等待开始',
    config: '配置中',
    free: '自由阶段',
    action: '行动阶段',
    settlement: '结算阶段',
    ended: '游戏结束'
  };

  // 合并服务器和本地历史数据
  const effectiveHistories = storeHistories || localHistories;

  // 重连逻辑优化
  const hasAttemptedReconnect = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialChecked = useRef(false);

  const attemptReconnectHost = useCallback(async () => {
    // 防止重复重连
    if (hasAttemptedReconnect.current) {
      console.log('[HostPanel] 已经尝试过重连，跳过');
      return;
    }
    
    const savedHostId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    const savedRoomCode = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
    const savedIsHost = localStorage.getItem(STORAGE_KEYS.IS_HOST) === 'true';

    console.log('[HostPanel] 尝试重连:', { savedHostId, savedRoomCode, savedIsHost });

    if (savedIsHost && savedHostId && savedRoomCode && sendMessage) {
      hasAttemptedReconnect.current = true;
      setIsReconnecting(true);
      
      try {
        sendMessage({ 
          type: 'RECONNECT_HOST', 
          roomCode: savedRoomCode, 
          hostPlayerId: savedHostId 
        });
        
        // 清除之前的定时器
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // 等待响应 - 延长等待时间到5秒
        reconnectTimeoutRef.current = setTimeout(() => {
          // 检查是否仍然是主持人（通过 store 中的状态）
          const currentHostId = store.myHostId;
          const currentPlayerId = store.myPlayerId;
          
          console.log('[HostPanel] 重连检查:', { currentHostId, currentPlayerId, isHost: currentHostId === currentPlayerId });
          
          if (currentHostId !== currentPlayerId) {
            // 重连失败
            console.log('[HostPanel] 重连失败，清除状态');
            clearHostStorage();
            setConnectionError('房间已过期或不存在，请创建新房间');
            setShowReconnectDialog(true);
          } else {
            console.log('[HostPanel] 重连成功确认');
          }
          setIsReconnecting(false);
        }, 5000);
      } catch (error) {
        console.error('[HostPanel] 重连出错:', error);
        clearHostStorage();
        setIsReconnecting(false);
      }
    } else {
      console.log('[HostPanel] 没有保存的主持人信息，不需要重连');
    }
  }, [sendMessage, store.myHostId, store.myPlayerId]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const clearHostStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.HOST_PLAYER_ID);
    localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
    localStorage.removeItem(STORAGE_KEYS.IS_HOST);
  }, []);

  const saveHostState = useCallback((hostPlayerId: string, roomCode: string) => {
    localStorage.setItem(STORAGE_KEYS.HOST_PLAYER_ID, hostPlayerId);
    localStorage.setItem(STORAGE_KEYS.ROOM_CODE, roomCode);
    localStorage.setItem(STORAGE_KEYS.IS_HOST, 'true');
  }, []);

  // 监听消息处理重连和错误
  useEffect(() => {
    if (!isConnected) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WsMessageData;
        
        // 服务器重启后重连
        if (data.type === 'CONNECTED' && data.serverRestarted) {
          console.log('[HostPanel] 检测到服务器重启，尝试重连');
          // 重置重连标记，允许再次重连
          hasAttemptedReconnect.current = false;
          attemptReconnectHost();
        }
        
        // 创建房间成功，保存状态
        if (data.type === 'ROOM_CREATED' && data.isHost && data.hostPlayerId && data.roomCode) {
          console.log('[HostPanel] 房间创建成功，保存状态:', data.hostPlayerId, data.roomCode);
          saveHostState(data.hostPlayerId, data.roomCode);
        }
        
        // 重连成功
        if (data.type === 'RECONNECT_HOST_SUCCESS') {
          console.log('[HostPanel] 收到重连成功消息');
          // 保存历史数据
          if (data.roundHistories) {
            setLocalHistories(data.roundHistories);
          }
          // 清除重连状态
          setIsReconnecting(false);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
        }
        
        // 重连失败或错误
        if (data.type === 'ERROR' && data.shouldReset) {
          console.log('[HostPanel] 收到错误，需要重置:', data.message);
          clearHostStorage();
          setConnectionError(data.message || '连接已过期');
          setShowReconnectDialog(true);
          setIsReconnecting(false);
        }
        
        // 房间重置
        if (data.type === 'ROOM_RESET' || data.type === 'RESET_SUCCESS') {
          console.log('[HostPanel] 房间已重置');
          clearHostStorage();
          window.location.reload();
        }
      } catch (error) {
        console.error('Message handling error:', error);
      }
    };
    
    // 使用 store 中的 WebSocket 或全局 WebSocket
    const ws = (store as any).ws || (window as unknown as { gameWebSocket?: WebSocket }).gameWebSocket;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => ws.removeEventListener('message', handleMessage);
    }
  }, [isConnected, attemptReconnectHost, saveHostState, clearHostStorage, store]);

  // 初始重连检查
  useEffect(() => {
    if (hasInitialChecked.current) return;
    hasInitialChecked.current = true;
    
    // 页面加载时检查是否需要重连
    const savedHostId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    const savedRoomCode = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
    
    console.log('[HostPanel] 初始检查:', { savedHostId, savedRoomCode, isHost, isConnected });
    
    // 如果已经有主持人身份，不需要重连
    if (isHost) {
      console.log('[HostPanel] 已经是主持人，不需要重连');
      return;
    }
    
    // 如果有保存的主持人信息且已连接，尝试重连
    if (savedHostId && savedRoomCode && isConnected) {
      // 延迟执行，确保 WebSocket 完全就绪
      const timer = setTimeout(() => {
        attemptReconnectHost();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isHost, isConnected, attemptReconnectHost]);

  // 操作函数
const handleStartGame = () => {
  if (!isHost) {
    alert('只有主持人可以开始游戏');
    return;
  }
  
  const unassignedPlayers = players.filter((p: Player) => !p.role || p.role === 'unknown');
  if (unassignedPlayers.length > 0) {
    const names = unassignedPlayers.map((p: Player) => p.name).join(', ');
    if (!confirm(`以下玩家尚未分配身份：${names}\n\n是否继续开始游戏？`)) return;
  }
  
  // 关键修复：优先使用 store 中的 myHostId，它应该是最新的
  // 其次使用 localStorage，最后使用 myPlayerId
  let effectiveHostId = myHostId || localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID) || myPlayerId;
  const effectiveRoomCode = roomCode || localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
  
  // 关键修复：确保 ID 没有被截断（检查长度）
  if (effectiveHostId && effectiveHostId.length < 10) {
    console.warn('[HostPanel] hostId 可能不完整，尝试从 store 获取:', { 
      currentId: effectiveHostId, 
      storeMyHostId: myHostId,
      storeMyPlayerId: myPlayerId 
    });
    // 如果太短，优先使用 store 的值
    effectiveHostId = myHostId || myPlayerId || effectiveHostId;
  }
  
  console.log('[HostPanel] 开始游戏:', { 
    hostPlayerId: effectiveHostId, 
    hostIdLength: effectiveHostId?.length,
    roomCode: effectiveRoomCode 
  });
  
  if (!effectiveHostId) {
    alert('错误：无法获取主持人ID，请刷新页面重试');
    return;
  }
  
  if (!effectiveRoomCode) {
    alert('错误：无法获取房间号，请刷新页面重试');
    return;
  }
  
  if (sendMessage) {
    sendMessage({ 
      type: 'START_GAME', 
      hostPlayerId: effectiveHostId,
      roomCode: effectiveRoomCode
    });
  } else {
    alert('错误：无法连接到服务器');
  }
};
  const handleNextPhase = () => {
    const hostPlayerId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    if (sendMessage) {
      sendMessage({ type: 'NEXT_PHASE', hostPlayerId });
    }
  };

  const handleResetGame = () => {
    if (!isHost) return alert('只有主持人可以重置游戏');
    if (!confirm('确定要重置房间吗？所有玩家将被断开连接。')) return;
    
    const hostPlayerId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    if (sendMessage) {
      sendMessage({ type: 'RESET_ROOM', hostPlayerId });
    }
    clearHostStorage();
    if (resetGame) {
      resetGame();
    }
  };

  const handleForceReset = () => {
    clearHostStorage();
    if (sendMessage) {
      sendMessage({ type: 'DISCONNECT' });
    }
    window.location.reload();
  };

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setShowPlayerAdmin(true);
  };

  const handleSetRole = (playerId: string, role: RoleType) => {
    if (!isHost) {
      alert('只有主持人可以设置身份');
      return;
    }
    const hostPlayerId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    if (sendMessage) {
      sendMessage({
        type: 'SET_ROLE',
        playerId: playerId,
        role: role,
        hostPlayerId: hostPlayerId
      });
    }
  };

  const handleClearAll = () => {
    players.forEach((p: Player) => {
      if (p.role && p.role !== 'unknown') {
        handleSetRole(p.id, 'unknown');
      }
    });
  };

  // 重连中显示
  if (isReconnecting) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#d4a853] rounded-lg p-8 text-center">
        <Wifi className="w-12 h-12 text-[#d4a853] mx-auto mb-4 animate-pulse" />
        <h2 className="text-[#d4a853] text-xl mb-4">正在重新连接主持人...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4a853] mx-auto" />
        <p className="text-[#aaaaaa] mt-4 text-sm">房间号: {localStorage.getItem(STORAGE_KEYS.ROOM_CODE)}</p>
      </div>
    </div>
  );

  // 重连失败显示
  if (showReconnectDialog) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#d4a853] rounded-lg p-8 max-w-md">
        <h2 className="text-[#d4a853] text-xl mb-4 flex items-center gap-2">
          <AlertCircle className="w-6 h-6" /> 连接已断开
        </h2>
        <p className="text-[#aaaaaa] mb-6">{connectionError || '与服务器连接已断开'}</p>
        <Button onClick={handleForceReset} className="w-full bg-[#d4a853] text-[#0a0a0a]">
          返回首页重新创建房间
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* 顶部状态栏 */}
      <header className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-[#333] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-[#666] text-sm">房间号</span>
                <span className="text-2xl font-bold text-[#d4a853] tracking-wider font-mono">
                  {roomCode || '----'}
                </span>
              </div>
              
              <div className="w-px h-8 bg-[#444]" />
              
              <div className="flex items-center gap-2">
                <span className="text-[#666] text-sm">当前轮次</span>
                <span className="text-xl font-bold text-[#d4a853]">第 {round} 轮</span>
              </div>
              
              <div className="w-px h-8 bg-[#444]" />
              
              <div className="flex items-center gap-2">
                <span className="text-[#666] text-sm">阶段</span>
                <span className="text-lg text-[#f5f5f5]">{phaseNames[phase] || phase}</span>
              </div>
              
              {/* 连接状态指示 */}
              <div className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded",
                isConnected ? "bg-[#2ca02c]/20 text-[#2ca02c]" : "bg-[#c9302c]/20 text-[#c9302c]"
              )}>
                <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-[#2ca02c]" : "bg-[#c9302c]")} />
                {isConnected ? '已连接' : '未连接'}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setShowGameReview(true)} 
                className="bg-[#5bc0de] text-white hover:bg-[#4aa0bd]"
              >
                <Trophy className="w-4 h-4 mr-1" /> 复盘结算
              </Button>

              {phase === 'config' && (
                <Button 
                  onClick={handleStartGame} 
                  disabled={!isHost || players.length < 1}
                  className="bg-[#2ca02c] text-white hover:bg-[#259025] disabled:opacity-50"
                >
                  <Play className="w-4 h-4 mr-1" /> 开始游戏
                </Button>
              )}
              
              {phase !== 'config' && phase !== 'lobby' && phase !== 'ended' && (
                <Button 
                  onClick={handleNextPhase} 
                  disabled={!isHost} 
                  className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b] disabled:opacity-50"
                >
                  {phase === 'settlement' && round >= 5 ? '结束游戏' : '下一阶段'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              {phase === 'ended' && (
                <Button 
                  onClick={() => setShowGameReview(true)} 
                  className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b]"
                >
                  <Trophy className="w-4 h-4 mr-1" /> 复盘结算
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={handleResetGame} 
                disabled={!isHost}
                className="border-[#c9302c] text-[#c9302c] hover:bg-[#c9302c]/10 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> 重置房间
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 space-y-6">
        {phase === 'config' ? (
          // 配置阶段：显示身份分配面板
          <RoleAssignmentPanel
  players={displayPlayers}
  onAssignRole={handleSetRole}
  onBatchAssign={(assignments: Record<string, RoleType>) => {
    Object.entries(assignments).forEach(([playerId, role]) => {
      handleSetRole(playerId, role);
    });
  }}
  onClearAll={handleClearAll}
  isHost={isHost}
/>
        ) : (
          <>
            {/* 实时玩家状态 */}
            <section className="bg-[#1a1a1a] rounded-lg border border-[#333] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#333] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#d4a853]" />
                <h2 className="text-lg font-bold text-[#d4a853]">实时玩家状态</h2>
                <span className="text-sm text-[#666] ml-auto">{players.length}/10人</span>
              </div>
              <div className="p-4">
               <PlayerStatusCards players={displayPlayers} onPlayerClick={handlePlayerClick} />
              </div>
            </section>

            {/* 轮次信息选项卡 - 传入历史数据 */}
            <section className="bg-[#1a1a1a] rounded-lg border border-[#333] overflow-hidden min-h-[600px]">
              <RoundTabsPanel 
                gameState={store as GameState} 
                currentRound={round}
                roundHistories={effectiveHistories}
              />
            </section>
          </>
        )}
      </main>

      {/* 弹窗 */}
      {showPlayerAdmin && (
        <PlayerAdminPanel
          isOpen={showPlayerAdmin}
          onClose={() => { setShowPlayerAdmin(false); setSelectedPlayer(null); }}
          players={players}
          selectedPlayer={selectedPlayer}
        />
      )}

      {showGameReview && (
        <GameReviewDialog
          isOpen={showGameReview}
          onClose={() => setShowGameReview(false)}
          gameState={store as GameState}
          onReset={handleResetGame}
        />
      )}
    </div>
  );
}