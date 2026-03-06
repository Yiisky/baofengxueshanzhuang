// src/components/host/PlayerAdminPanel.tsx
/**
 * 主持人玩家管理面板
 * 用于实时调整玩家状态（血量、行动点、道具）
 */

import React, { useState, useEffect } from 'react';
import { X, Heart, Zap, Package, Plus, Minus, UserCog, AlertTriangle } from 'lucide-react';
import type { Player, ItemType } from '@/types/game';
import { useWebSocketStore } from '@/store/websocketStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// 管理命令类型
type AdminCommandType = 
  | 'ADD_HEALTH' 
  | 'REMOVE_HEALTH' 
  | 'ADD_ACTION_POINTS' 
  | 'REMOVE_ACTION_POINTS'
  | 'ADD_ITEM'
  | 'REMOVE_ITEM';

interface AdminCommand {
  type: AdminCommandType;
  targetPlayerId: string;
  value?: number;
  itemType?: ItemType;
  reason?: string;
}

interface PlayerAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  selectedPlayer?: Player | null;
}

const itemOptions: { value: ItemType; label: string; icon: string }[] = [
  { value: 'bandage', label: '急救绷带', icon: '🩹' },
  { value: 'powder', label: '荧光粉', icon: '✨' },
  { value: 'extinguisher', label: '灭火器', icon: '🧯' },
  { value: 'rope', label: '登山绳', icon: '🪢' },
  { value: 'ski', label: '滑雪套装', icon: '⛷️' },
];

const commandOptions: { value: AdminCommandType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'ADD_HEALTH', label: '增加血量', icon: <Plus className="w-4 h-4" />, color: '#2ca02c' },
  { value: 'REMOVE_HEALTH', label: '减少血量', icon: <Minus className="w-4 h-4" />, color: '#c9302c' },
  { value: 'ADD_ACTION_POINTS', label: '增加行动点', icon: <Plus className="w-4 h-4" />, color: '#d4a853' },
  { value: 'REMOVE_ACTION_POINTS', label: '减少行动点', icon: <Minus className="w-4 h-4" />, color: '#ff6b35' },
];

export const PlayerAdminPanel: React.FC<PlayerAdminPanelProps> = ({
  isOpen,
  onClose,
  players,
  selectedPlayer: initialSelectedPlayer
}) => {
  const { sendMessage, myHostId } = useWebSocketStore();
  const [selectedPlayer, setSelectedPlayer] = useState<string>(initialSelectedPlayer?.id || '');
  const [selectedCommand, setSelectedCommand] = useState<AdminCommandType>('ADD_HEALTH');
  const [amount, setAmount] = useState<number>(1);
  const [selectedItem, setSelectedItem] = useState<ItemType>('bandage');
  const [reason, setReason] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<AdminCommand | null>(null);

  // 当初始选中玩家变化时更新
  useEffect(() => {
    if (initialSelectedPlayer) {
      setSelectedPlayer(initialSelectedPlayer.id);
    }
  }, [initialSelectedPlayer]);

  if (!isOpen) return null;

  const handleExecute = () => {
    if (!selectedPlayer) {
      alert('请选择目标玩家');
      return;
    }

    const isItemCommand = selectedCommand === 'ADD_ITEM' || selectedCommand === 'REMOVE_ITEM';
    
    const command: AdminCommand = {
      type: selectedCommand,
      targetPlayerId: selectedPlayer,
      value: isItemCommand ? undefined : amount,
      itemType: isItemCommand ? selectedItem : undefined,
      reason: reason || undefined
    };

    setPendingCommand(command);
    setShowConfirm(true);
  };

  const confirmExecute = () => {
    if (!pendingCommand || !myHostId) return;

    const message = {
      type: 'ADMIN_COMMAND',
      command: pendingCommand,
      hostPlayerId: myHostId
    };

    sendMessage(message);

    setShowConfirm(false);
    setPendingCommand(null);
    
    // 重置表单
    setSelectedPlayer('');
    setAmount(1);
    setReason('');
  };

  const isItemCommand = selectedCommand === 'ADD_ITEM' || selectedCommand === 'REMOVE_ITEM';
  const selectedPlayerData = players.find(p => p.id === selectedPlayer);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-[#0a0a0a] border-[#d4a853] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-[#333] bg-[#d4a853]/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl text-[#d4a853] flex items-center gap-2">
              <UserCog className="w-6 h-6" />
              玩家管理
            </DialogTitle>
            <Badge variant="outline" className="border-[#d4a853] text-[#d4a853]">
              主持人专用
            </Badge>
          </div>
          <p className="text-[#aaaaaa] text-sm mt-1">
            实时调整玩家状态（血量、行动点、道具）
          </p>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* 玩家选择 */}
          <div>
            <label className="block text-[#aaaaaa] text-sm mb-3 font-bold">
              选择玩家 {initialSelectedPlayer && <span className="text-[#d4a853]">(已预选)</span>}
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player.id)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    selectedPlayer === player.id
                      ? "bg-[#d4a853]/20 border-[#d4a853] text-[#d4a853]"
                      : "bg-[#1a1a1a] border-[#444] text-[#f5f5f5] hover:border-[#d4a853]/50"
                  )}
                >
                  <div className="font-bold">{player.name}</div>
                  <div className="text-xs mt-1 flex items-center gap-2">
                    <span className="text-[#c9302c]">❤️ {player.health}</span>
                    <span className="text-[#d4a853]">⚡ {player.actionPoints}</span>
                    <span className="text-[#4CAF50]">🎒 {player.items?.length || 0}</span>
                    {!player.isAlive && (
                      <span className="text-[#666] ml-auto">💀 已出局</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 操作类型 */}
          <div>
            <label className="block text-[#aaaaaa] text-sm mb-3 font-bold">
              操作类型
            </label>
            <div className="grid grid-cols-2 gap-2">
              {commandOptions.map((cmd) => (
                <button
                  key={cmd.value}
                  onClick={() => setSelectedCommand(cmd.value)}
                  className={cn(
                    "p-3 rounded-lg border flex items-center gap-2 transition-all",
                    selectedCommand === cmd.value
                      ? "bg-[#d4a853]/20 border-[#d4a853] text-[#d4a853]"
                      : "bg-[#1a1a1a] border-[#444] text-[#f5f5f5] hover:border-[#d4a853]/50"
                  )}
                >
                  <span style={{ color: cmd.color }}>{cmd.icon}</span>
                  <span className="font-bold">{cmd.label}</span>
                </button>
              ))}
            </div>
            
            {/* 道具操作按钮 */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setSelectedCommand('ADD_ITEM')}
                className={cn(
                  "p-3 rounded-lg border flex items-center gap-2 transition-all",
                  selectedCommand === 'ADD_ITEM'
                    ? "bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]"
                    : "bg-[#1a1a1a] border-[#444] text-[#f5f5f5] hover:border-[#4CAF50]/50"
                )}
              >
                <Plus className="w-4 h-4" />
                <Package className="w-4 h-4" />
                <span className="font-bold">添加道具</span>
              </button>
              <button
                onClick={() => setSelectedCommand('REMOVE_ITEM')}
                className={cn(
                  "p-3 rounded-lg border flex items-center gap-2 transition-all",
                  selectedCommand === 'REMOVE_ITEM'
                    ? "bg-[#c9302c]/20 border-[#c9302c] text-[#c9302c]"
                    : "bg-[#1a1a1a] border-[#444] text-[#f5f5f5] hover:border-[#c9302c]/50"
                )}
              >
                <Minus className="w-4 h-4" />
                <Package className="w-4 h-4" />
                <span className="font-bold">移除道具</span>
              </button>
            </div>
          </div>

          {/* 数量或道具选择 */}
          {isItemCommand ? (
            <div>
              <label className="block text-[#aaaaaa] text-sm mb-3 font-bold">
                选择道具
              </label>
              <div className="grid grid-cols-3 gap-2">
                {itemOptions.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setSelectedItem(item.value)}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all",
                      selectedItem === item.value
                        ? "bg-[#d4a853]/20 border-[#d4a853] text-[#d4a853]"
                        : "bg-[#1a1a1a] border-[#444] text-[#f5f5f5] hover:border-[#d4a853]/50"
                    )}
                  >
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="text-sm font-bold">{item.label}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[#aaaaaa] text-sm mb-3 font-bold">
                数量
              </label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setAmount(Math.max(1, amount - 1))}
                  className="w-12 h-12 border-[#444] text-[#f5f5f5] hover:bg-[#d4a853] hover:text-[#0a0a0a]"
                >
                  <Minus className="w-5 h-5" />
                </Button>
                <div className="w-24 h-12 rounded-lg bg-[#1a1a1a] border border-[#444] flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#d4a853]">{amount}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setAmount(Math.min(10, amount + 1))}
                  className="w-12 h-12 border-[#444] text-[#f5f5f5] hover:bg-[#d4a853] hover:text-[#0a0a0a]"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* 原因（可选） */}
          <div>
            <label className="block text-[#aaaaaa] text-sm mb-3 font-bold">
              操作原因（可选）
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：主持人调整、游戏补偿等"
              className="w-full p-3 rounded-lg bg-[#1a1a1a] border border-[#444] text-[#f5f5f5] placeholder-[#666] focus:border-[#d4a853] outline-none"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-6 pt-4 border-t border-[#333] bg-[#0a0a0a]">
          <Button
            onClick={handleExecute}
            disabled={!selectedPlayer}
            className="w-full py-6 bg-[#d4a853] text-[#0a0a0a] font-bold text-lg hover:bg-[#e5b964] disabled:opacity-50"
          >
            执行操作
          </Button>
        </div>
      </DialogContent>

      {/* 确认对话框 */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-[#0a0a0a] border-[#d4a853] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#d4a853] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              确认操作
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-[#cccccc] py-4">
            <div className="p-3 bg-[#1a1a1a] rounded-lg space-y-2">
              <p className="flex justify-between">
                <span className="text-[#aaaaaa]">目标玩家:</span>
                <span className="text-[#f5f5f5] font-bold">
                  {selectedPlayerData?.name}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-[#aaaaaa]">操作类型:</span>
                <span className="text-[#d4a853] font-bold">
                  {commandOptions.find(c => c.value === pendingCommand?.type)?.label || 
                   (pendingCommand?.type === 'ADD_ITEM' ? '添加道具' : 
                    pendingCommand?.type === 'REMOVE_ITEM' ? '移除道具' : '未知')}
                </span>
              </p>
              {pendingCommand?.value && (
                <p className="flex justify-between">
                  <span className="text-[#aaaaaa]">数量:</span>
                  <span className="text-[#d4a853] font-bold">{pendingCommand.value}</span>
                </p>
              )}
              {pendingCommand?.itemType && (
                <p className="flex justify-between">
                  <span className="text-[#aaaaaa]">道具:</span>
                  <span className="text-[#d4a853] font-bold">
                    {itemOptions.find(i => i.value === pendingCommand.itemType)?.label}
                  </span>
                </p>
              )}
              {pendingCommand?.reason && (
                <p className="flex justify-between">
                  <span className="text-[#aaaaaa]">原因:</span>
                  <span className="text-[#aaaaaa]">{pendingCommand.reason}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="flex-1 border-[#444] text-[#aaaaaa] hover:bg-[#1a1a1a]"
            >
              取消
            </Button>
            <Button
              onClick={confirmExecute}
              className="flex-1 bg-[#d4a853] text-[#0a0a0a] font-bold hover:bg-[#e5b964]"
            >
              确认执行
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default PlayerAdminPanel;