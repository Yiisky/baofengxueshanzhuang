// 道具使用弹窗组件
import React, { useState } from 'react';
import { X, Heart, Eye, Flame } from 'lucide-react';
import type { ItemType, Player } from '@/types/game';
import { itemDetails } from '@/data/roomFeatures';
import { useItems } from '@/hooks/useItems';

interface ItemUseDialogProps {
  isOpen: boolean;
  player: Player;
  players: Player[];
  onClose: () => void;
}

export const ItemUseDialog: React.FC<ItemUseDialogProps> = ({
  isOpen,
  player,
  players,
  onClose
}) => {
  const { hasItem, getItemDetail, useItem, getAllItemsStatus } = useItems(player);
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  if (!isOpen) return null;

  const handleUseItem = () => {
    if (!selectedItem) return;
    
    const detail = getItemDetail(selectedItem);
    
    // 检查是否需要选择目标
    if (selectedItem === 'powder' && !selectedTarget) {
      alert('请选择要标记的目标玩家');
      return;
    }
    
    // 检查行动点
    if (player.actionPoints < detail.useCost) {
      alert(`行动点不足，需要 ${detail.useCost} 点`);
      return;
    }
    
    useItem(selectedItem, selectedTarget || undefined);
    onClose();
    setSelectedItem(null);
    setSelectedTarget('');
  };

  const getItemIcon = (itemId: ItemType) => {
    switch (itemId) {
      case 'bandage': return <Heart className="w-6 h-6 text-red-500" />;
      case 'powder': return <Eye className="w-6 h-6 text-purple-500" />;
      case 'extinguisher': return <Flame className="w-6 h-6 text-orange-500" />;
      default: return null;
    }
  };

  const itemsStatus = getAllItemsStatus().filter(s => s.owned && s.detail.consumable);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#1a1a1a] border border-[#d4a853] rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#d4a853]">使用道具</h2>
          <button onClick={onClose} className="text-[#aaaaaa] hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 text-sm text-[#aaaaaa]">
          当前行动点: <span className="text-[#d4a853] font-bold">{player.actionPoints}</span>
        </div>

        {itemsStatus.length === 0 ? (
          <p className="text-[#aaaaaa] text-center py-4">没有可使用的道具</p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {itemsStatus.map((status) => (
                <button
                  key={status.id}
                  onClick={() => setSelectedItem(status.id)}
                  disabled={!status.usable}
                  className={`w-full flex items-center gap-3 p-3 rounded border transition-all ${
                    selectedItem === status.id
                      ? 'bg-[#d4a853]/20 border-[#d4a853]'
                      : status.usable
                        ? 'bg-[#2a2a2a] border-[#444] hover:border-[#d4a853]'
                        : 'bg-[#1a1a1a] border-[#333] opacity-50 cursor-not-allowed'
                  }`}
                >
                  {getItemIcon(status.id)}
                  <div className="text-left flex-1">
                    <div className="text-[#f5f5f5] font-bold flex items-center gap-2">
                      {status.detail.name}
                      <span className="text-xs px-2 py-0.5 rounded bg-[#d4a853]/20 text-[#d4a853]">
                        -{status.detail.useCost}行动点
                      </span>
                    </div>
                    <div className="text-[#aaaaaa] text-sm">{status.detail.description}</div>
                    <div className="text-[#4CAF50] text-xs mt-1">{status.detail.effect}</div>
                    {!status.usable && (
                      <div className="text-[#c9302c] text-xs mt-1">行动点不足</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* 荧光粉需要选择目标 */}
            {selectedItem === 'powder' && (
              <div className="mb-4">
                <label className="block text-[#aaaaaa] text-sm mb-2">选择目标玩家：</label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded p-2 text-[#f5f5f5]"
                >
                  <option value="">请选择...</option>
                  {players
                    .filter(p => p.id !== player.id && p.isAlive)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded border border-[#444] text-[#aaaaaa] hover:bg-[#2a2a2a]"
              >
                取消
              </button>
              <button
                onClick={handleUseItem}
                disabled={!selectedItem || (selectedItem === 'powder' && !selectedTarget)}
                className="flex-1 py-2 rounded bg-[#d4a853] text-[#0a0a0a] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e5b964]"
              >
                确认使用
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ItemUseDialog;