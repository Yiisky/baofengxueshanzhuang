// src/components/player/VoteDialog.tsx
import React from 'react';
import { X, User, CheckCircle, AlertCircle } from 'lucide-react';
import type { Player, RoleType } from '@/types/game';

interface VoteDialogProps {
  isOpen: boolean;
  players: Player[];
  currentPlayer: Player;
  round: number;
  onVote: (targetId: string) => void;
  onClose: () => void;
}

export const VoteDialog: React.FC<VoteDialogProps> = ({ 
  isOpen, 
  players, 
  currentPlayer, 
  round,
  onVote, 
  onClose 
}) => {
  if (!isOpen) return null;

  // 第一轮不能投票
  if (round < 2) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-[#1a1a1a] border-2 border-[#c9302c] rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
          <div className="text-center py-8">
            <AlertCircle className="w-20 h-20 text-[#c9302c] mx-auto mb-4 opacity-50" />
            <p className="text-[#aaaaaa] text-lg">第一轮不能投凶</p>
            <p className="text-[#666] text-sm mt-2">从第二轮开始可以投票</p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  // 检查玩家是否可以投票
  const canPlayerVote = () => {
    // 凶手阵营不能投票
    if (currentPlayer.role === 'killer' || currentPlayer.role === 'murderer' || currentPlayer.role === 'accomplice') {
      return false;
    }
    // 未转变的推理迷不能投票
    if (currentPlayer.role === 'fan') {
      return false;
    }
    // 坏推理迷不能投票（除非选择了投凶技能）
    if (currentPlayer.role === 'bad_fan' && !currentPlayer.canVote) {
      return false;
    }
    // 好推理迷可以投票（如果选择了投凶技能）
    if (currentPlayer.role === 'good_fan' && !currentPlayer.canVote) {
      return false;
    }
    return true;
  };

  const otherPlayers = players.filter(p => p.id !== currentPlayer.id && p.isAlive);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border-2 border-[#c9302c] rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-[#333]">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-[#c9302c]">投凶</h2>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#aaaaaa] active:bg-[#c9302c] active:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {!canPlayerVote() ? (
            <div className="text-center py-12">
              <AlertCircle className="w-20 h-20 text-[#c9302c] mx-auto mb-4 opacity-50" />
              <p className="text-[#aaaaaa] text-lg">你的身份无法参与投票</p>
              {currentPlayer.role === 'fan' && (
                <p className="text-[#666] text-sm mt-2">推理迷需要先转变身份并选择投凶技能才能投票</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[#aaaaaa] text-sm mb-4">请选择你怀疑的玩家</p>
              {otherPlayers.map((player, index) => (
                <button
                  key={player.id}
                  onClick={() => onVote(player.id)}
                  className="w-full flex items-center justify-between p-4 rounded-lg bg-[#2a2a2a] active:bg-[#c9302c]/30 border border-transparent active:border-[#c9302c]/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#d4a853]/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-[#d4a853]" />
                    </div>
                    <span className="text-[#f5f5f5] font-medium text-lg">{player.name}</span>
                  </div>
                  <CheckCircle className="w-6 h-6 text-[#444]" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoteDialog;