// src/components/host/GameReviewDialog.tsx
/**
 * 复盘结算弹窗组件
 * 显示游戏复盘信息，包括投票结果、身份揭示等
 * 修改：支持实时更新，在第二轮投票后也能更新复盘内容
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Trophy, 
  Users, 
  Target, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Vote,
  User,
  Crown,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player, RoleType } from '@/types/game';
import { RoleNameMap, CampColorMap } from '@/types/game';

interface VoteRecord {
  round: number;
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
  isCorrect: boolean;
}

interface GameReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Player[];
  votes: Record<string, string>;
  voteRecords: VoteRecord[];
  currentRound: number;
  winner?: string;
}

export function GameReviewDialog({
  open,
  onOpenChange,
  players,
  votes,
  voteRecords,
  currentRound,
  winner
}: GameReviewDialogProps) {
  // 关键修复：使用本地状态来存储和更新复盘数据，支持实时更新
  const [reviewData, setReviewData] = useState({
    players: players,
    votes: votes,
    voteRecords: voteRecords,
    currentRound: currentRound,
    winner: winner
  });

  // 当props变化时更新本地状态
  useEffect(() => {
    setReviewData({
      players: players,
      votes: votes,
      voteRecords: voteRecords,
      currentRound: currentRound,
      winner: winner
    });
  }, [players, votes, voteRecords, currentRound, winner]);

  // 获取凶手
  const killer = useMemo(() => {
    return reviewData.players.find(p => p.role === 'killer' || p.role === 'murderer');
  }, [reviewData.players]);

  // 获取侦探
  const detective = useMemo(() => {
    return reviewData.players.find(p => p.role === 'detective');
  }, [reviewData.players]);

  // 计算投票统计
  const voteStats = useMemo(() => {
    const stats: Record<string, { count: number; voters: string[] }> = {};
    
    Object.entries(reviewData.votes || {}).forEach(([voterId, targetId]) => {
      if (!stats[targetId]) {
        stats[targetId] = { count: 0, voters: [] };
      }
      const voter = reviewData.players.find(p => p.id === voterId);
      stats[targetId].count++;
      stats[targetId].voters.push(voter?.name || '未知');
    });
    
    return stats;
  }, [reviewData.votes, reviewData.players]);

  // 获取被投票最多的玩家
  const mostVotedPlayer = useMemo(() => {
    let maxVotes = 0;
    let mostVotedId = '';
    
    Object.entries(voteStats).forEach(([playerId, data]) => {
      if (data.count > maxVotes) {
        maxVotes = data.count;
        mostVotedId = playerId;
      }
    });
    
    return reviewData.players.find(p => p.id === mostVotedId);
  }, [voteStats, reviewData.players]);

  // 计算投票正确率
  const voteAccuracy = useMemo(() => {
    if (!reviewData.voteRecords || reviewData.voteRecords.length === 0) return 0;
    const correctCount = reviewData.voteRecords.filter(r => r.isCorrect).length;
    return Math.round((correctCount / reviewData.voteRecords.length) * 100);
  }, [reviewData.voteRecords]);

  // 按轮次分组的投票记录
  const votesByRound = useMemo(() => {
    const grouped: Record<number, VoteRecord[]> = {};
    reviewData.voteRecords?.forEach(record => {
      if (!grouped[record.round]) {
        grouped[record.round] = [];
      }
      grouped[record.round].push(record);
    });
    return grouped;
  }, [reviewData.voteRecords]);

  // 获取角色颜色
  const getRoleColor = (role: RoleType) => {
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
  };

  // 获取阵营名称
  const getCampName = (camp: string) => {
    const campMap: Record<string, string> = {
      detective: '侦探阵营',
      killer: '凶手阵营',
      good: '好人阵营',
      evil: '坏人阵营',
      neutral: '中立阵营',
    };
    return campMap[camp] || '未知阵营';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="w-6 h-6 text-yellow-500" />
            游戏复盘
          </DialogTitle>
          <DialogDescription>
            查看游戏结果、身份揭示和投票统计
            {reviewData.currentRound > 0 && (
              <span className="ml-2 text-xs">
                (当前第 {reviewData.currentRound} 轮)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="identities">身份揭示</TabsTrigger>
            <TabsTrigger value="votes">投票统计</TabsTrigger>
            <TabsTrigger value="history">投票历史</TabsTrigger>
          </TabsList>

          {/* 总览 */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 凶手信息 */}
              <div className="border rounded-lg p-4 bg-red-50/50">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-red-500" />
                  凶手
                </h3>
                {killer ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-white", getRoleColor(killer.role))}>
                        {RoleNameMap[killer.role]}
                      </Badge>
                      <span className="font-medium">{killer.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      编号: {killer.number || '-'}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">未找到凶手</p>
                )}
              </div>

              {/* 侦探信息 */}
              <div className="border rounded-lg p-4 bg-green-50/50">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Crown className="w-5 h-5 text-green-500" />
                  侦探
                </h3>
                {detective ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-white", getRoleColor(detective.role))}>
                        {RoleNameMap[detective.role]}
                      </Badge>
                      <span className="font-medium">{detective.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      编号: {detective.number || '-'}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">未找到侦探</p>
                )}
              </div>
            </div>

            {/* 投票统计 */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Vote className="w-5 h-5" />
                当前投票统计
              </h3>
              {Object.keys(voteStats).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(voteStats)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([playerId, data]) => {
                      const player = reviewData.players.find(p => p.id === playerId);
                      const isKiller = player?.role === 'killer' || player?.role === 'murderer';
                      return (
                        <div 
                          key={playerId} 
                          className={cn(
                            "flex items-center justify-between p-2 rounded",
                            isKiller ? "bg-red-50" : "bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{player?.name || '未知'}</span>
                            {isKiller && (
                              <Badge variant="destructive" className="text-xs">
                                凶手
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{data.count} 票</Badge>
                            <span className="text-xs text-muted-foreground">
                              {data.voters.join('、')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">暂无投票数据</p>
              )}
            </div>

            {/* 获胜方 */}
            {reviewData.winner && (
              <div className={cn(
                "border rounded-lg p-4 text-center",
                reviewData.winner === 'detective' ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              )}>
                <h3 className="font-semibold text-lg">
                  {reviewData.winner === 'detective' ? (
                    <span className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle className="w-6 h-6" />
                      侦探阵营获胜！
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 text-red-600">
                      <XCircle className="w-6 h-6" />
                      凶手阵营获胜！
                    </span>
                  )}
                </h3>
              </div>
            )}
          </TabsContent>

          {/* 身份揭示 */}
          <TabsContent value="identities">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {reviewData.players
                  .sort((a, b) => (a.number || 0) - (b.number || 0))
                  .map(player => (
                    <div 
                      key={player.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        (player.role === 'killer' || player.role === 'murderer') 
                          ? "bg-red-50 border-red-200" 
                          : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg w-8 text-center">
                          {player.number || '-'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{player.name}</span>
                            <Badge className={cn("text-white text-xs", getRoleColor(player.role))}>
                              {RoleNameMap[player.role] || player.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {getCampName(player.camp)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{player.score} 分</p>
                        <p className="text-xs text-muted-foreground">
                          {player.isAlive ? '存活' : '死亡'}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* 投票统计 */}
          <TabsContent value="votes">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">投票正确率</h3>
                <Badge variant={voteAccuracy >= 50 ? "default" : "secondary"}>
                  {voteAccuracy}%
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    正确投票
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {reviewData.voteRecords?.filter(r => r.isCorrect).length || 0}
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    错误投票
                  </h4>
                  <p className="text-2xl font-bold text-red-600">
                    {reviewData.voteRecords?.filter(r => !r.isCorrect).length || 0}
                  </p>
                </div>
              </div>

              {mostVotedPlayer && (
                <div className="border rounded-lg p-4 bg-yellow-50/50">
                  <h4 className="font-medium mb-2">被投票最多的玩家</h4>
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    <span className="font-medium">{mostVotedPlayer.name}</span>
                    <Badge>{voteStats[mostVotedPlayer.id]?.count || 0} 票</Badge>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 投票历史 */}
          <TabsContent value="history">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {Object.entries(votesByRound)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([round, records]) => (
                    <div key={round} className="border rounded-lg p-3">
                      <h4 className="font-medium mb-2">第 {round} 轮投票</h4>
                      <div className="space-y-1">
                        {records.map((record, idx) => (
                          <div 
                            key={idx}
                            className={cn(
                              "flex items-center justify-between p-2 rounded text-sm",
                              record.isCorrect ? "bg-green-50" : "bg-red-50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>{record.voterName}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{record.targetName}</span>
                            </div>
                            {record.isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                
                {(!reviewData.voteRecords || reviewData.voteRecords.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>暂无投票历史</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
