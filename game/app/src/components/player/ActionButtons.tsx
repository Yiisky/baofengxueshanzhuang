//底部操作按钮组组件

// src/components/player/ActionButtons.tsx
import React from 'react';
import { Package, Zap } from 'lucide-react';
import type { Player } from '@/types/game';
import RoomFeatureButton from './dialogs/RoomFeatureButton';

interface ActionButtonsProps {
  currentPlayer: Player;
  phase: string;
  round: number;
  onShowMyInfo: () => void;
  onShowItems: () => void;
  onShowVote: () => void;
  onShowSkill: () => void;
  onStay: () => void;
  showAlert: (title: string, message: React.ReactNode, type: 'info' | 'warning' | 'error') => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  currentPlayer,
  phase,
  onShowMyInfo,
  onShowItems,
  onShowVote,
  onShowSkill,
  onStay,
  showAlert
}) => {
  return (
    <div className="flex items-center justify-center gap-3 w-full flex-wrap">
      {/* 我的信息按钮 */}
      <button 
        onClick={onShowMyInfo}
        className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#d4a853] text-[#0a0a0a] text-sm font-bold active:scale-95 transition-transform hover:brightness-110"
      >
        我的信息
      </button>
      
      {/* 技能按钮 */}
      <button 
        onClick={onShowSkill}
        className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#9c27b0] text-white text-sm font-bold active:scale-95 transition-transform hover:brightness-110"
      >
        <Zap className="w-4 h-4" />
        技能
      </button>
      
      {/* 道具按钮 */}
      <button 
        onClick={onShowItems}
        className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#2a2a2a] border border-[#4CAF50] text-[#4CAF50] text-sm font-bold active:scale-95 transition-transform hover:bg-[#4CAF50] hover:text-[#0a0a0a]"
      >
        <Package className="w-4 h-4" />
        道具
      </button>

      {/* 地点功能按钮 - 引用现有的 RoomFeatureButton */}
      <RoomFeatureButton 
        currentPlayer={currentPlayer} 
        showAlert={showAlert}
      />
      
      {/* 行动阶段特有的按钮 */}
      {phase === 'action' && (
        <>
          {/* 停留按钮 */}
          <button 
            onClick={onStay}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#5bc0de] text-[#0a0a0a] text-sm font-bold active:scale-95 transition-transform hover:brightness-110"
          >
            停留
          </button>
          
          {/* 投凶按钮 */}
          <button 
            onClick={onShowVote}
            className="flex-1 min-w-[80px] flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#c9302c] text-white text-sm font-bold active:scale-95 transition-transform hover:brightness-110"
          >
            投凶
          </button>
        </>
      )}
    </div>
  );
};