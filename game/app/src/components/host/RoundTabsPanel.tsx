// src/components/host/RoundTabsPanel.tsx
/**
 * 轮次信息选项卡组件
 * 显示各轮次的历史信息，包括血量变化、重叠行动线等
 */

import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Heart, 
  Users, 
  Lightbulb, 
  Flame,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player, GameState } from '@/types/game';
import { HealthHistoryTable } from './HealthHistoryTable';
import { OverlapActionTable } from './OverlapActionTable';

interface RoundTabsPanelProps {
  gameState: GameState;
}

interface RoundHistory {
  round: number;
  phase: string;
  players: Player[];
  fireLocations: string[];
  lightLocations: string[];
  votes: Record<string, string>;
  powderTarget: string | null;
  timestamp: number;
}

export function RoundTabsPanel({ gameState }: RoundTabsPanelProps) {
  const [activeTab, setActiveTab] = useState('current');

  // 获取轮次历史
  const roundHistories = useMemo(() => {
    return gameState.roundHistories || [];
  }, [gameState.roundHistories]);

  // 获取当前轮次数据
  const currentRoundData = useMemo(() => {
    return {
      round: gameState.round,
      phase: gameState.phase,
      players: gameState.players,
      fireLocations: gameState.fireLocations,
      lightLocations: gameState.lightLocations,
      votes: gameState.votes,
      powderTarget: gameState.powderTarget
    };
  }, [gameState]);

  // 获取指定轮次的历史数据
  const getRoundHistory = (round: number): RoundHistory | null => {
    return roundHistories.find(h => h.round === round) || null;
  };

  // 渲染轮次内容
  const renderRoundContent = (roundData: RoundHistory | typeof currentRoundData, isCurrent: boolean = false) => {
    const players = roundData.players;
    const lightLocations = roundData.lightLocations;
    const powderTarget = roundData.powderTarget;
    const fireLocations = roundData.fireLocations;

    return (
      <div className="space-y-6">
        {/* 轮次信息 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isCurrent ? "default" : "secondary"} className="text-lg">
              第 {roundData.round} 轮
            </Badge>
            {isCurrent && (
              <Badge variant="outline" className="text-sm">
                当前
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {lightLocations.length > 0 && (
              <div className="flex items-center gap-1">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span>{lightLocations.length} 个亮灯</span>
              </div>
            )}
            {fireLocations.length > 0 && (
              <div className="flex items-center gap-1">
                <Flame className="w-4 h-4 text-red-500" />
                <span>{fireLocations.length} 个着火</span>
              </div>
            )}
            {powderTarget && (
              <div className="flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>有荧光粉</span>
              </div>
            )}
          </div>
        </div>

        {/* 血量状态 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              血量状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HealthHistoryTable 
              playerHealths={players.map(p => ({
                playerId: p.id,
                playerName: p.name,
                health: p.health,
                maxHealth: p.maxHealth,
                isAlive: p.isAlive
              }))}
              title=""
            />
          </CardContent>
        </Card>

        {/* 重叠行动线 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              重叠行动线
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OverlapActionTable 
              players={players}
              lightLocations={lightLocations}
              powderTarget={powderTarget ?? null} 
              title=""
            />
          </CardContent>
        </Card>

        {/* 虚弱状态玩家 */}
        {players.some(p => p.isWeakened || p.health === 0) && (
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                虚弱状态玩家
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {players
                  .filter(p => p.isWeakened || p.health === 0)
                  .map(player => (
                    <div 
                      key={player.id}
                      className="flex items-center justify-between p-2 bg-red-50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{player.name}</span>
                        <Badge variant="destructive" className="text-xs">
                          虚弱
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        血量: {player.health} | 行动点: 4 | 分数: 0
                      </span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                虚弱状态：血量锁定在0，每轮仅有4个行动点，不参与行动线重叠结算，个人累积分数全部失效
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // 生成轮次选项卡
  const generateRoundTabs = () => {
    const tabs = [];
    
    // 历史轮次
    roundHistories.forEach(history => {
      tabs.push(
        <TabsTrigger 
          key={`round-${history.round}`} 
          value={`round-${history.round}`}
          className="text-sm"
        >
          第 {history.round} 轮
        </TabsTrigger>
      );
    });
    
    // 当前轮次
    tabs.push(
      <TabsTrigger 
        key="current" 
        value="current"
        className="text-sm"
      >
        当前 (第 {gameState.round} 轮)
      </TabsTrigger>
    );
    
    return tabs;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          轮次信息
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            {generateRoundTabs()}
          </TabsList>
          
          {/* 历史轮次内容 */}
          {roundHistories.map(history => (
            <TabsContent key={`round-${history.round}`} value={`round-${history.round}`}>
              <ScrollArea className="h-[600px]">
                {renderRoundContent(history)}
              </ScrollArea>
            </TabsContent>
          ))}
          
          {/* 当前轮次内容 */}
          <TabsContent value="current">
            <ScrollArea className="h-[600px]">
              {renderRoundContent(currentRoundData, true)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
