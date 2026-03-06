// 道具弹窗组件
import React, { useState } from 'react';
import { X, Package, Check, AlertCircle } from 'lucide-react';
import type { Player, ItemType } from '@/types/game';
import { useItems } from '@/hooks/useItems';
import { itemDetails } from '@/data/roomFeatures';
import { ConfirmDialog } from './ConfirmDialog';

interface ItemsDialogProps {
  isOpen: boolean;
  player: Player;
  players?: Player[]; // 可选的其他玩家列表
  onClose: () => void;
}

export const ItemsDialog: React.FC<ItemsDialogProps> = ({ isOpen, player, players = [], onClose }) => {
  const { getAllItemsStatus, useItem } = useItems(player);
  const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
  const [showUseConfirm, setShowUseConfirm] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState<string>('');

  const allItems = getAllItemsStatus();

  const handleItemClick = (itemId: ItemType, owned: boolean, usable: boolean) => {
    if (!owned) return; // 未拥有的道具不能点击
    if (!usable) {
      alert('行动点不足，无法使用该道具');
      return;
    }
    
    const itemDetail = allItems.find(i => i.id === itemId)?.detail;
    if (!itemDetail) return;

    // 滑雪套装是被动道具，不能主动使用
    if (itemId === 'ski') {
      return;
    }

    setSelectedItem(itemId);
    setShowUseConfirm(true);
  };

  const handleUseItem = () => {
    if (!selectedItem) return;
    useItem(selectedItem, targetPlayerId || undefined);
    setShowUseConfirm(false);
    setSelectedItem(null);
    setTargetPlayerId('');
    onClose();
  };

  if (!isOpen) return null;

  const selectedItemDetail = selectedItem ? allItems.find(i => i.id === selectedItem)?.detail : null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div 
          className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#d4a853] flex items-center gap-2">
                <Package className="w-6 h-6" />
                我的道具
              </h2>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#aaaaaa] active:bg-[#d4a853] active:text-[#0a0a0a] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 显示当前行动点 */}
            <div className="mb-4 p-3 rounded-lg bg-[#2a2a2a] border border-[#444]">
              <div className="text-[#aaaaaa] text-sm">
                当前行动点: <span className="text-[#d4a853] font-bold text-lg">{player.actionPoints}</span>
              </div>
            </div>

            <div className="space-y-3">
              {allItems.map(({ id, owned, usable, detail }) => (
                <div
                  key={id}
                  onClick={() => handleItemClick(id, owned, usable)}
                  className={`p-4 rounded-lg border transition-all ${
                    owned 
                      ? usable
                        ? 'bg-[#1a2f1a] border-[#4CAF50] cursor-pointer hover:bg-[#2a3f2a]'
                        : 'bg-[#2a1a1a] border-[#c9302c] cursor-not-allowed opacity-80'
                      : 'bg-[#2a2a2a] border-[#444] opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`font-bold text-lg ${owned ? 'text-[#4CAF50]' : 'text-[#aaaaaa]'}`}>
                          {detail.name}
                        </span>
                        {owned && (
                          <span className="px-2 py-0.5 rounded-full bg-[#4CAF50] text-[#0a0a0a] text-xs font-bold">
                            已拥有
                          </span>
                        )}
                        {detail.consumable && owned && (
                          <span className="px-2 py-0.5 rounded-full bg-[#d4a853] text-[#0a0a0a] text-xs font-bold">
                            消耗品
                          </span>
                        )}
                        {owned && detail.useCost > 0 && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            usable ? 'bg-[#5bc0de] text-[#0a0a0a]' : 'bg-[#c9302c] text-white'
                          }`}>
                            -{detail.useCost}行动点
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[#cccccc] text-sm mb-2">{detail.description}</p>
                      
                      <div className="space-y-1 text-xs">
                        <p className="text-[#aaaaaa]">
                          <span className="text-[#d4a853]">使用方法：</span>{detail.usage}
                        </p>
                        <p className="text-[#aaaaaa]">
                          <span className="text-[#d4a853]">效果：</span>{detail.effect}
                        </p>
                        {detail.useCost > 0 && (
                          <p className={usable ? 'text-[#4CAF50]' : 'text-[#c9302c]'}>
                            <span className="text-[#d4a853]">使用消耗：</span>
                            {detail.useCost}点行动点
                            {!usable && '（行动点不足）'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {owned && id !== 'ski' && usable && (
                      <div className="ml-4 flex items-center justify-center w-10 h-10 rounded-full bg-[#4CAF50]/20 text-[#4CAF50]">
                        <Check className="w-5 h-5" />
                      </div>
                    )}
                    {owned && id === 'ski' && (
                      <div className="ml-4 px-2 py-1 rounded bg-[#aaaaaa]/20 text-[#aaaaaa] text-xs">
                        被动
                      </div>
                    )}
                    {owned && !usable && id !== 'ski' && (
                      <div className="ml-4 px-2 py-1 rounded bg-[#c9302c]/20 text-[#c9302c] text-xs">
                        不可用
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-[#2a2a2a] border border-[#444]">
              <div className="flex items-center gap-2 text-[#aaaaaa] text-sm">
                <AlertCircle className="w-4 h-4 text-[#d4a853]" />
                <span>绿色背景道具为已拥有，点击可使用。红色背景表示行动点不足。</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 使用道具确认弹窗 */}
      <ConfirmDialog
        isOpen={showUseConfirm}
        title={`使用${selectedItemDetail?.name}`}
        message={
          <div className="space-y-3">
            <p>确认使用{selectedItemDetail?.name}？</p>
            <div className="p-3 rounded bg-[#2a2a2a] text-sm space-y-1">
              <p className="text-[#aaaaaa]">效果：{selectedItemDetail?.effect}</p>
              <p className="text-[#aaaaaa]">
                消耗：{selectedItemDetail && selectedItemDetail.useCost > 0 ? `${selectedItemDetail.useCost}点行动点` : '无消耗'}
              </p>
              <p className="text-[#aaaaaa]">道具：消耗该道具</p>
            </div>
            {selectedItem === 'powder' && players.length > 0 && (
              <div className="mt-3">
                <p className="text-[#aaaaaa] text-sm mb-2">选择目标玩家：</p>
                <select 
                  className="w-full p-2 rounded bg-[#2a2a2a] border border-[#444] text-[#f5f5f5]"
                  value={targetPlayerId}
                  onChange={(e) => setTargetPlayerId(e.target.value)}
                >
                  <option value="">请选择玩家</option>
                  {players
                    .filter(p => p.id !== player.id && p.isAlive)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>
            )}
            {selectedItem === 'powder' && players.length === 0 && (
              <div className="mt-3 p-2 rounded bg-[#c9302c]/20 text-[#c9302c] text-sm">
                没有其他玩家可选
              </div>
            )}
          </div>
        }
        confirmText="确认使用"
        cancelText="取消"
        onConfirm={handleUseItem}
        onCancel={() => {
          setShowUseConfirm(false);
          setSelectedItem(null);
          setTargetPlayerId('');
        }}
        type="info"
      />
    </>
  );
};

export default ItemsDialog;