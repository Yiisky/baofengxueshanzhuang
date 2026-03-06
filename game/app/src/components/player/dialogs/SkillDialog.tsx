// src/components/player/dialogs/SkillDialog.tsx
import React, { useState, useMemo } from 'react';
// 修复：确保 AlertCircle 和 Check 被正确导入
import { X, Zap, AlertCircle, Check, Flame, Eye, Wrench, UserSearch, Sword, Heart, Stethoscope } from 'lucide-react';
import type { Player, RoleType, ActionStepDetail } from '@/types/game';
import { skillConfigs, canUseSkill, executeSkill, getFireableLocations, fanSkillOptions } from '@/utils/skillLogic';
import { roomFragments } from '@/data/roomFragments';
import { useWebSocketStore } from '@/store/websocketStore';
import { isGarden } from '@/utils/movementRules';

// 技能详细配置（用于显示介绍）
const skillDetails: Record<string, { name: string; description: string; icon: React.ReactNode; restrictions?: string }> = {
  attack: {
    name: '攻击',
    description: '可任选一轮，攻击与其行动线重叠的其他玩家。本技能不消耗行动点，生命值为0时无法使用',
    icon: <Sword className="w-5 h-5" />
  },
  fire: {
    name: '放火',
    description: '在第二、四轮中每轮可消耗1个行动点选择1个地点放火(3个花园和2个大厅除外)，该地点会在下一轮开始着火，经过或停留在着火点的玩家会受到1点伤害。生命值为0时仍然可用',
    icon: <Flame className="w-5 h-5" />
  },
  fake_action_line: {
    name: '编造行动线',
    description: '生命值为0时无法使用，整局游戏只能使用一次。设置虚假的行动线用于公示，但攻击伤害仍按真实行动线结算。',
    icon: <Eye className="w-5 h-5" />
  },
  get_action_line: {
    name: '获取行动线',
    description: '消耗1点行动点，查看目标玩家的完整行动线。',
    icon: <Eye className="w-5 h-5" />
  },
  power: {
    name: '供电',
    description: '只能在行动阶段且行动点为0时使用。修复当前所在楼层电路，使下一轮亮灯。第1轮只能在地下室或阁楼生效。',
    icon: <Wrench className="w-5 h-5" />
  },
  hack_score: {
    name: '入侵电脑',
    description: '每轮可查看任意1名玩家上一轮结算后的总分，若查看他人则后续不能再使用该技能，消耗1行动点。',
    icon: <UserSearch className="w-5 h-5" />
  },
  heal: {
    name: '治疗',
    description: '若两名医生在同一轮的行动线有重叠，无论重叠几次，则当轮结算阶段两人各恢复1点生命值。此为被动技能，无需主动使用。',
    icon: <Heart className="w-5 h-5" />,
    restrictions: '被动技能 - 无需主动使用'
  }
};

interface SkillDialogProps {
  isOpen: boolean;
  player: Player;
  players: Player[];
  round: number;
  phase: string;
  onClose: () => void;
}

// 获取玩家编号
function getPlayerNumber(playerId: string, players: Player[]): number {
  const index = players.findIndex(p => p.id === playerId);
  return index + 1;
}

export const SkillDialog: React.FC<SkillDialogProps> = ({
  isOpen,
  player,
  players,
  round,
  phase,
  onClose,
}) => {
  const { sendMessage } = useWebSocketStore();
  
  // 状态管理
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  
  // 虚假行动线状态
  const [showFakeActionLineTable, setShowFakeActionLineTable] = useState(false);
  const [fakeActionLine, setFakeActionLine] = useState<string[]>(Array(8).fill(''));
  
  // 侦探查看行动线状态
  const [showDetectiveView, setShowDetectiveView] = useState(false);
  const [detectiveTargetPlayer, setDetectiveTargetPlayer] = useState<Player | null>(null);
  const [detectiveViewStep, setDetectiveViewStep] = useState<'select' | 'view'>('select');
  const [targetPlayerActionLine, setTargetPlayerActionLine] = useState<ActionStepDetail[]>([]);
  
  // 黑客查看分数状态
  const [showHackerView, setShowHackerView] = useState(false);
  const [hackerTargetId, setHackerTargetId] = useState<string>('');
  const [hackerViewStep, setHackerViewStep] = useState<'select' | 'result'>('select');
  const [hackerViewResult, setHackerViewResult] = useState<{ playerId: string; score: number; round: number } | null>(null);

  // 推理迷相关状态
  const [showFanTransform, setShowFanTransform] = useState(false);
  const [showFanSkillChoice, setShowFanSkillChoice] = useState(false);
  const [guessedRole, setGuessedRole] = useState<'detective' | 'killer'>('detective');

  // 获取技能信息
  const skillInfo = useMemo(() => {
    if (player.role === 'fan') {
      return {
        name: '转变身份',
        description: '第3轮开始，行动点为0时可选择一名玩家，猜测其是侦探或凶手。猜对则加入对应阵营。',
        hasMultipleSkills: false
      };
    }
    
    if (player.role === 'killer' || player.role === 'murderer') {
      return {
        name: '编造行动线',
        description: '设置虚假的行动线用于公示，但攻击伤害仍按真实行动线结算。生命值为0时无法使用，整局只能使用一次。',
        hasMultipleSkills: false
      };
    }
    
    if (player.role === 'doctor') {
      return {
        name: '治疗',
        description: '若两名医生在同一轮的行动线有重叠，无论重叠几次，则当轮结算阶段两人各恢复1点生命值。此为被动技能，无需主动使用。',
        hasMultipleSkills: false
      };
    }
    
    return skillConfigs[player.role] ? {
      name: skillConfigs[player.role]!.name,
      description: skillConfigs[player.role]!.description,
      hasMultipleSkills: player.role === 'accomplice' || player.role === 'bad_fan' || player.role === 'good_fan'
    } : null;
  }, [player.role]);

  // 检查是否可以使用技能
  const checkResult = useMemo(() => {
    // 医生 - 被动技能，始终显示信息
    if (player.role === 'doctor') {
      return { canUse: true, isPassive: true };
    }
    
    // 推理迷转变身份检查
    if (player.role === 'fan') {
      if (round < 3) return { canUse: false, reason: '第3轮开始才能使用' };
      if (player.actionPoints !== 0) return { canUse: false, reason: '需要行动点为0' };
      if (player.transformedRole) return { canUse: false, reason: '已经转变身份' };
      return { canUse: true };
    }
    
    // 凶手/坏推理迷编造行动线检查
    if ((player.role === 'killer' || player.role === 'murderer' || player.role === 'bad_fan') && selectedSkill === 'fake_action_line') {
      if (player.health <= 0) return { canUse: false, reason: '生命值为0无法使用' };
      if ((player.fakeActionLineCount || 0) <= 0) return { canUse: false, reason: '编造次数已用完' };
      if (phase !== 'action') return { canUse: false, reason: '只能在行动阶段使用' };
      return { canUse: true };
    }
    
    // 工程师技能检查
    if (player.role === 'engineer') {
      if (phase !== 'action') {
        return { canUse: false, reason: '只能在行动阶段使用' };
      }
      if (player.actionPoints !== 0) {
        return { canUse: false, reason: '需要行动点为0才能使用' };
      }
      if (player.skillUsedThisRound) {
        return { canUse: false, reason: '本轮已使用过技能' };
      }
      if (round === 1) {
        const allowedFirstRoundRooms = ['basement_north', 'basement_south', 'basement_storage', 'attic_main', 'attic_therapy', 'attic_balcony'];
        if (!allowedFirstRoundRooms.includes(player.currentLocation)) {
          return { canUse: false, reason: '第1轮只能在地下室或阁楼使用供电技能' };
        }
      }
      return { canUse: true };
    }
    
    // 侦探技能检查
    if (player.role === 'detective') {
      if (round < 3) return { canUse: false, reason: '第3轮开始才能使用', isRoundRestricted: true };
      if (!selectedSkill) return { canUse: false, reason: '请选择技能' };
      if (player.actionPoints < 1) return { canUse: false, reason: '行动点不足（需要1点）' };
      if (player.skillUsedThisRound) return { canUse: false, reason: '本轮已使用过技能' };
      if (!selectedTarget) return { canUse: false, reason: '请选择目标玩家' };
      return { canUse: true };
    }
    
    // 黑客技能检查
    if (player.role === 'hacker') {
      if (!selectedSkill) return { canUse: false, reason: '请选择技能' };
      if (player.actionPoints < 1) return { canUse: false, reason: '行动点不足（需要1点）' };
      if (player.skillUsedThisRound) return { canUse: false, reason: '本轮已使用过技能' };
      if (player.hasCheckedOthersScore && selectedTarget !== player.id) {
        return { canUse: false, reason: '已经查看过他人分数' };
      }
      if (!selectedTarget) return { canUse: false, reason: '请选择目标玩家' };
      return { canUse: true };
    }
    
    if (!skillInfo || !skillConfigs[player.role]) {
      return { canUse: false, reason: '该身份没有主动技能' };
    }
    
    if (selectedSkill) {
      return canUseSkill(player, phase, round, selectedSkill);
    }
    
    return { canUse: false, reason: '请选择要使用的技能' };
  }, [player, phase, round, selectedSkill, selectedTarget, skillInfo]);

  // 获取当前选中的技能详情
  const currentSkillDetail = selectedSkill ? skillDetails[selectedSkill] : null;

  if (!isOpen) return null;

  // ===== 虚假行动线表格弹窗 =====
  if (showFakeActionLineTable) {
    const availableRooms = roomFragments.filter(r => !isGarden(r.id));
    
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[70] p-4">
        <div className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold text-[#d4a853] mb-6 text-center">编造行动线</h3>
          
          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[#444]">
              {/* 第一行：标题 */}
              <thead>
                <tr>
                  <th colSpan={4} className="border border-[#444] p-3 bg-[#d4a853]/20 text-[#d4a853] font-bold text-lg">
                    编造行动线
                  </th>
                </tr>
                {/* 第二行：行动1-4 */}
                <tr>
                  {['行动1', '行动2', '行动3', '行动4'].map((header, idx) => (
                    <th key={idx} className="border border-[#444] p-2 bg-[#2a2a2a] text-[#aaaaaa] text-sm w-1/4">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 第三行：行动1-4的下拉框 */}
                <tr>
                  {[0, 1, 2, 3].map((idx) => (
                    <td key={idx} className="border border-[#444] p-2">
                      <select
                        value={fakeActionLine[idx]}
                        onChange={(e) => {
                          const newLine = [...fakeActionLine];
                          newLine[idx] = e.target.value;
                          setFakeActionLine(newLine);
                        }}
                        className="w-full p-2 rounded bg-[#2a2a2a] border border-[#444] text-[#f5f5f5] text-sm"
                      >
                        <option value="">选择地点...</option>
                        {availableRooms.map(room => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
                {/* 第四行：行动5-8 */}
                <tr>
                  {['行动5', '行动6', '行动7', '行动8'].map((header, idx) => (
                    <th key={idx} className="border border-[#444] p-2 bg-[#2a2a2a] text-[#aaaaaa] text-sm">
                      {header}
                    </th>
                  ))}
                </tr>
                {/* 第五行：行动5-8的下拉框 */}
                <tr>
                  {[4, 5, 6, 7].map((idx) => (
                    <td key={idx} className="border border-[#444] p-2">
                      <select
                        value={fakeActionLine[idx]}
                        onChange={(e) => {
                          const newLine = [...fakeActionLine];
                          newLine[idx] = e.target.value;
                          setFakeActionLine(newLine);
                        }}
                        className="w-full p-2 rounded bg-[#2a2a2a] border border-[#444] text-[#f5f5f5] text-sm"
                      >
                        <option value="">选择地点...</option>
                        {availableRooms.map(room => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
                {/* 第六行：提示 */}
                <tr>
                  <td colSpan={4} className="border border-[#444] p-3 bg-[#2a2a2a] text-[#aaaaaa] text-sm text-left">
                    <span className="text-[#d4a853]">提示：</span>请注意所编造行动线的合理性
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowFakeActionLineTable(false);
                setFakeActionLine(Array(8).fill(''));
              }}
              className="flex-1 py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold hover:bg-[#333]"
            >
              取消
            </button>
            <button
              onClick={() => {
                // 验证所有位置都已选择
                if (fakeActionLine.some(loc => !loc)) {
                  alert('请完整选择8个地点');
                  return;
                }
                
                // 构建行动线
                const actionLine: ActionStepDetail[] = fakeActionLine.map((locId, idx) => ({
                  step: idx + 1,
                  locationId: locId,
                  action: 'move',
                  cost: 1
                }));
                
                // 发送消息
                sendMessage({
                  type: 'PLAYER_ACTION',
                  action: 'SET_FAKE_ACTION_LINE',
                  actionLine,
                  playerId: player.id
                });
                
                setShowFakeActionLineTable(false);
                onClose();
              }}
              disabled={fakeActionLine.some(loc => !loc)}
              className="flex-1 py-3 rounded-lg bg-[#d4a853] text-[#0a0a0a] font-bold disabled:opacity-50 hover:bg-[#e5b964]"
            >
              确认设置
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 侦探查看行动线弹窗 =====
  if (showDetectiveView) {
  // 选择玩家阶段
  if (detectiveViewStep === 'select') {
    const otherPlayers = players.filter(p => p.id !== player.id && p.isAlive);
    
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[70] p-4">
        <div className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-[#d4a853] mb-4">获取行动线</h3>
          <p className="text-[#aaaaaa] mb-4">需选择1名玩家查看他上一轮的时间线</p>
          
          <div className="mb-4">
            <label className="block text-[#aaaaaa] text-sm mb-2">选择玩家</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[#444] text-[#f5f5f5]"
            >
              <option value="">请选择...</option>
              {otherPlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {getPlayerNumber(p.id, players)}号玩家 - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowDetectiveView(false);
                setSelectedTarget('');
                onClose();
              }}
              className="flex-1 py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (!selectedTarget) {
                  alert('请选择目标玩家');
                  return;
                }
                
                // 修复：添加类型断言和空值检查
                const targetPlayer = players.find(p => p.id === selectedTarget);
                if (!targetPlayer) {
                  alert('目标玩家不存在');
                  return;
                }
                
                setDetectiveTargetPlayer(targetPlayer);
                
                // 获取目标玩家上一轮的行动线
                // 如果是凶手且使用了虚假行动线，则显示虚假行动线
                const isKiller = targetPlayer.role === 'killer' || targetPlayer.role === 'murderer';
                const actionLine = (isKiller && targetPlayer.fakeActionLine && targetPlayer.fakeActionLine.length > 0)
                  ? targetPlayer.fakeActionLine
                  : targetPlayer.actionLine || []; // 修复：添加默认值避免 undefined
                
                setTargetPlayerActionLine(actionLine);
                setDetectiveViewStep('view');
              }}
              disabled={!selectedTarget}
              className="flex-1 py-3 rounded-lg bg-[#d4a853] text-[#0a0a0a] font-bold disabled:opacity-50"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // 查看行动线表格阶段
  if (detectiveViewStep === 'view' && detectiveTargetPlayer) {
    const targetNumber = getPlayerNumber(detectiveTargetPlayer.id, players);
    const viewRound = round - 1; // 查看上一轮
    
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[70] p-4">
        <div className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold text-[#d4a853] mb-6 text-center">
            {targetNumber}号玩家在第{viewRound}轮的行动线
          </h3>
          
          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[#444]">
              <thead>
                <tr>
                  <th colSpan={4} className="border border-[#444] p-3 bg-[#d4a853]/20 text-[#d4a853] font-bold text-lg">
                    {targetNumber}号玩家在第{viewRound}轮的行动线
                  </th>
                </tr>
                <tr>
                  {['行动1', '行动2', '行动3', '行动4'].map((header, idx) => (
                    <th key={idx} className="border border-[#444] p-2 bg-[#2a2a2a] text-[#aaaaaa] text-sm w-1/4">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[0, 1, 2, 3].map((idx) => {
                    // 修复：安全访问行动线数据
                    const step = targetPlayerActionLine[idx];
                    const locationId = step?.locationId || '';
                    const room = roomFragments.find(r => r.id === locationId);
                    const roomName = room?.name || '未选择';
                    
                    return (
                      <td key={idx} className="border border-[#444] p-2 text-center">
                        {roomName}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  {['行动5', '行动6', '行动7', '行动8'].map((header, idx) => (
                    <th key={idx} className="border border-[#444] p-2 bg-[#2a2a2a] text-[#aaaaaa] text-sm">
                      {header}
                    </th>
                  ))}
                </tr>
                <tr>
                  {[4, 5, 6, 7].map((idx) => {
                    // 修复：安全访问行动线数据
                    const step = targetPlayerActionLine[idx];
                    const locationId = step?.locationId || '';
                    const room = roomFragments.find(r => r.id === locationId);
                    const roomName = room?.name || '未选择';
                    
                    return (
                      <td key={idx} className="border border-[#444] p-2 text-center">
                        {roomName}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* 关闭按钮 */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setShowDetectiveView(false);
                setDetectiveViewStep('select');
                setDetectiveTargetPlayer(null);
                setTargetPlayerActionLine([]);
                setSelectedTarget('');
              }}
              className="px-6 py-3 rounded-lg bg-[#d4a853] text-[#0a0a0a] font-bold hover:bg-[#e5b964]"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }
}

  // ===== 黑客查看分数弹窗 =====
  if (showHackerView) {
    // 选择玩家阶段
    if (hackerViewStep === 'select') {
      const canSelectOthers = !player.hasCheckedOthersScore;
      
      return (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[70] p-4">
          <div className="bg-[#1a1a1a] border-2 border-[#9c27b0] rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#9c27b0] mb-4">入侵电脑</h3>
            <p className="text-[#aaaaaa] mb-4">需选择1名玩家包括自己查看他上一轮结算后的总分</p>
            
            {!canSelectOthers && (
              <div className="mb-4 p-3 bg-[#c9302c]/20 border border-[#c9302c] rounded text-[#c9302c] text-sm">
                你已经查看过其他玩家的分数，现在只能查看自己的分数
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-[#aaaaaa] text-sm mb-2">选择玩家</label>
              <select
                value={hackerTargetId}
                onChange={(e) => setHackerTargetId(e.target.value)}
                className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[#444] text-[#f5f5f5]"
              >
                <option value="">请选择...</option>
                {/* 自己始终可选 */}
                <option value={player.id}>
                  {getPlayerNumber(player.id, players)}号玩家 - {player.name} (自己)
                </option>
                {/* 其他人只有在没查看过时才可选 */}
                {canSelectOthers && players
                  .filter(p => p.id !== player.id && p.isAlive)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {getPlayerNumber(p.id, players)}号玩家 - {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowHackerView(false);
                  setHackerTargetId('');
                  onClose();
                }}
                className="flex-1 py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!hackerTargetId) {
                    alert('请选择目标玩家');
                    return;
                  }
                  
                  const targetPlayer = players.find(p => p.id === hackerTargetId);
                  if (!targetPlayer) return;
                  
                  // 记录查看结果
                  setHackerViewResult({
                    playerId: hackerTargetId,
                    score: targetPlayer.score,
                    round: round - 1
                  });
                  
                  // 发送消息到服务器
                  sendMessage({
                    type: 'PLAYER_ACTION',
                    action: 'USE_SKILL',
                    skillType: 'hack_score',
                    targetId: hackerTargetId,
                    playerId: player.id
                  });
                  
                  setHackerViewStep('result');
                }}
                disabled={!hackerTargetId}
                className="flex-1 py-3 rounded-lg bg-[#9c27b0] text-white font-bold disabled:opacity-50"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // 查看结果阶段
    if (hackerViewStep === 'result' && hackerViewResult) {
      const targetPlayer = players.find(p => p.id === hackerViewResult.playerId);
      const targetNumber = targetPlayer ? getPlayerNumber(targetPlayer.id, players) : 0;
      const isSelf = hackerViewResult.playerId === player.id;
      
      return (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[70] p-4">
          <div className="bg-[#1a1a1a] border-2 border-[#9c27b0] rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#9c27b0] mb-6 text-center">查看结果</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-[#2a2a2a] rounded-lg">
                <p className="text-[#aaaaaa] text-sm mb-2">玩家</p>
                <p className="text-[#f5f5f5] font-bold text-lg">
                  {isSelf ? '你自己' : `${targetNumber}号玩家 - ${targetPlayer?.name}`}
                </p>
              </div>
              
              <div className="p-4 bg-[#2a2a2a] rounded-lg">
                <p className="text-[#aaaaaa] text-sm mb-2">第{hackerViewResult.round}轮结算后总分</p>
                <p className="text-[#9c27b0] font-bold text-3xl">{hackerViewResult.score} 分</p>
              </div>
              
              {!isSelf && (
                <div className="p-3 bg-[#d4a853]/10 border border-[#d4a853] rounded text-[#d4a853] text-sm">
                  你已查看过其他玩家的分数，后续将不能再使用该技能
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowHackerView(false);
                  setHackerViewStep('select');
                  setHackerTargetId('');
                  setHackerViewResult(null);
                  onClose();
                }}
                className="flex-1 py-3 rounded-lg bg-[#9c27b0] text-white font-bold hover:bg-[#7b1fa2]"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // ===== 推理迷转变身份弹窗 =====
  if (showFanTransform) {
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4">
        <div className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-[#d4a853] mb-4">转变身份</h3>
          <p className="text-[#aaaaaa] mb-4">选择一名玩家并猜测其身份</p>
          
          <div className="mb-4">
            <label className="block text-[#aaaaaa] text-sm mb-2">选择玩家</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[#444] text-[#f5f5f5]"
            >
              <option value="">请选择...</option>
              {players.filter(p => p.id !== player.id && p.isAlive).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-6">
            <label className="block text-[#aaaaaa] text-sm mb-2">猜测身份</label>
            <div className="flex gap-4">
              <button
                onClick={() => setGuessedRole('detective')}
                className={`flex-1 py-3 rounded-lg border ${
                  guessedRole === 'detective'
                    ? 'bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]'
                    : 'bg-[#2a2a2a] border-[#444] text-[#aaaaaa]'
                }`}
              >
                侦探阵营
              </button>
              <button
                onClick={() => setGuessedRole('killer')}
                className={`flex-1 py-3 rounded-lg border ${
                  guessedRole === 'killer'
                    ? 'bg-[#c9302c]/20 border-[#c9302c] text-[#c9302c]'
                    : 'bg-[#2a2a2a] border-[#444] text-[#aaaaaa]'
                }`}
              >
                凶手阵营
              </button>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowFanTransform(false)}
              className="flex-1 py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (!selectedTarget) {
                  alert('请选择目标玩家');
                  return;
                }
                sendMessage({
                  type: 'PLAYER_ACTION',
                  action: 'FAN_TRANSFORM',
                  targetId: selectedTarget,
                  guessedRole: guessedRole,
                  playerId: player.id
                });
                setShowFanTransform(false);
                onClose();
              }}
              disabled={!selectedTarget}
              className="flex-1 py-3 rounded-lg bg-[#d4a853] text-[#0a0a0a] font-bold disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 推理迷选择技能弹窗 =====
  if (showFanSkillChoice) {
    const options = player.role === 'good_fan' ? fanSkillOptions.detective : fanSkillOptions.killer;
    
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4">
        <div className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-[#d4a853] mb-4">选择技能</h3>
          <p className="text-[#aaaaaa] mb-4">请选择你要掌握的技能</p>
          
          <div className="space-y-3 mb-6">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  sendMessage({
                    type: 'PLAYER_ACTION',
                    action: 'FAN_CHOOSE_SKILL',
                    skillChoice: option.id,
                    playerId: player.id
                  });
                  setShowFanSkillChoice(false);
                  onClose();
                }}
                className="w-full p-4 rounded-lg bg-[#2a2a2a] border border-[#444] text-left hover:border-[#d4a853] transition-colors"
              >
                <div className="text-[#f5f5f5] font-bold mb-1">{option.name}</div>
                <div className="text-[#aaaaaa] text-sm">{option.description}</div>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setShowFanSkillChoice(false)}
            className="w-full py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // ===== 主技能弹窗 =====
  
  // 处理技能点击
  const handleUseSkill = () => {
    // 医生 - 被动技能，只显示信息
    if (player.role === 'doctor') {
      // 医生不需要任何操作，只是查看信息
      return;
    }
    
    // 推理迷
    if (player.role === 'fan') {
      setShowFanTransform(true);
      return;
    }

    // 凶手/坏推理迷编造行动线
    if ((player.role === 'killer' || player.role === 'murderer' || 
        (player.role === 'bad_fan' && selectedSkill === 'fake_action_line'))) {
      setShowFakeActionLineTable(true);
      return;
    }

    // 侦探查看行动线
    if (player.role === 'detective') {
      if (round < 3) {
        alert('第3轮开始才能使用');
        return;
      }
      setShowDetectiveView(true);
      return;
    }

    // 黑客查看分数
    if (player.role === 'hacker') {
      setShowHackerView(true);
      return;
    }

    // 工程师
    if (player.role === 'engineer') {
      if (!selectedSkill) {
        alert('请点击"供电"按钮选择技能');
        return;
      }
      setShowConfirm(true);
      return;
    }

    // 帮凶攻击技能
    if (player.role === 'accomplice' && selectedSkill === 'attack') {
      setShowConfirm(true);
      return;
    }

    // 帮凶放火
    if (player.role === 'accomplice' && selectedSkill === 'fire') {
      if (!selectedLocation) {
        alert('请选择放火地点');
        return;
      }
      setShowConfirm(true);
      return;
    }

    // 好推理迷获取行动线
    if (player.role === 'good_fan' && selectedSkill === 'get_action_line') {
      if (!selectedTarget) {
        alert('请选择目标玩家');
        return;
      }
      setShowConfirm(true);
      return;
    }
  };

  const confirmUseSkill = () => {
    // 工程师技能
    if (player.role === 'engineer') {
      sendMessage({
        type: 'PLAYER_ACTION',
        action: 'USE_SKILL',
        skillType: 'power',
        playerId: player.id
      });
      setShowConfirm(false);
      onClose();
      return;
    }

    // 其他技能
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'USE_SKILL',
      skillType: selectedSkill || player.role,
      targetId: selectedTarget || undefined,
      locationId: selectedLocation || undefined,
      playerId: player.id,
    });

    setShowConfirm(false);
    onClose();
  };

  const otherPlayers = players.filter(p => p.id !== player.id && p.isAlive);
  const fireableLocs = getFireableLocations();

  // 渲染技能选择按钮
  const renderSkillButtons = () => {
    // 工程师
    if (player.role === 'engineer') {
      return (
        <div className="mb-4">
          <button
            onClick={() => setSelectedSkill('power')}
            className={`w-full p-4 rounded-lg border transition-all ${
              selectedSkill === 'power'
                ? 'bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]'
                : 'bg-[#2a2a2a] border-[#444] text-[#f5f5f5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <span className="font-bold">供电</span>
            </div>
            <p className="mt-2 text-sm text-[#aaaaaa]">
              修复当前所在楼层电路，使下一轮亮灯
            </p>
          </button>
        </div>
      );
    }

    // 帮凶
    if (player.role === 'accomplice') {
      return (
        <div className="grid grid-cols-1 gap-3 mb-4">
          <button
            onClick={() => setSelectedSkill('attack')}
            className={`p-4 rounded-lg border transition-all ${
              selectedSkill === 'attack'
                ? 'bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]'
                : 'bg-[#2a2a2a] border-[#444] text-[#f5f5f5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sword className="w-5 h-5" />
              <span className="font-bold">攻击</span>
            </div>
            <p className="mt-2 text-sm text-[#aaaaaa]">
              攻击与其行动线重叠的其他玩家
            </p>
          </button>
          <button
            onClick={() => setSelectedSkill('fire')}
            className={`p-4 rounded-lg border transition-all ${
              selectedSkill === 'fire'
                ? 'bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]'
                : 'bg-[#2a2a2a] border-[#444] text-[#f5f5f5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5" />
              <span className="font-bold">放火</span>
            </div>
            <p className="mt-2 text-sm text-[#aaaaaa]">
              选择1个地点放火，该地点下一轮开始着火
            </p>
          </button>
        </div>
      );
    }

    // 好推理迷
    if (player.role === 'good_fan') {
      return (
        <div className="mb-4">
          <button
            onClick={() => setSelectedSkill('get_action_line')}
            className={`w-full p-4 rounded-lg border transition-all ${
              selectedSkill === 'get_action_line'
                ? 'bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]'
                : 'bg-[#2a2a2a] border-[#444] text-[#f5f5f5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              <span className="font-bold">获取行动线</span>
            </div>
            <p className="mt-2 text-sm text-[#aaaaaa]">
              查看目标玩家的完整行动线
            </p>
          </button>
        </div>
      );
    }

    // 坏推理迷
    if (player.role === 'bad_fan') {
      return (
        <div className="mb-4">
          <button
            onClick={() => setSelectedSkill('fake_action_line')}
            className={`w-full p-4 rounded-lg border transition-all ${
              selectedSkill === 'fake_action_line'
                ? 'bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]'
                : 'bg-[#2a2a2a] border-[#444] text-[#f5f5f5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              <span className="font-bold">编造行动线</span>
            </div>
            <p className="mt-2 text-sm text-[#aaaaaa]">
              设置虚假的行动线用于公示
            </p>
          </button>
        </div>
      );
    }

    // 侦探/黑客/凶手 - 单一技能
    return (
      <div className="mb-4">
        <button
          onClick={() => setSelectedSkill(player.role === 'detective' ? 'get_action_line' : player.role === 'hacker' ? 'hack_score' : 'fake_action_line')}
          className={`w-full p-4 rounded-lg border transition-all ${
            selectedSkill
              ? 'bg-[#4CAF50]/20 border-[#4CAF50] text-[#4CAF50]'
              : 'bg-[#2a2a2a] border-[#444] text-[#f5f5f5]'
          }`}
        >
          <div className="flex items-center gap-2">
            {player.role === 'detective' && <Eye className="w-5 h-5" />}
            {player.role === 'hacker' && <UserSearch className="w-5 h-5" />}
            {player.role === 'killer' && <Eye className="w-5 h-5" />}
            <span className="font-bold">{skillInfo?.name}</span>
          </div>
          <p className="mt-2 text-sm text-[#aaaaaa]">
            {skillInfo?.description}
          </p>
        </button>
      </div>
    );
  };

  // 渲染目标选择/地点选择
  const renderTargetSelection = () => {
    // 不需要选择目标的角色
    if (['doctor', 'engineer', 'fan', 'killer', 'murderer'].includes(player.role)) return null;
    
    // 放火需要选择地点
    if (selectedSkill === 'fire') {
      return (
        <div className="mb-4">
          <label className="block text-[#aaaaaa] text-sm mb-2">选择放火地点</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[#444] text-[#f5f5f5]"
          >
            <option value="">请选择...</option>
            {fireableLocs.map(locId => {
  const room = roomFragments.find(r => r.id === locId);
  return (
    <option key={locId} value={locId}>{room?.name || locId}</option>
  );
})}
          </select>
        </div>
      );
    }
    
    // 其他需要选择目标玩家
    return (
      <div className="mb-4">
        <label className="block text-[#aaaaaa] text-sm mb-2">选择目标玩家</label>
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#2a2a2a] border border-[#444] text-[#f5f5f5]"
        >
          <option value="">请选择...</option>
          {otherPlayers.map(p => (
            <option key={p.id} value={p.id}>
              {getPlayerNumber(p.id, players)}号玩家 - {p.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // 确认弹窗
  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[80] p-4">
        <div className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-[#d4a853] mb-4">确认使用技能</h3>
          <p className="text-[#f5f5f5] mb-6">
            你确定要使用{currentSkillDetail?.name}技能吗？
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold"
            >
              取消
            </button>
            <button
              onClick={confirmUseSkill}
              className="flex-1 py-3 rounded-lg bg-[#d4a853] text-[#0a0a0a] font-bold hover:bg-[#e5b964]"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[#d4a853]">{skillInfo?.name}</h3>
          <button
            onClick={onClose}
            className="text-[#aaaaaa] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-[#f5f5f5]">{skillInfo?.description}</p>
          
          {!checkResult.canUse && (
            <div className="mt-3 p-3 bg-[#c9302c]/20 border border-[#c9302c] rounded text-[#c9302c] text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {checkResult.reason}
            </div>
          )}
          
          {checkResult.isPassive && (
            <div className="mt-3 p-3 bg-[#4CAF50]/20 border border-[#4CAF50] rounded text-[#4CAF50] text-sm">
              <Check className="w-4 h-4 inline mr-2" />
              {skillDetails.heal?.restrictions}
            </div>
          )}
        </div>
        
        {!checkResult.isPassive && renderSkillButtons()}
        
        {!checkResult.isPassive && renderTargetSelection()}
        
        <button
          onClick={handleUseSkill}
          disabled={!checkResult.canUse}
          className="w-full py-3 rounded-lg bg-[#d4a853] text-[#0a0a0a] font-bold disabled:opacity-50 hover:bg-[#e5b964] transition-colors"
        >
          {player.role === 'doctor' ? '了解' : '使用技能'}
        </button>
      </div>
    </div>
  );
};