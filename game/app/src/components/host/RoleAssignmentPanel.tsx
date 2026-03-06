// src/components/host/RoleAssignmentPanel.tsx
/**
 * 身份分配面板 - 等待开始阶段使用
 * 主持人点击玩家卡片来分配身份
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Check, 
  RotateCcw,
  AlertCircle,
  Users
} from 'lucide-react';
import type { Player, RoleType,Role } from '@/types/game';
import { getRoleIcon, getRoleName, getCampColor } from '@/data/roles';
import { cn } from '@/lib/utils';

// 可用的身份列表（不包含 unknown）
const AVAILABLE_ROLES: Role[] = [
  'killer',      // 凶手
  'accomplice',  // 帮手
  'detective',   // 侦探
  'engineer',    // 工程师
  'hacker',      // 黑客
  'doctor',      // 医生
  'fan'          // 推理迷
];

// 阵营类型
type CampType = 'killer' | 'detective' | 'neutral';

// 身份配置信息
interface RoleConfig {
  label: string;
  camp: CampType;
  color: string;
  bgColor: string;
  description: string;
  maxCount?: number;
}

const ROLE_CONFIG: Record<RoleType, RoleConfig> = {
  killer: {
    label: '凶手',
    camp: 'killer',
    color: '#c9302c',
    bgColor: '#c9302c20',
    description: '凶手阵营核心，可以伪造行动线',
    maxCount: 1
  },
  accomplice: {
    label: '帮手',
    camp: 'killer',
    color: '#c9302c',
    bgColor: '#c9302c20',
    description: '凶手阵营，协助凶手',
    maxCount: 2
  },
  detective: {
    label: '侦探',
    camp: 'detective',
    color: '#2ca02c',
    bgColor: '#2ca02c20',
    description: '侦探阵营核心，可以调查线索',
    maxCount: 1
  },
  engineer: {
    label: '工程师',
    camp: 'detective',
    color: '#2ca02c',
    bgColor: '#2ca02c20',
    description: '侦探阵营，可以修复电力',
    maxCount: 2
  },
  hacker: {
    label: '黑客',
    camp: 'detective',
    color: '#2ca02c',
    bgColor: '#2ca02c20',
    description: '侦探阵营，可以黑入系统',
    maxCount: 2
  },
  doctor: {
    label: '医生',
    camp: 'detective',
    color: '#2ca02c',
    bgColor: '#2ca02c20',
    description: '侦探阵营，可以治疗队友',
    maxCount: 2
  },
  fan: {
    label: '推理迷',
    camp: 'neutral',
    color: '#d4a853',
    bgColor: '#d4a85320',
    description: '中立阵营，后期可选择阵营',
    maxCount: 3
  },
  // 补充缺失的 RoleType 类型定义
  murderer: {
    label: '凶手(备用)',
    camp: 'killer',
    color: '#c9302c',
    bgColor: '#c9302c20',
    description: '凶手阵营核心（备用标识）',
    maxCount: 1
  },
  bad_fan: {
    label: '坏推理迷',
    camp: 'killer',
    color: '#d4a853',
    bgColor: '#d4a85320',
    description: '中立偏向凶手阵营',
    maxCount: 1
  },
  good_fan: {
    label: '好推理迷',
    camp: 'detective',
    color: '#d4a853',
    bgColor: '#d4a85320',
    description: '中立偏向侦探阵营',
    maxCount: 1
  },
  unknown: {
    label: '未知',
    camp: 'neutral',
    color: '#666666',
    bgColor: '#66666620',
    description: '未分配身份',
    maxCount: undefined
  },
  innocent: {
    label: '无辜者',
    camp: 'detective',
    color: '#2ca02c',
    bgColor: '#2ca02c20',
    description: '侦探阵营普通成员',
    maxCount: 2
  }
};

interface RoleAssignmentPanelProps {
  players: Player[];
  onAssignRole: (playerId: string, role: Role) => void;
  onBatchAssign?: (assignments: Record<string, Role>) => void;
  onClearAll?: () => void;
  isHost: boolean;
}

export const RoleAssignmentPanel: React.FC<RoleAssignmentPanelProps> = ({
  players,
  onAssignRole,
  onBatchAssign,
  onClearAll,
  isHost
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [hoveredRole, setHoveredRole] = useState<Role | null>(null);

  // 统计各身份当前数量
  const roleCounts = players.reduce((acc, player) => {
    // 只统计有效的身份（不是 unknown 或空）
    if (player.role && AVAILABLE_ROLES.includes(player.role as Role)) {
      acc[player.role as Role] = (acc[player.role as Role] || 0) + 1;
    }
    return acc;
  }, {} as Record<Role, number>);

  // 已分配身份的玩家数
  const assignedCount = players.filter(p => 
    p.role && AVAILABLE_ROLES.includes(p.role as Role)
  ).length;
  const unassignedCount = players.length - assignedCount;

  // 获取某个身份的剩余推荐名额
  const getRemainingSlots = (role: Role): number | null => {
    const config = ROLE_CONFIG[role];
    if (!config.maxCount) return null;
    const current = roleCounts[role] || 0;
    return Math.max(0, config.maxCount - current);
  };

  // 处理玩家点击
  const handlePlayerClick = (playerId: string) => {
    if (!isHost) return;
    setSelectedPlayer(selectedPlayer === playerId ? null : playerId);
  };

  // 处理身份分配
  const handleRoleClick = (role: Role) => {
    if (!isHost || !selectedPlayer) return;
    onAssignRole(selectedPlayer, role);
    setSelectedPlayer(null);
  };

  // 快速分配：随机分配剩余身份（平衡版）
  const handleQuickAssign = () => {
    if (!isHost || !onBatchAssign) return;
    
    // 找出未分配身份的玩家
    const unassignedPlayers = players.filter(p => 
      !p.role || !AVAILABLE_ROLES.includes(p.role as Role)
    );
    if (unassignedPlayers.length === 0) return;

    const assignments: Record<string, Role> = {};
    
    // 推荐的配置（10人局标准配置）
    const recommendedConfig: Role[] = [
      'killer', 'accomplice',
      'detective', 'engineer', 'hacker', 'doctor',
      'fan', 'fan', 'fan',
      'accomplice'
    ];

    unassignedPlayers.forEach((player, index) => {
      const role = recommendedConfig[index] || 'fan';
      assignments[player.id] = role;
    });

    onBatchAssign(assignments);
  };

  // 清空所有身份
  const handleClearAll = () => {
    if (!isHost || !onClearAll) return;
    if (confirm('确定要清空所有玩家的身份分配吗？')) {
      onClearAll();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部统计 */}
      <div className="p-4 border-b border-[#333] bg-[#1a1a1a]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[#d4a853]">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-bold">身份分配</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#2ca02c] text-[#2ca02c]">
              已分配: {assignedCount}
            </Badge>
            <Badge variant="outline" className="border-[#d4a853] text-[#d4a853]">
              待分配: {unassignedCount}
            </Badge>
          </div>
        </div>

        {/* 快捷操作按钮 */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleQuickAssign}
            disabled={!isHost || unassignedCount === 0}
            className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b] disabled:opacity-50"
          >
            <Check className="w-4 h-4 mr-1" />
            快速分配
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClearAll}
            disabled={!isHost || assignedCount === 0}
            className="border-[#666] text-[#aaaaaa] hover:bg-[#333] disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            清空全部
          </Button>
        </div>

        {/* 身份统计预览 */}
        <div className="flex flex-wrap gap-2 mt-3">
          {AVAILABLE_ROLES.map(role => {
            const count = roleCounts[role] || 0;
            const config = ROLE_CONFIG[role];
            const remaining = getRemainingSlots(role);
            
            return (
              <div 
                key={role}
                className={cn(
                  "px-2 py-1 rounded text-xs border flex items-center gap-1",
                  count > 0 
                    ? "bg-[#2a2a2a] border-[#444]" 
                    : "bg-[#1a1a1a] border-[#333] opacity-60"
                )}
                style={count > 0 ? { borderColor: config.color } : {}}
              >
                <span>{getRoleIcon(role)}</span>
                <span style={{ color: config.color }}>{config.label}</span>
                <span className="text-[#f5f5f5] font-bold">{count}</span>
                {remaining !== null && remaining > 0 && (
                  <span className="text-[#666]">/{config.maxCount}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 主内容区：左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：玩家列表 */}
        <div className="w-1/2 border-r border-[#333] overflow-y-auto p-4">
          <h3 className="text-sm font-bold text-[#aaaaaa] mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            点击玩家选择（{players.length}人）
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            {players.map((player, index) => {
              const isSelected = selectedPlayer === player.id;
              // 检查是否已分配有效身份
              const hasRole = player.role && AVAILABLE_ROLES.includes(player.role as Role);
              const roleConfig = hasRole ? ROLE_CONFIG[player.role as Role] : null;
              
              return (
                <Card
                  key={player.id}
                  onClick={() => handlePlayerClick(player.id)}
                  className={cn(
                    "cursor-pointer transition-all border-2",
                    isSelected 
                      ? "border-[#d4a853] bg-[#d4a853]/10" 
                      : hasRole
                        ? "border-[#444] bg-[#1a1a1a]"
                        : "border-dashed border-[#555] bg-[#0a0a0a]/50 hover:border-[#d4a853]/50",
                    !isHost && "cursor-not-allowed opacity-70"
                  )}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[#666] text-xs font-mono w-5">
                        {index + 1}
                      </span>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#f5f5f5] truncate">
                          {player.name}
                        </div>
                        
                        {hasRole ? (
                          <div 
                            className="text-xs flex items-center gap-1 mt-1"
                            style={{ color: roleConfig?.color }}
                          >
                            <span>{getRoleIcon(player.role as Role)}</span>
                            <span>{roleConfig?.label}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-[#666] mt-1">
                            点击分配身份...
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#d4a853] flex items-center justify-center">
                          <Check className="w-4 h-4 text-[#0a0a0a]" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {players.length < 10 && (
              <div className="col-span-2 p-4 border border-dashed border-[#444] rounded-lg text-center">
                <span className="text-[#666] text-sm">
                  等待 {10 - players.length} 名玩家加入...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：身份选择 */}
        <div className="w-1/2 overflow-y-auto p-4 bg-[#0a0a0a]">
          {selectedPlayer ? (
            <div className="space-y-4">
              <div className="p-3 bg-[#d4a853]/10 rounded-lg border border-[#d4a853]/30">
                <div className="text-xs text-[#d4a853] mb-1">当前选择</div>
                <div className="font-bold text-[#f5f5f5]">
                  {players.find(p => p.id === selectedPlayer)?.name}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-[#aaaaaa] mb-2">
                  选择身份
                </h3>
                
                <div className="grid grid-cols-1 gap-2">
                  {AVAILABLE_ROLES.map(role => {
                    const config = ROLE_CONFIG[role];
                    const count = roleCounts[role] || 0;
                    const isRecommended = config.maxCount 
                      ? count < config.maxCount 
                      : true;

                    return (
                      <button
                        key={role}
                        onClick={() => handleRoleClick(role)}
                        onMouseEnter={() => setHoveredRole(role)}
                        onMouseLeave={() => setHoveredRole(null)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                          "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                        style={{
                          backgroundColor: config.bgColor,
                          borderColor: hoveredRole === role ? config.color : config.color + '40',
                          opacity: isRecommended ? 1 : 0.7
                        }}
                      >
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                          style={{ backgroundColor: config.color + '30' }}
                        >
                          {getRoleIcon(role)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span 
                              className="font-bold"
                              style={{ color: config.color }}
                            >
                              {config.label}
                            </span>
                            {count > 0 && (
                              <Badge 
                                variant="outline" 
                                className="text-[10px]"
                                style={{ borderColor: config.color, color: config.color }}
                              >
                                已选{count}人
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-[#aaaaaa] mt-0.5">
                            {config.description}
                          </div>
                        </div>

                        <div 
                          className="text-xs px-2 py-1 rounded"
                          style={{ 
                            backgroundColor: getCampColor(config.camp) + '20',
                            color: getCampColor(config.camp)
                          }}
                        >
                          {config.camp === 'killer' ? '凶手' : 
                           config.camp === 'detective' ? '侦探' : '中立'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPlayer(null)}
                className="w-full border-[#666] text-[#aaaaaa]"
              >
                取消选择
              </Button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#666]">
              <User className="w-12 h-12 mb-3 opacity-30" />
              <p>点击左侧玩家卡片</p>
              <p className="text-sm mt-1">为其分配身份</p>
              
              {!isHost && (
                <div className="mt-4 p-3 bg-[#c9302c]/10 rounded border border-[#c9302c]/30 flex items-center gap-2 text-[#c9302c]">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">仅主持人可操作</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-[#333] bg-[#1a1a1a] text-xs text-[#666] flex items-center justify-between">
        <span>💡 提示：可以分配多个相同身份，建议配置：凶手×1、帮手×1-2、侦探×1、其他各1-2、推理迷×2-3</span>
        <span>{assignedCount}/{players.length} 已就绪</span>
      </div>
    </div>
  );
};

export default RoleAssignmentPanel;