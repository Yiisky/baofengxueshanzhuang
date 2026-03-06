// src/components/player/dialogs/MyInfoDialog.tsx
// 我的信息弹窗
import React from 'react';
import { X, Lightbulb, Package } from 'lucide-react';
import type { Player, ItemType, RoleType, CampType } from '@/types/game';

interface MyInfoDialogProps {
  isOpen: boolean;
  player: Player;
  onClose: () => void;
}

const itemNames: Record<ItemType, string> = {
  bandage: '急救绷带',
  powder: '迷药粉末',
  extinguisher: '灭火器',
  rope: '登山绳',
  ski: '滑雪套装'
};

function getRoleName(role?: RoleType): string {
  const roleMap: Record<RoleType, string> = {
    detective: '侦探',
    killer: '凶手',
    murderer: '凶手',
    innocent: '平民',
    accomplice: '帮凶',
    bad_fan: '坏推理迷',
    good_fan: '好推理迷',
    doctor: '医生',
    engineer: '工程师',
    hacker: '黑客',
    fan: '推理迷',
    unknown: '未知角色'
  };
  return role ? roleMap[role] : '未知身份';
}

function getCampName(camp?: CampType): string {
  const campMap: Record<CampType, string> = {
    good: '好人阵营',
    detective: '侦探阵营',
    evil: '坏人阵营',
    killer: '凶手阵营',
    neutral: '中立阵营'
  };
  return camp ? campMap[camp] : '未知阵营';
}

function getCampColor(camp?: CampType): string {
  const colorMap: Record<CampType, string> = {
    good: '#4CAF50',
    detective: '#4CAF50',
    evil: '#F44336',
    killer: '#F44336',
    neutral: '#FFC107'
  };
  return camp ? colorMap[camp] : '#f5f5f5';
}

function getRoleSkillDescription(role?: RoleType): string {
  const skillMap: Record<RoleType, string> = {
    detective: '从第三轮开始，每轮可选择1名玩家，消耗1点行动点，获取其上一轮的完整行动线。若目标玩家是凶手且使用了虚假行动线，则看到的是其编造的行动线。',
    killer: '凶手会自动攻击与其行动线重叠的其他玩家（包括同阵营玩家），每轮每人最多受到1点攻击伤害。凶手可在整局游戏中编造两次虚假的行动线。若凶手编造了虚假行动线，则行动线重叠的公示、荧光粉的公示、侦探获取的行动线都将采用这条虚假行动线，但攻击伤害依旧按照真实行动线结算。',
    murderer: '凶手会自动攻击与其行动线重叠的其他玩家（包括同阵营玩家），每轮每人最多受到1点攻击伤害。',
    innocent: '平民没有特殊技能。',
    accomplice: '帮凶可任选一轮，攻击与其行动线重叠的其他玩家（包括同阵营玩家），每轮每人最多受到1点攻击伤害。帮凶在第二、四轮中，每轮可选择1个地点放火，无需本人在该地点（3个花园和2个大厅无法放火），该地点会在下一轮开始着火，经过或停留在着火点的玩家会受到1点伤害（初始从着火点离开不会受伤，每轮每人最多受到1点着火伤害）。',
    bad_fan: '坏推理迷可在"1次攻击+编造1次行动线"及"投凶"两个技能中任选其一。1次攻击+编造1次行动线：可分两轮使用，也可在同一轮使用。投凶：每轮可在行动结束后投凶，且初始拥有1分。',
    good_fan: '好推理迷可在"获取行动线"及"投凶"两个技能中任选其一。获取行动线：每轮可获取一名玩家在上一轮的行动线。投凶：每轮可在行动结束后投凶，且初始拥有2分。',
    doctor: '若两名医生在同一轮的行动线有重叠，无论重叠几次，则当轮结算阶段两人各恢复1点生命值。此为被动技能，无需主动使用。',
    engineer: '只能在行动阶段且行动点为0时使用。修复当前所在楼层电路，使下一轮亮灯。第1轮只能在地下室或阁楼生效。',
    hacker: '每轮可查看任意1名玩家（包括自己）上一轮结算后的总分，消耗1点行动点。若选择查看其他玩家的分数，则后续轮次将不能再使用该技能。',
    fan: '从第三轮开始，行动点为0时可选择一名玩家，猜测其是侦探或凶手。猜对则加入对应阵营。',
    unknown: '无特殊技能'
  };
  return role ? skillMap[role] : '无特殊技能';
}

export const MyInfoDialog: React.FC<MyInfoDialogProps> = ({ isOpen, player, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#d4a853]">我的信息</h2>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#aaaaaa] active:bg-[#d4a853] active:text-[#0a0a0a] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
              <span className="text-[#aaaaaa]">身份</span>
              <span className="text-[#f5f5f5] font-bold text-lg">{getRoleName(player.role)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
              <span className="text-[#aaaaaa]">阵营</span>
              <span 
                className="font-bold px-4 py-1 rounded-full"
                style={{ 
                  color: getCampColor(player.camp),
                  backgroundColor: `${getCampColor(player.camp)}20`
                }}
              >
                {getCampName(player.camp)}
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
              <span className="text-[#aaaaaa]">生命值</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-3 bg-[#0a0a0a] rounded-full overflow-hidden border border-[#444]">
                  <div 
                    className="h-full bg-[#c9302c] transition-all"
                    style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
                  />
                </div>
                <span className="text-[#c9302c] font-bold w-12 text-right">{player.health}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
              <span className="text-[#aaaaaa]">行动点</span>
              <span className="text-[#d4a853] font-bold text-2xl">{player.actionPoints}</span>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#d4a853] mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" /> 技能说明
            </h3>
            <div className="p-4 rounded-lg bg-[#d4a853]/10 border border-[#d4a853]/30 text-[#f5f5f5] text-sm leading-relaxed">
              {getRoleSkillDescription(player.role)}
            </div>
            {player.role === 'doctor' && (
              <div className="mt-2 p-2 rounded bg-[#4CAF50]/20 text-[#4CAF50] text-xs text-center">
                被动技能 - 无需主动使用
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-[#d4a853] mb-3 flex items-center gap-2">
              <Package className="w-5 h-5" /> 我的道具
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {player.items && player.items.length > 0 ? (
                player.items.map((item, index) => (
                  <div 
                    key={index}
                    className="p-4 rounded-lg text-center text-[#f5f5f5] bg-[#d4a853]/10 border border-[#d4a853]/30"
                  >
                    {itemNames[item as ItemType] || item}
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-[#aaaaaa] text-center py-6 bg-[#2a2a2a] rounded-lg">
                  暂无道具
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyInfoDialog;