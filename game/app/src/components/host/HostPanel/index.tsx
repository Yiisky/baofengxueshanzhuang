// src/components/host/HostPanel/index.tsx
import { useState, useEffect, useCallback } from 'react';
import { useWebSocketStore, type WebSocketStoreReturn } from '@/store/websocketStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Flame,
  Lightbulb,
  Play,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  UserCog,
  Trophy,
  Skull
} from 'lucide-react';
import { getRoleIcon, getRoleName, getCampColor } from '@/data/roles';
import { cn } from '@/lib/utils';
import { PlayerAdminPanel } from '@/components/host/PlayerAdminPanel';
import { GameReviewDialog } from '@/components/host/GameReviewDialog';
import { PublicInfoPanel } from '@/components/host/PublicInfoPanel';
import { RoundInfoTabs } from '@/components/host/RoundInfoTabs';
import { PlayerStatusPanel } from '@/components/host/PlayerStatusPanel';
import type { Player } from '@/types/game';

// 本地存储键名
const STORAGE_KEYS = {
  HOST_PLAYER_ID: 'hostPlayerId',
  ROOM_CODE: 'roomCode',
  IS_HOST: 'isHost'
};

export function HostPanel() {
  const store = useWebSocketStore();
  
  // 解构需要的字段，使用默认值
  const { 
    round = 1, 
    phase = 'config', 
    players = [], 
    fireLocations = [], 
    lightLocations = [],
    roomCode = '',
    myPlayerId,
    isConnected,
    myHostId,
    resetGame,
    sendMessage
  } = store;

  const isHost = !!myHostId && !!myPlayerId && myHostId === myPlayerId;

  const [selectedRound, setSelectedRound] = useState(round);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showPlayerAdmin, setShowPlayerAdmin] = useState(false);
  const [showGameReview, setShowGameReview] = useState(false);

  const phaseNames: Record<string, string> = {
    lobby: '等待开始',
    config: '配置中',
    free: '自由阶段',
    action: '行动阶段',
    settlement: '结算阶段',
    ended: '游戏结束'
  };

  // 重连逻辑（保持原有逻辑）
  const attemptReconnectHost = useCallback(async () => {
    const savedHostId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    const savedRoomCode = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
    const savedIsHost = localStorage.getItem(STORAGE_KEYS.IS_HOST) === 'true';

    if (savedIsHost && savedHostId && savedRoomCode) {
      setIsReconnecting(true);
      try {
        sendMessage({ type: 'RECONNECT_HOST', roomCode: savedRoomCode, hostPlayerId: savedHostId });
        setTimeout(() => {
          if (!isHost) {
            clearHostStorage();
            setConnectionError('房间已过期或不存在，请创建新房间');
            setShowReconnectDialog(true);
          }
          setIsReconnecting(false);
        }, 2000);
      } catch (error) {
        clearHostStorage();
        setIsReconnecting(false);
      }
    }
  }, [sendMessage, isHost]);

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

  useEffect(() => {
    if (!isConnected) return;
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'CONNECTED' && data.serverRestarted) attemptReconnectHost();
        if (data.type === 'ROOM_CREATED' && data.isHost && data.hostPlayerId) saveHostState(data.hostPlayerId, data.roomCode);
        if (data.type === 'ERROR' && data.shouldReset) {
          clearHostStorage();
          setConnectionError(data.message || '连接已过期');
          setShowReconnectDialog(true);
        }
        if (data.type === 'ROOM_RESET' || data.type === 'RESET_SUCCESS') {
          clearHostStorage();
          window.location.reload();
        }
      } catch (error) {}
    };
    const ws = (window as any).gameWebSocket;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => ws.removeEventListener('message', handleMessage);
    }
  }, [isConnected, attemptReconnectHost, saveHostState, clearHostStorage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedHostId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
      const savedRoomCode = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
      if (savedHostId && savedRoomCode && !isHost && isConnected) attemptReconnectHost();
    }, 500);
    return () => clearTimeout(timer);
  }, [isHost, isConnected, attemptReconnectHost]);

  // 操作函数
  const handleStartGame = () => {
    if (!isHost) return alert('只有主持人可以开始游戏');
    const hostPlayerId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    sendMessage({ type: 'START_GAME', hostPlayerId });
  };

  const handleNextPhase = () => {
    const hostPlayerId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    sendMessage({ type: 'NEXT_PHASE', hostPlayerId });
  };

  const handleResetGame = () => {
    if (!isHost) return alert('只有主持人可以重置游戏');
    if (!confirm('确定要重置房间吗？所有玩家将被断开连接。')) return;
    const hostPlayerId = localStorage.getItem(STORAGE_KEYS.HOST_PLAYER_ID);
    sendMessage({ type: 'RESET_ROOM', hostPlayerId });
    clearHostStorage();
    resetGame();
  };

  const handleForceReset = () => {
    clearHostStorage();
    sendMessage({ type: 'DISCONNECT' });
    window.location.reload();
  };

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setShowPlayerAdmin(true);
  };

  if (isReconnecting) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#d4a853] rounded-lg p-8 text-center">
        <h2 className="text-[#d4a853] text-xl mb-4">正在重新连接...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4a853] mx-auto" />
      </div>
    </div>
  );

  if (showReconnectDialog) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#d4a853] rounded-lg p-8 max-w-md">
        <h2 className="text-[#d4a853] text-xl mb-4 flex items-center gap-2">
          <AlertCircle className="w-6 h-6" /> 连接已断开
        </h2>
        <p className="text-[#aaaaaa] mb-6">{connectionError || '与服务器连接已断开'}</p>
        <Button onClick={handleForceReset} className="w-full bg-[#d4a853] text-[#0a0a0a]">
          返回首页
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col h-screen overflow-hidden">
      {/* 顶部状态栏 */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#1a1a1a] border-b border-[#333] shrink-0">
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
          
          <div className="w-px h-8 bg-[#444]" />
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-[#c9302c] text-[#c9302c] bg-[#c9302c]/10">
              <Flame className="w-3 h-3 mr-1" /> {fireLocations.length}
            </Badge>
            <Badge variant="outline" className="border-[#5bc0de] text-[#5bc0de] bg-[#5bc0de]/10">
              <Lightbulb className="w-3 h-3 mr-1" /> {lightLocations.length}
            </Badge>
          </div>

          {isHost && <Badge className="bg-[#d4a853] text-[#0a0a0a] ml-2">👑 主持人</Badge>}
        </div>
        
        <div className="flex items-center gap-3">
          {phase === 'config' && (
            <Button onClick={handleStartGame} disabled={!isHost} className="bg-[#2ca02c] text-white hover:bg-[#259025] disabled:opacity-50">
              <Play className="w-4 h-4 mr-1" /> 开始游戏
            </Button>
          )}
          
          {phase !== 'config' && phase !== 'lobby' && phase !== 'ended' && (
            <Button onClick={handleNextPhase} disabled={!isHost} className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b] disabled:opacity-50">
              {phase === 'settlement' && round >= 5 ? '结束游戏' : '进入下一阶段'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}

          {phase === 'ended' && (
            <Button onClick={() => setShowGameReview(true)} className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b]">
              <Trophy className="w-4 h-4 mr-1" /> 查看复盘
            </Button>
          )}
          
          <Button variant="outline" onClick={() => setShowPlayerAdmin(true)} disabled={!isHost} 
            className="border-[#4CAF50] text-[#4CAF50] hover:bg-[#4CAF50]/10 disabled:opacity-50">
            <UserCog className="w-4 h-4 mr-1" /> 玩家管理
          </Button>
          
          <Button variant="outline" onClick={handleResetGame} disabled={!isHost}
            className="border-[#c9302c] text-[#c9302c] hover:bg-[#c9302c]/10 disabled:opacity-50">
            <RotateCcw className="w-4 h-4 mr-1" /> 重置房间
          </Button>
        </div>
      </header>

      {/* 主内容区 - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：玩家状态面板 - 固定宽度 280px */}
        <div className="w-[280px] bg-[#1a1a1a] border-r border-[#333] overflow-y-auto shrink-0">
          <PlayerStatusPanel players={players} onPlayerClick={handlePlayerClick} />
        </div>

        {/* 中间：轮次信息 - 自适应宽度 */}
        <div className="flex-1 bg-[#0a0a0a] overflow-hidden flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-[#333] shrink-0">
            <h2 className="text-lg font-bold text-[#d4a853]">轮次信息</h2>
          </div>
                    <div className="flex-1 overflow-auto p-4">
            <RoundInfoTabs 
              gameState={store as any}
              currentRound={round}
              selectedRound={selectedRound}
              onSelectRound={setSelectedRound}
            />
          </div>
        </div>

                {/* 右侧：公示信息面板 - 固定宽度 360px */}
        <div className="w-[360px] bg-[#1a1a1a] border-l border-[#333] overflow-y-auto shrink-0">
          <PublicInfoPanel gameState={store as any} />
        </div>
      </div>

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
          gameState={store as any}
          onReset={handleResetGame}
        />
      )}
    </div>
  );
}