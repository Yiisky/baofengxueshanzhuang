// src/components/host/PlayerDetailsTable.tsx
/**
 * 玩家详细状态表格组件
 * 用于主持人面板显示所有玩家的详细状态，包括身份、血量、道具、投凶等
 */

import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RoleNameMap, ItemNameMap, CampColorMap, type Player, type RoleType } from '@/types/game';
import { getLocationById } from '@/data/locations';
import { Heart, Shield, User, Package, MapPin, Activity, Vote, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerDetailsTableProps {
  players: Player[];
  votes: Record<string, string>;
  powderTarget?: string | null;
}

// 获取角色颜色
function getRoleColor(role: RoleType): string {
  const colorMap: Record<RoleType, string> = {
    detective: 'bg-green-500',
    killer: 'bg-red-500',
    murderer: 'bg-red-500',
    innocent: 'bg-gray-500',
    accomplice: 'bg-orange-500',
    bad_fan: 'bg-red-600',
    good_fan: 'bg-green-600',
    doctor: 'bg-blue-500',
    engineer: 'bg-yellow-500',
    hacker: 'bg-purple-500',
    fan: 'bg-gray-400',
    unknown: 'bg-gray-300',
  };
  return colorMap[role] || 'bg-gray-400';
}

// 获取阵营颜色
function getCampColor(camp: string): string {
  const colorMap: Record<string, string> = {
    detective: 'text-green-600',
    killer: 'text-red-600',
    good: 'text-green-600',
    evil: 'text-red-600',
    neutral: 'text-yellow-600',
  };
  return colorMap[camp] || 'text-gray-500';
}

// 获取道具图标
function getItemIcon(item: string): string {
  const iconMap: Record<string, string> = {
    bandage: '🩹',
    powder: '🌸',
    extinguisher: '🧯',
    rope: '🪢',
    ski: '⛷️',
  };
  return iconMap[item] || '📦';
}

export function PlayerDetailsTable({ players, votes, powderTarget }: PlayerDetailsTableProps) {
  const [displayPlayers, setDisplayPlayers] = useState<Player[]>(players);

  // 关键修复：当props变化时更新本地状态，确保实时更新
  useEffect(() => {
    setDisplayPlayers(players);
  }, [players, votes]);

  // 按玩家编号排序
  const sortedPlayers = [...displayPlayers].sort((a, b) => (a.number || 0) - (b.number || 0));

  // 获取玩家当前位置名称
  const getLocationName = (locationId: string) => {
    if (!locationId) return '未选择';
    return getLocationById(locationId)?.name || locationId;
  };

  // 获取投票目标玩家名称
  const getVoteTargetName = (voterId: string) => {
    const targetId = votes?.[voterId];
    if (!targetId) return null;
    const target = players.find(p => p.id === targetId);
    return target?.name || '未知';
  };

  // 关键修复：检查玩家是否已投凶（使用votes对象）
  const hasVoted = (playerId: string) => {
    return votes && votes[playerId] !== undefined && votes[playerId] !== null;
  };

  // 获取投凶目标
  const getVoteTarget = (playerId: string) => {
    const targetId = votes?.[playerId];
    if (!targetId) return null;
    return players.find(p => p.id === targetId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <User className="w-5 h-5" />
          玩家详细状态
        </h3>
        <div className="text-sm text-muted-foreground">
          共 {players.length} 名玩家
        </div>
      </div>

      <ScrollArea className="h-[400px] border rounded-lg">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60px] text-center">编号</TableHead>
              <TableHead className="w-[100px]">身份</TableHead>
              <TableHead className="w-[80px] text-center">血量</TableHead>
              <TableHead className="w-[80px] text-center">行动点</TableHead>
              <TableHead className="w-[120px]">道具</TableHead>
              <TableHead className="w-[120px]">位置</TableHead>
              <TableHead className="w-[100px]">投凶状态</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPlayers.map((player) => {
              const voted = hasVoted(player.id);
              const voteTarget = getVoteTarget(player.id);
              const isPowderTarget = powderTarget === player.id;
              
              return (
                <TableRow 
                  key={player.id}
                  className={cn(
                    "hover:bg-muted/30",
                    isPowderTarget && "bg-yellow-50/50"
                  )}
                >
                  {/* 编号 */}
                  <TableCell className="text-center font-medium">
                    {player.number || '-'}
                  </TableCell>

                  {/* 身份 */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-xs font-medium",
                          getRoleColor(player.role)
                        )}
                      >
                        {RoleNameMap[player.role] || player.role}
                      </Badge>
                      <span className={cn("text-xs", getCampColor(player.camp))}>
                        {player.camp === 'detective' ? '侦探阵营' : 
                         player.camp === 'killer' ? '凶手阵营' : 
                         player.camp === 'good' ? '好人阵营' :
                         player.camp === 'evil' ? '坏人阵营' : '中立'}
                      </span>
                    </div>
                  </TableCell>

                  {/* 血量 - 修改：只显示当前血量 */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Heart className={cn(
                        "w-4 h-4",
                        player.health <= 1 ? "text-red-500" : "text-red-400"
                      )} />
                      <span className={cn(
                        "font-medium",
                        player.health <= 1 && "text-red-600 font-bold"
                      )}>
                        {player.health}
                      </span>
                    </div>
                    {/* 虚弱状态标识 */}
                    {(player.isWeakened || player.health === 0) && (
                      <div className="text-xs text-red-500 font-medium mt-1">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        虚弱
                      </div>
                    )}
                  </TableCell>

                  {/* 行动点 */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span className="font-medium">{player.actionPoints}</span>
                    </div>
                  </TableCell>

                  {/* 道具 */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {player.items && player.items.length > 0 ? (
                        player.items.map((item, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-xs"
                            title={ItemNameMap[item] || item}
                          >
                            {getItemIcon(item)} {ItemNameMap[item] || item}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">无</span>
                      )}
                    </div>
                  </TableCell>

                  {/* 位置 */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm">{getLocationName(player.currentLocation)}</span>
                    </div>
                  </TableCell>

                  {/* 投凶状态 - 关键修复：实时显示投票状态 */}
                  <TableCell>
                    {voted ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="default" className="bg-green-500 text-xs">
                          <Vote className="w-3 h-3 mr-1" />
                          已投凶
                        </Badge>
                        {voteTarget && (
                          <span className="text-xs text-muted-foreground">
                            投给: {voteTarget.name}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        未投凶
                      </Badge>
                    )}
                  </TableCell>

                  {/* 状态 */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {player.isAlive ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                          存活
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          死亡
                        </Badge>
                      )}
                      {isPowderTarget && (
                        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                          荧光粉
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* 图例说明 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Heart className="w-3 h-3 text-red-500" />
          <span>血量</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-blue-400" />
          <span>行动点</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-red-500" />
          <span>虚弱状态</span>
        </div>
        <div className="flex items-center gap-1">
          <Vote className="w-3 h-3 text-green-500" />
          <span>已投凶</span>
        </div>
      </div>
    </div>
  );
}
