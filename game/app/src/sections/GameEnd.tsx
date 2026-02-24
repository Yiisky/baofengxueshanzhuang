/**
 * ============================================
 * 游戏结束界面 - 显示最终结果和AI复盘
 * ============================================
 * 
 * 【文件说明】
 * - 显示游戏最终结果
 * - 显示玩家排名
 * - 调用AI生成复盘分析
 * 
 * 【如何修改】
 * - 修改胜利条件：修改 checkWinCondition 调用
 * - 修改显示内容：编辑下面的渲染逻辑
 * ============================================
 */

import { useState, useEffect } from 'react';
import { useWebSocketStore } from '@/store/websocketStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, RotateCcw, Skull, MapPin, Sparkles, Loader2 } from 'lucide-react';
import { getRoleIcon, getRoleName, getCampColor } from '@/data/roles';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/game';
import { generateAIReview, generateLocalReview } from '@/services/aiReview';

export function GameEnd() {
  const { players, resetGame, checkWinCondition, round } = useWebSocketStore();
  
  // AI复盘相关状态
  const [aiReview, setAiReview] = useState<string>('');
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string>('');

  // 计算胜利条件
  const result = checkWinCondition();
  const winner = result?.winner || 'killer';

  // 计算阵营总分
  const killerCamp = players.filter((p: Player) => p.camp === 'killer');
  const detectiveCamp = players.filter((p: Player) => p.camp === 'detective');
  
  const killerScore = killerCamp.reduce((sum: number, p: Player) => sum + (p.isAlive ? p.score : 0), 0);
  const detectiveScore = detectiveCamp.reduce((sum: number, p: Player) => sum + (p.isAlive ? p.score : 0), 0);

  // 排序玩家
  const sortedPlayers = [...players].sort((a: Player, b: Player) => b.score - a.score);

  // 获取案发现场
  const crimeScenes = ['first_crime', 'second_crime'];

  // 生成AI复盘
  const handleGenerateReview = async () => {
    setIsGeneratingReview(true);
    setReviewError('');
    
    try {
      // 先尝试使用AI生成
      const review = await generateAIReview(players, winner, round);
      setAiReview(review);
    } catch (error) {
      console.error('AI复盘生成失败:', error);
      // 如果AI失败，使用本地复盘
      const localReview = generateLocalReview(players, winner, round);
      setAiReview(localReview);
      setReviewError('AI服务暂时不可用，已使用本地复盘');
    } finally {
      setIsGeneratingReview(false);
    }
  };

  // 组件挂载时自动生成复盘
  useEffect(() => {
    handleGenerateReview();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      {/* 获胜标题 */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">
          {winner === 'killer' ? '🔪' : '🔍'}
        </div>
        <h1 className="text-4xl font-bold mb-2" style={{ color: getCampColor(winner) }}>
          {winner === 'killer' ? '凶手阵营' : '侦探阵营'} 获胜！
        </h1>
        <p className="text-[#aaaaaa]">
          {winner === 'killer' 
            ? '凶手成功隐藏身份，完成了完美犯罪' 
            : '侦探成功识破凶手，维护了正义'}
        </p>
      </div>

      {/* 阵营得分 */}
      <div className="grid grid-cols-2 gap-8 mb-8 w-full max-w-2xl">
        <Card className={cn(
          "bg-[#1a1a1a] border-2",
          winner === 'killer' ? "border-[#c9302c]" : "border-[#444]"
        )}>
          <CardHeader className="text-center">
            <CardTitle className="text-[#c9302c]">凶手阵营</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold text-[#c9302c]">{killerScore}</div>
            <div className="text-sm text-[#aaaaaa] mt-1">总分</div>
            <div className="mt-2 text-xs text-[#666]">
              {killerCamp.filter((p: Player) => p.isAlive).length} 人存活
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "bg-[#1a1a1a] border-2",
          winner === 'detective' ? "border-[#5bc0de]" : "border-[#444]"
        )}>
          <CardHeader className="text-center">
            <CardTitle className="text-[#5bc0de]">侦探阵营</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-4xl font-bold text-[#5bc0de]">{detectiveScore}</div>
            <div className="text-sm text-[#aaaaaa] mt-1">总分</div>
            <div className="mt-2 text-xs text-[#666]">
              {detectiveCamp.filter((p: Player) => p.isAlive).length} 人存活
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 标签页：排名和复盘 */}
      <Tabs defaultValue="ranking" className="w-full max-w-4xl">
        <TabsList className="w-full bg-[#1a1a1a] border border-[#444]">
          <TabsTrigger value="ranking" className="flex-1 data-[state=active]:bg-[#d4a853] data-[state=active]:text-[#0a0a0a]">
            <Trophy className="w-4 h-4 mr-1" />
            玩家排名
          </TabsTrigger>
          <TabsTrigger value="review" className="flex-1 data-[state=active]:bg-[#d4a853] data-[state=active]:text-[#0a0a0a]">
            <Sparkles className="w-4 h-4 mr-1" />
            AI复盘
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <Card className="w-full bg-[#1a1a1a] border-[#d4a853]">
            <CardHeader>
              <CardTitle className="text-[#d4a853] flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                玩家排名
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedPlayers.map((player: Player, index: number) => (
                  <PlayerResultRow 
                    key={player.id} 
                    player={player} 
                    index={index}
                    crimeScenes={crimeScenes}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <Card className="w-full bg-[#1a1a1a] border-[#d4a853]">
            <CardHeader>
              <CardTitle className="text-[#d4a853] flex items-center justify-between">
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 mr-2" />
                  AI智能复盘
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateReview}
                  disabled={isGeneratingReview}
                  className="border-[#d4a853] text-[#d4a853] hover:bg-[#d4a85322]"
                >
                  {isGeneratingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      重新生成
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reviewError && (
                <div className="mb-4 p-3 bg-[#c9302c22] rounded border border-[#c9302c] text-[#c9302c] text-sm">
                  {reviewError}
                </div>
              )}
              
              {isGeneratingReview ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-[#d4a853] animate-spin mb-4" />
                  <p className="text-[#aaaaaa]">AI正在分析游戏数据，生成精彩复盘...</p>
                  <p className="text-[#666] text-sm mt-2">这可能需要几秒钟时间</p>
                </div>
              ) : aiReview ? (
                <div className="prose prose-invert max-w-none">
                  <div 
                    className="text-[#f5f5f5] whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: aiReview
                        .replace(/## (.*)/g, '<h2 class="text-xl font-bold text-[#d4a853] mt-6 mb-3">$1</h2>')
                        .replace(/### (.*)/g, '<h3 class="text-lg font-bold text-[#5bc0de] mt-4 mb-2">$1</h3>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#d4a853]">$1</strong>')
                        .replace(/- (.*)/g, '<li class="text-[#aaaaaa] ml-4">$1</li>')
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-12 text-[#666]">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>点击"重新生成"按钮获取AI复盘</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 操作按钮 */}
      <div className="mt-8">
        <Button 
          onClick={resetGame}
          className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b]"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          再来一局
        </Button>
      </div>
    </div>
  );
}

// 玩家结果行
function PlayerResultRow({ 
  player, 
  index,
  crimeScenes 
}: { 
  player: Player; 
  index: number;
  crimeScenes: string[];
}) {
  const visitedCrimeScenes = crimeScenes.filter((id: string) => 
    player.visitedLocations.includes(id)
  );
  const hasVisitedAllCrimeScenes = visitedCrimeScenes.length === crimeScenes.length;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded border",
        index === 0 && "border-[#d4a853] bg-[#d4a85322]",
        index > 0 && "border-[#444] bg-[#2a2a2a]",
        !player.isAlive && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center font-bold",
          index === 0 && "bg-[#d4a853] text-[#0a0a0a]",
          index === 1 && "bg-[#aaaaaa] text-[#0a0a0a]",
          index === 2 && "bg-[#8b7355] text-[#0a0a0a]",
          index > 2 && "bg-[#444] text-[#aaaaaa]"
        )}>
          {index + 1}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#f5f5f5] font-bold">{player.name}</span>
            <span className="text-lg">{getRoleIcon(player.role)}</span>
            <span className="text-xs text-[#aaaaaa]">{getRoleName(player.role)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Badge 
              variant="outline" 
              style={{ borderColor: getCampColor(player.camp), color: getCampColor(player.camp) }}
            >
              {player.camp === 'killer' && '凶手阵营'}
              {player.camp === 'detective' && '侦探阵营'}
              {player.camp === 'neutral' && '中立'}
            </Badge>
            {!player.isAlive && (
              <span className="text-[#444] flex items-center">
                <Skull className="w-3 h-3 mr-1" />
                已出局
              </span>
            )}
            {player.camp === 'detective' && (
              <span className={cn(
                "text-xs flex items-center",
                hasVisitedAllCrimeScenes ? "text-[#2ca02c]" : "text-[#c9302c]"
              )}>
                <MapPin className="w-3 h-3 mr-1" />
                案发现场 {visitedCrimeScenes.length}/{crimeScenes.length}
              </span>
            )}
            {player.totalVotesCorrect > 0 && (
              <span className="text-xs text-[#d4a853]">
                投凶正确 {player.totalVotesCorrect} 次
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold text-[#d4a853]">{player.score}</div>
        <div className="text-xs text-[#aaaaaa]">得分</div>
      </div>
    </div>
  );
}
