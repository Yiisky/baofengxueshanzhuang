// src/components/host/HealthHistoryTable.tsx
/**
 * 血量历史表格组件
 * 显示结算后各玩家的血量状态
 */

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerHealth {
  playerId: string;
  playerName: string;
  health: number;
  maxHealth: number;
  isAlive: boolean;
}

interface HealthHistoryTableProps {
  playerHealths: PlayerHealth[];
  title?: string;
}

export function HealthHistoryTable({ playerHealths, title = "血量状态" }: HealthHistoryTableProps) {
  // 按玩家名称排序
  const sortedHealths = [...playerHealths].sort((a, b) => {
    // 提取编号进行排序
    const numA = parseInt(a.playerName.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.playerName.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  // 获取血量颜色
  const getHealthColor = (health: number, maxHealth: number) => {
    if (health === 0) return 'text-red-600';
    if (health <= 1) return 'text-orange-500';
    if (health <= maxHealth * 0.5) return 'text-yellow-600';
    return 'text-green-600';
  };

  // 获取血量背景色
  const getHealthBgColor = (health: number, maxHealth: number) => {
    if (health === 0) return 'bg-red-50';
    if (health <= 1) return 'bg-orange-50';
    if (health <= maxHealth * 0.5) return 'bg-yellow-50';
    return 'bg-green-50';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          {title}
        </h3>
        <div className="text-sm text-muted-foreground">
          共 {playerHealths.length} 名玩家
        </div>
      </div>

      <ScrollArea className="h-[300px] border rounded-lg">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">玩家</TableHead>
              {/* 修改：只显示当前血量，不显示血量上限 */}
              <TableHead className="w-[80px] text-center">血量</TableHead>
              <TableHead className="w-[100px] text-center">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHealths.map((playerHealth) => {
              const isWeakened = playerHealth.health === 0 || !playerHealth.isAlive;
              
              return (
                <TableRow 
                  key={playerHealth.playerId}
                  className={cn(
                    "hover:bg-muted/30",
                    isWeakened && "bg-red-50/50"
                  )}
                >
                  {/* 玩家名称 */}
                  <TableCell className="font-medium">
                    {playerHealth.playerName}
                  </TableCell>

                  {/* 血量 - 修改：只显示当前血量 */}
                  <TableCell className="text-center">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-lg",
                      getHealthBgColor(playerHealth.health, playerHealth.maxHealth),
                      getHealthColor(playerHealth.health, playerHealth.maxHealth)
                    )}>
                      <Heart className={cn(
                        "w-4 h-4",
                        playerHealth.health <= 1 ? "fill-current" : ""
                      )} />
                      {/* 修改：只显示当前血量，不显示 /maxHealth */}
                      {playerHealth.health}
                    </div>
                  </TableCell>

                  {/* 状态 */}
                  <TableCell className="text-center">
                    {isWeakened ? (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        虚弱
                      </Badge>
                    ) : playerHealth.health <= 1 ? (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                        危险
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                        健康
                      </Badge>
                    )}
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
          <div className="w-3 h-3 rounded-full bg-green-50 border border-green-200" />
          <span>健康 (≥2)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-50 border border-yellow-200" />
          <span>低血量 (1)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-50 border border-red-200" />
          <span>虚弱 (0)</span>
        </div>
      </div>
    </div>
  );
}
