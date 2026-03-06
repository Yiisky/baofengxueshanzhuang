//双移动选择弹窗

import React from 'react';
import { roomFragments } from '@/data/roomFragments';
import { isIndoor } from '@/utils/movementRules';

interface DoubleMoveDialogProps {
  isOpen: boolean;
  firstMoveTarget: string;
  options: string[];
  onSelect: (roomId: string) => void;
  onCancel: () => void;
}

export const DoubleMoveDialog: React.FC<DoubleMoveDialogProps> = ({
  isOpen,
  firstMoveTarget,
  options,
  onSelect,
  onCancel
}) => {
  if (!isOpen) return null;

  const firstRoom = roomFragments.find(r => r.id === firstMoveTarget);

  return (
    <div 
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
      onClick={onCancel}
    >
      <div 
        className="bg-[#1a1a1a] border-2 rounded-xl max-w-sm w-full p-6 shadow-2xl border-[#d4a853]"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-center text-[#d4a853]">
          双移动 - 选择第二个地点
        </h3>
        
        <div className="text-[#cccccc] text-center mb-6 leading-relaxed">
          <p className="mb-2">
            你已选择移动到 <span className="text-[#d4a853] font-bold">{firstRoom?.name}</span>
          </p>
          <p className="text-sm text-[#aaaaaa]">消耗1点行动点，可再移动一个相邻室内地点</p>
        </div>
        
        <div className="space-y-2 mb-4">
          {options.map(roomId => {
            const room = roomFragments.find(r => r.id === roomId);
            if (!room || !isIndoor(roomId)) return null;
            return (
              <button
                key={roomId}
                onClick={() => onSelect(roomId)}
                className="w-full py-3 rounded-lg bg-[#2a2a2a] text-[#f5f5f5] font-bold active:bg-[#d4a853] active:text-[#0a0a0a] transition-colors border border-[#444] hover:border-[#d4a853]"
              >
                {room.name}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold active:bg-[#333] transition-colors"
        >
          取消第二次移动
        </button>
      </div>
    </div>
  );
};