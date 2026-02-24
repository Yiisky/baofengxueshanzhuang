/**
 * ============================================
 * 暴风雪山庄游戏系统 - 玩家界面组件（重构版）
 * ============================================
 */

import { useState, useEffect } from 'react';
import { useWebSocketStore } from '@/store/websocketStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Heart, 
  Zap, 
  MapPin, 
  Flame,
  Lightbulb,
  Vote,
  ArrowRightLeft,
  Package,
  Eye,
  CheckCircle,
  Users,
  User
} from 'lucide-react';
import { getLocationById, getLocationsByFloor, getMoveCost } from '@/data/locations';
import { getRoleIcon, getRoleName, getCampColor, getRoleSkillDescription, canVote } from '@/data/roles';
import { cn } from '@/lib/utils';
import type { Player, ItemType, ActionStep } from '@/types/game';

// 道具名称映射
const itemNames: Record<ItemType, string> = {
  bandage: '🩹 绷带',
  powder: '✨ 荧光粉',
  extinguisher: '🧯 灭火器',
  rope: '🪢 绳索',
  ski: '⛷️ 滑雪套装'
};

/**
 * 玩家主界面组件
 */
export function PlayerPanel() {
  const { 
    round, 
    phase, 
    players, 
    fireLocations, 
    lightLocations,
    vote,
    roomCode
  } = useWebSocketStore();

  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [showMyInfoDialog, setShowMyInfoDialog] = useState(false);
  
  // 从 localStorage 获取当前玩家ID
  const currentPlayerId = localStorage.getItem('myPlayerId') || '';
  
  // 找到当前玩家
  const currentPlayer = players.find(p => p.id === currentPlayerId);

  // 如果没有当前玩家，显示等待加入
  if (!currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-[#aaaaaa]">等待加入游戏...</p>
          <p className="text-[#666] text-sm mt-2">
            如果没有自动跳转，请重新输入房间码加入
          </p>
        </div>
      </div>
    );
  }

  // 如果游戏还没开始（lobby或config阶段），显示等待开始界面
  if (phase === 'lobby' || phase === 'config') {
    return <WaitingLobby 
      players={players} 
      currentPlayer={currentPlayer}
    />;
  }

  // 阶段名称映射
  const phaseNames: Record<string, string> = {
    lobby: '等待开始',
    config: '配置中',
    free: '自由阶段',
    action: '行动阶段',
    settlement: '结算阶段',
    ended: '游戏结束'
  };

  // 获取当前玩家编号
  const playerNumber = players.findIndex(p => p.id === currentPlayer.id) + 1;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      {/* 顶部状态栏 - 左边玩家编号，右边生命值+行动点 */}
      <header 
        className="flex items-center justify-between p-4"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          borderBottom: '1px solid #d4a853'
        }}
      >
        {/* 左边：玩家编号 */}
        <div className="flex items-center gap-2">
          <span className="text-[#aaaaaa]">玩家</span>
          <span 
            className="text-2xl font-bold"
            style={{ color: '#d4a853' }}
          >
            {playerNumber}
          </span>
        </div>
        
        {/* 右边：生命值 + 行动点 */}
        <div className="flex items-center gap-4">
          {/* 生命值 */}
          <div 
            className="flex items-center gap-1 px-3 py-1 rounded"
            style={{ background: 'rgba(201, 48, 44, 0.2)' }}
          >
            <Heart className="w-5 h-5 text-[#c9302c]" />
            <span className="text-[#f5f5f5] font-bold">{currentPlayer.health}</span>
          </div>
          
          {/* 行动点 */}
          <div 
            className="flex items-center gap-1 px-3 py-1 rounded"
            style={{ background: 'rgba(212, 168, 83, 0.2)' }}
          >
            <Zap className="w-5 h-5 text-[#d4a853]" />
            <span className="text-[#f5f5f5] font-bold">{currentPlayer.actionPoints}</span>
          </div>
        </div>
      </header>

      {/* 提示文字 */}
      <div className="text-center py-3">
        <p className="text-[#d4a853] text-lg font-medium">
          请点击地图进行行动
        </p>
      </div>

      {/* 地图区域 - 使用背景图 */}
      <div 
        className="relative mx-4 rounded-lg overflow-hidden"
        style={{
          height: 'calc(100vh - 200px)',
          backgroundImage: 'url(/images/Action%20Map.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#1a1a1a',
          border: '2px solid #d4a853'
        }}
      >
        {/* 这里可以添加地图上的交互点，如果需要的话 */}
      </div>

      {/* 右下角：我的信息图标 */}
      <button
        onClick={() => setShowMyInfoDialog(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #d4a853 0%, #b8941d 100%)',
          boxShadow: '0 4px 15px rgba(212, 168, 83, 0.4)',
          border: '2px solid #d4a853'
        }}
      >
        <User className="w-7 h-7 text-[#0a0a0a]" />
      </button>

      {/* 我的信息弹窗 */}
      <Dialog open={showMyInfoDialog} onOpenChange={setShowMyInfoDialog}>
        <DialogContent 
          className="max-w-md max-h-[90vh] overflow-y-auto p-0"
          style={{ background: '#1a1a1a', border: '2px solid #d4a853' }}
        >
          <MyInfoPanel 
            player={currentPlayer} 
            players={players}
            onClose={() => setShowMyInfoDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 投凶弹窗 */}
      <Dialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <DialogContent style={{ background: '#1a1a1a', border: '2px solid #d4a853' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#d4a853' }}>秘密投凶</DialogTitle>
          </DialogHeader>
          <VotePanel 
            players={players}
            currentPlayer={currentPlayer}
            onVote={(targetId) => {
              vote(currentPlayer.id, targetId);
              setShowVoteDialog(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * 等待开始界面 - 显示背景图和MCITY欢迎模块
 */
function WaitingLobby({ 
  players,
  currentPlayer
}: { 
  players: Player[];
  currentPlayer: Player;
}) {
  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{
        backgroundImage: 'url(/images/main-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/70" />
      
      {/* 主卡片 */}
      <div 
        className="relative z-10 w-full max-w-md p-8 rounded-xl"
        style={{
          background: 'rgba(26, 26, 26, 0.95)',
          border: '2px solid #d4a853',
          boxShadow: '0 0 30px rgba(212, 168, 83, 0.3)'
        }}
      >
        {/* 标题 */}
        <h1 
          className="text-center text-3xl font-bold mb-2"
          style={{ 
            color: '#d4a853',
            textShadow: '0 0 20px rgba(212, 168, 83, 0.5)'
          }}
        >
          暴风雪山庄
        </h1>
        
        <p className="text-[#aaaaaa] text-center text-sm mb-6">
          10人阵营对抗 · 5轮推理博弈
        </p>
        
        {/* 欢迎来到MCITY模块 */}
        <div 
          className="text-center mb-6 p-6 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.2) 0%, rgba(212, 168, 83, 0.05) 100%)',
            border: '2px solid #d4a853'
          }}
        >
          <div className="text-[#d4a853] text-sm mb-2 tracking-widest">WELCOME TO</div>
          <div 
            className="text-5xl font-bold tracking-wider"
            style={{ 
              color: '#d4a853',
              textShadow: '0 0 30px rgba(212, 168, 83, 0.8)'
            }}
          >
            MCITY
          </div>
          <div className="mt-3 text-[#aaaaaa] text-sm">
            沉浸式推理游戏体验
          </div>
        </div>
        
        {/* 玩家信息 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[#d4a853]">
              <Users className="w-5 h-5" />
              <span className="font-bold">玩家列表</span>
            </div>
            <span className="text-[#aaaaaa] text-sm">
              {players.length}/10人
            </span>
          </div>
          
          {/* 玩家列表 - 不显示身份图标 */}
          <div 
            className="space-y-2 max-h-48 overflow-y-auto p-3 rounded-lg"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid #444'
            }}
          >
            {players.map((player, index) => (
              <div 
                key={player.id}
                className="flex items-center justify-between p-2 rounded"
                style={{
                  background: player.id === currentPlayer.id 
                    ? 'rgba(212, 168, 83, 0.2)' 
                    : 'rgba(42, 42, 42, 0.5)',
                  border: player.id === currentPlayer.id 
                    ? '1px solid #d4a853' 
                    : '1px solid transparent'
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#d4a853] text-sm font-bold">{index + 1}</span>
                  <span className={player.id === currentPlayer.id ? 'text-[#d4a853]' : 'text-[#f5f5f5]'}>
                    {player.name}
                    {player.id === currentPlayer.id && ' (你)'}
                  </span>
                </div>
                {/* 不显示身份图标，显示问号 */}
                <span className="text-2xl text-[#666]">❓</span>
              </div>
            ))}
            
            {/* 空位提示 */}
            {players.length < 10 && (
              <div className="text-center text-[#666] text-sm py-2">
                等待其他玩家加入...
              </div>
            )}
          </div>
        </div>
        
        {/* 等待提示 */}
        <div 
          className="text-center p-4 rounded-lg"
          style={{
            background: 'rgba(212, 168, 83, 0.1)',
            border: '1px solid #d4a853'
          }}
        >
          <div className="flex items-center justify-center gap-2 text-[#d4a853] mb-2">
            <span className="inline-block w-2 h-2 bg-[#d4a853] rounded-full animate-pulse" />
            <span className="font-bold">等待主持人开始游戏</span>
          </div>
          <p className="text-[#aaaaaa] text-sm">
            主持人配置完成后将自动进入游戏
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 我的信息面板 - 合并我的信息和道具
 */
function MyInfoPanel({ 
  player, 
  players,
  onClose 
}: { 
  player: Player;
  players: Player[];
  onClose: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
  const [tradeTarget, setTradeTarget] = useState<string>('');
  const [tradeItem, setTradeItem] = useState<ItemType | null>(null);
  const { createTradeRequest } = useWebSocketStore();

  // 获取当前玩家编号
  const playerNumber = players.findIndex(p => p.id === player.id) + 1;

  const handleCreateTrade = () => {
    if (selectedItem && tradeTarget && tradeItem) {
      createTradeRequest(player.id, tradeTarget, selectedItem, tradeItem);
      alert('交易请求已发送！');
      setSelectedItem(null);
      setTradeTarget('');
      setTradeItem(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* 头部：玩家编号及身份 */}
      <div className="text-center pb-4 border-b border-[#333]">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-[#aaaaaa]">玩家</span>
          <span className="text-3xl font-bold text-[#d4a853]">{playerNumber}</span>
        </div>
        <div className="text-5xl mb-2">{getRoleIcon(player.role)}</div>
        <div className="text-xl font-bold text-[#f5f5f5]">{getRoleName(player.role)}</div>
        <div 
          className="text-sm mt-1 font-medium"
          style={{ color: getCampColor(player.camp) }}
        >
          {player.camp === 'killer' && '凶手阵营'}
          {player.camp === 'detective' && '侦探阵营'}
          {player.camp === 'neutral' && '中立阵营'}
        </div>
      </div>

      {/* 生命值 + 行动点 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 生命值 */}
        <div 
          className="text-center p-4 rounded-lg"
          style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' }}
        >
          <Heart className="w-8 h-8 text-[#c9302c] mx-auto mb-2" />
          <div className="text-3xl font-bold text-[#f5f5f5]">{player.health}</div>
          <div className="text-xs text-[#aaaaaa]">生命值</div>
        </div>
        
        {/* 行动点 */}
        <div 
          className="text-center p-4 rounded-lg"
          style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' }}
        >
          <Zap className="w-8 h-8 text-[#d4a853] mx-auto mb-2" />
          <div className="text-3xl font-bold text-[#f5f5f5]">{player.actionPoints}</div>
          <div className="text-xs text-[#aaaaaa]">行动点</div>
        </div>
      </div>

      {/* 我的道具 */}
      <div>
        <h4 className="text-[#d4a853] font-bold mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" />
          我的道具
        </h4>
        
        {player.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {player.items.map((item, idx) => (
              <div 
                key={idx}
                className="p-3 rounded-lg text-center"
                style={{
                  background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                  border: '1px solid #444'
                }}
              >
                <div className="text-[#f5f5f5]">{itemNames[item]}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[#666] text-center py-4 mb-4">暂无道具</div>
        )}

        {/* 发起交易 */}
        {player.items.length > 0 && (
          <div 
            className="p-3 rounded-lg space-y-2"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid #444'
            }}
          >
            <div className="text-[#aaaaaa] text-sm mb-2">发起交易</div>
            
            <Select value={selectedItem || ''} onValueChange={(v) => setSelectedItem(v as ItemType)}>
              <SelectTrigger style={{ background: '#2a2a2a', borderColor: '#444', color: '#f5f5f5' }}>
                <SelectValue placeholder="选择要交易的道具" />
              </SelectTrigger>
              <SelectContent style={{ background: '#2a2a2a', borderColor: '#444' }}>
                {player.items.map(item => (
                  <SelectItem key={item} value={item} className="text-[#f5f5f5]">
                    {itemNames[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tradeTarget} onValueChange={setTradeTarget}>
              <SelectTrigger style={{ background: '#2a2a2a', borderColor: '#444', color: '#f5f5f5' }}>
                <SelectValue placeholder="选择交易对象" />
              </SelectTrigger>
              <SelectContent style={{ background: '#2a2a2a', borderColor: '#444' }}>
                {players.filter(p => p.id !== player.id).map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-[#f5f5f5]">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tradeItem || ''} onValueChange={(v) => setTradeItem(v as ItemType)}>
              <SelectTrigger style={{ background: '#2a2a2a', borderColor: '#444', color: '#f5f5f5' }}>
                <SelectValue placeholder="想要获得的道具" />
              </SelectTrigger>
              <SelectContent style={{ background: '#2a2a2a', borderColor: '#444' }}>
                {(['bandage', 'powder', 'extinguisher', 'rope', 'ski'] as ItemType[]).map(item => (
                  <SelectItem key={item} value={item} className="text-[#f5f5f5]">
                    {itemNames[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleCreateTrade}
              disabled={!selectedItem || !tradeTarget || !tradeItem}
              className="w-full font-bold"
              style={{
                background: selectedItem && tradeTarget && tradeItem
                  ? 'linear-gradient(135deg, #d4a853 0%, #b8941d 100%)'
                  : '#444',
                color: '#0a0a0a'
              }}
            >
              <ArrowRightLeft className="w-4 h-4 mr-1" />
              发起交易
            </Button>
          </div>
        )}
      </div>

      {/* 当前位置 */}
      <div 
        className="flex items-center justify-between p-3 rounded-lg"
        style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' }}
      >
        <span className="text-[#aaaaaa] flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          当前位置
        </span>
        <span className="text-[#f5f5f5] font-bold">
          {getLocationById(player.currentLocation)?.name || '未设置'}
        </span>
      </div>

      {/* 已访问地点 */}
      <div 
        className="p-3 rounded-lg"
        style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' }}
      >
        <div className="text-[#aaaaaa] text-sm mb-2 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          已访问地点 ({player.visitedLocations.length})
        </div>
        <div className="text-xs text-[#666] max-h-20 overflow-auto">
          {player.visitedLocations.map(locId => 
            getLocationById(locId)?.name
          ).filter(Boolean).join(', ') || '无'}
        </div>
      </div>

      {/* 我的技能 */}
      <div 
        className="p-4 rounded-lg"
        style={{ 
          background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
          border: '1px solid #d4a853'
        }}
      >
        <h4 className="text-[#d4a853] font-bold mb-2">我的技能</h4>
        <p className="text-sm text-[#aaaaaa]">{getRoleSkillDescription(player.role)}</p>
      </div>

      {/* 关闭按钮 */}
      <Button
        onClick={onClose}
        className="w-full font-bold"
        style={{
          background: 'linear-gradient(135deg, #d4a853 0%, #b8941d 100%)',
          color: '#0a0a0a'
        }}
      >
        关闭
      </Button>
    </div>
  );
}

/**
 * 投凶面板
 */
function VotePanel({ 
  players, 
  currentPlayer,
  onVote 
}: { 
  players: Player[];
  currentPlayer: Player;
  onVote: (targetId: string) => void;
}) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  return (
    <div className="space-y-4">
      <p className="text-[#aaaaaa] text-sm">
        请选择你认为的凶手。投凶正确可获得1分。
      </p>
      
      <div className="space-y-2 max-h-64 overflow-auto">
        {players.filter(p => p.id !== currentPlayer.id).map(player => (
          <div
            key={player.id}
            onClick={() => setSelectedTarget(player.id)}
            className={cn(
              "p-3 rounded border cursor-pointer transition-all"
            )}
            style={{
              borderColor: selectedTarget === player.id ? '#c9302c' : '#444',
              backgroundColor: selectedTarget === player.id ? 'rgba(201, 48, 44, 0.2)' : '#2a2a2a'
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[#f5f5f5]">{player.name}</span>
              {selectedTarget === player.id && (
                <CheckCircle className="w-5 h-5 text-[#c9302c]" />
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={() => selectedTarget && onVote(selectedTarget)}
        disabled={!selectedTarget}
        className="w-full font-bold"
        style={{
          background: selectedTarget ? '#c9302c' : '#444',
          color: 'white'
        }}
      >
        确认投凶
      </Button>
    </div>
  );
}