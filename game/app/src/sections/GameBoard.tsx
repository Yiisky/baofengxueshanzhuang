import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { Player, ActionStep } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Heart, 
  Zap, 
  MapPin, 
  Users, 
  Skull, 
  ChevronRight,
  Flame,
  Lightbulb,
  Play,
  RotateCcw
} from 'lucide-react';
import { getLocationById, getLocationsByFloor, getMoveCost } from '@/data/locations';
import { getRoleIcon, getRoleName, getCampColor, getRoleSkillDescription } from '@/data/roles';
import { cn } from '@/lib/utils';

// 游戏主界面
export function GameBoard() {
  const { 
    round, 
    phase, 
    players, 
    fireLocations, 
    lightLocations,
    nextPhase,
    nextRound,
    endGame,
    resetGame
  } = useGameStore();

  const [activeTab, setActiveTab] = useState('map');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // 获取当前玩家（简化版，实际应该根据当前操作玩家）
  const currentPlayer = players[0];

  // 阶段名称
  const phaseNames: Record<string, string> = {
    lobby: '大厅',
    config: '配置',
    free: '自由阶段',
    action: '行动阶段',
    settlement: '结算阶段',
    ended: '游戏结束'
  };

  // 处理阶段切换
  const handleNextPhase = () => {
    if (phase === 'settlement' && round >= 5) {
      endGame();
    } else if (phase === 'settlement') {
      nextRound();
    } else {
      nextPhase();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      {/* 顶部状态栏 */}
      <header className="flex items-center justify-between mb-4 p-4 bg-[#1a1a1a] border border-[#d4a853] rounded-lg">
        <div className="flex items-center gap-6">
          <div className="text-2xl font-bold text-[#d4a853]">
            第 {round} 轮
          </div>
          <div className="text-lg text-[#f5f5f5]">
            {phaseNames[phase] || phase}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#c9302c] text-[#c9302c]">
              <Flame className="w-3 h-3 mr-1" />
              {fireLocations.length}
            </Badge>
            <Badge variant="outline" className="border-[#5bc0de] text-[#5bc0de]">
              <Lightbulb className="w-3 h-3 mr-1" />
              {lightLocations.length}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={resetGame}
            className="border-[#444] text-[#aaaaaa]"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
          <Button 
            onClick={handleNextPhase}
            className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b]"
          >
            {phase === 'settlement' && round >= 5 ? '结束游戏' : '下一阶段'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="grid grid-cols-12 gap-4">
        {/* 左侧：玩家列表 */}
        <div className="col-span-3">
          <PlayerList 
            players={players}
            selectedPlayer={selectedPlayer}
            onSelectPlayer={setSelectedPlayer}
          />
        </div>

        {/* 中间：地图/行动规划 */}
        <div className="col-span-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-[#1a1a1a] border border-[#444]">
              <TabsTrigger value="map" className="flex-1 data-[state=active]:bg-[#d4a853] data-[state=active]:text-[#0a0a0a]">
                <MapPin className="w-4 h-4 mr-1" />
                地图
              </TabsTrigger>
              <TabsTrigger value="action" className="flex-1 data-[state=active]:bg-[#d4a853] data-[state=active]:text-[#0a0a0a]">
                <Zap className="w-4 h-4 mr-1" />
                行动规划
              </TabsTrigger>
              <TabsTrigger value="settlement" className="flex-1 data-[state=active]:bg-[#d4a853] data-[state=active]:text-[#0a0a0a]">
                <Users className="w-4 h-4 mr-1" />
                结算
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="map" className="mt-4">
              <MapView 
                fireLocations={fireLocations}
                lightLocations={lightLocations}
                players={players}
              />
            </TabsContent>
            
            <TabsContent value="action" className="mt-4">
              <ActionPlanning 
                player={selectedPlayer || currentPlayer}
              />
            </TabsContent>
            
            <TabsContent value="settlement" className="mt-4">
              <SettlementPanel />
            </TabsContent>
          </Tabs>
        </div>

        {/* 右侧：玩家详情/技能 */}
        <div className="col-span-3">
          {selectedPlayer ? (
            <PlayerDetail player={selectedPlayer} />
          ) : (
            <Card className="bg-[#1a1a1a] border-[#444]">
              <CardContent className="p-6 text-center text-[#aaaaaa]">
                选择一名玩家查看详情
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// 玩家列表
function PlayerList({ 
  players, 
  selectedPlayer, 
  onSelectPlayer 
}: { 
  players: Player[];
  selectedPlayer: Player | null;
  onSelectPlayer: (player: Player) => void;
}) {
  return (
    <Card className="bg-[#1a1a1a] border-[#d4a853] h-[calc(100vh-140px)] overflow-auto">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#d4a853] text-lg">玩家列表</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {players.map((player, index) => (
          <div
            key={player.id}
            onClick={() => onSelectPlayer(player)}
            className={cn(
              "p-3 rounded-lg cursor-pointer transition-all",
              "border border-[#444] hover:border-[#d4a853]",
              selectedPlayer?.id === player.id && "border-[#d4a853] bg-[#2a2a2a]",
              !player.isAlive && "opacity-50"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#d4a853] font-bold">{index + 1}</span>
                <span className="text-[#f5f5f5]">{player.name}</span>
              </div>
              <span className="text-lg">{getRoleIcon(player.role)}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <div className="flex items-center gap-1">
                <Heart className={cn(
                  "w-4 h-4",
                  player.health > 1 ? "text-[#c9302c]" : "text-[#444]"
                )} />
                <span className={cn(
                  player.health > 0 ? "text-[#c9302c]" : "text-[#444]"
                )}>
                  {player.health}/{player.maxHealth}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-[#d4a853]" />
                <span className="text-[#d4a853]">{player.actionPoints}</span>
              </div>
              <div className="text-[#aaaaaa]">
                {player.score}分
              </div>
            </div>
            {!player.isAlive && (
              <div className="mt-1 text-xs text-[#444] flex items-center">
                <Skull className="w-3 h-3 mr-1" />
                已出局
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// 地图视图
function MapView({ 
  fireLocations, 
  lightLocations,
  players
}: { 
  fireLocations: string[];
  lightLocations: string[];
  players: Player[];
}) {
  const floors = [
    { id: 'attic' as const, name: '阁楼', color: '#8b7355' },
    { id: 'second' as const, name: '二楼', color: '#d4a853' },
    { id: 'first' as const, name: '一楼', color: '#5bc0de' },
    { id: 'basement' as const, name: '地下室', color: '#666' }
  ];

  return (
    <Card className="bg-[#1a1a1a] border-[#d4a853]">
      <CardHeader>
        <CardTitle className="text-[#d4a853]">山庄地图</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {floors.map(floor => {
            const floorLocations = getLocationsByFloor(floor.id);
            return (
              <div key={floor.id} className="border border-[#444] rounded-lg p-3">
                <div 
                  className="text-sm font-bold mb-2 px-2 py-1 rounded"
                  style={{ backgroundColor: floor.color + '33', color: floor.color }}
                >
                  {floor.name}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {floorLocations.map(loc => {
                    const isOnFire = fireLocations.includes(loc.id);
                    const isLit = lightLocations.includes(loc.id);
                    const playersHere = players.filter(p => p.currentLocation === loc.id);
                    
                    return (
                      <div
                        key={loc.id}
                        className={cn(
                          "p-2 rounded border text-center text-sm cursor-pointer transition-all",
                          "hover:border-[#d4a853]",
                          isOnFire && "border-[#c9302c] bg-[#c9302c22]",
                          isLit && "border-[#5bc0de] bg-[#5bc0de22]",
                          !isOnFire && !isLit && "border-[#444] bg-[#2a2a2a]"
                        )}
                      >
                        <div className="text-[#f5f5f5] text-xs">{loc.name}</div>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {isOnFire && <Flame className="w-3 h-3 text-[#c9302c]" />}
                          {isLit && <Lightbulb className="w-3 h-3 text-[#5bc0de]" />}
                          {playersHere.length > 0 && (
                            <span className="text-xs text-[#d4a853]">
                              {playersHere.length}人
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// 行动规划
function ActionPlanning({ player }: { player: Player | undefined }) {
  const [actionLine, setActionLine] = useState<ActionStep[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const { addActionStep, clearActionLine } = useGameStore();

  if (!player) return null;

  const handleAddStep = (locationId: string) => {
    if (currentStep > 8) return;
    
    const step: ActionStep = {
      step: currentStep,
      locationId,
      action: 'move'
    };
    
    setActionLine([...actionLine, step]);
    setCurrentStep(currentStep + 1);
  };

  const handleClear = () => {
    setActionLine([]);
    setCurrentStep(1);
    clearActionLine(player.id);
  };

  const handleSubmit = () => {
    actionLine.forEach(step => {
      addActionStep(player.id, step);
    });
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#d4a853]">
      <CardHeader>
        <CardTitle className="text-[#d4a853]">
          行动规划 - {player.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 行动点显示 */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-[#aaaaaa]">
            剩余行动点: <span className="text-[#d4a853] text-xl">{player.actionPoints}</span>
          </div>
          <div className="text-[#aaaaaa]">
            当前步骤: <span className="text-[#d4a853] text-xl">{currentStep}/8</span>
          </div>
        </div>

        {/* 已选行动 */}
        <div className="mb-4 p-3 bg-[#2a2a2a] rounded border border-[#444]">
          <div className="text-sm text-[#aaaaaa] mb-2">行动线</div>
          <div className="flex flex-wrap gap-2">
            {actionLine.map((step, idx) => {
              const loc = getLocationById(step.locationId);
              return (
                <div 
                  key={idx}
                  className="px-2 py-1 bg-[#d4a853] text-[#0a0a0a] rounded text-sm"
                >
                  {idx + 1}. {loc?.name}
                </div>
              );
            })}
            {actionLine.length === 0 && (
              <span className="text-[#666]">暂未选择行动</span>
            )}
          </div>
        </div>

        {/* 地点选择 */}
        <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          {player.currentLocation && getLocationById(player.currentLocation)?.connections.map(connId => {
            const loc = getLocationById(connId);
            if (!loc) return null;
            
            const moveCost = getMoveCost(player.currentLocation!, connId, player.items.includes('ski'));
            const canAfford = player.actionPoints >= moveCost;
            
            return (
              <Button
                key={connId}
                variant="outline"
                disabled={!canAfford || currentStep > 8}
                onClick={() => handleAddStep(connId)}
                className={cn(
                  "border-[#444] text-[#f5f5f5]",
                  canAfford && "hover:border-[#d4a853] hover:bg-[#d4a85322]",
                  !canAfford && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="text-xs">
                  <div>{loc.name}</div>
                  <div className="text-[#666]">-{moveCost}点</div>
                </div>
              </Button>
            );
          })}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={handleClear}
            className="flex-1 border-[#444] text-[#aaaaaa]"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={actionLine.length === 0}
            className="flex-1 bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b] disabled:opacity-50"
          >
            <Play className="w-4 h-4 mr-1" />
            提交行动
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 结算面板
function SettlementPanel() {
  const { calculateSettlement, players } = useGameStore();
  const [settlement, setSettlement] = useState<ReturnType<typeof calculateSettlement> | null>(null);

  useEffect(() => {
    setSettlement(calculateSettlement());
  }, [calculateSettlement]);

  if (!settlement) return null;

  return (
    <Card className="bg-[#1a1a1a] border-[#d4a853]">
      <CardHeader>
        <CardTitle className="text-[#d4a853]">第{settlement.round}轮结算</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 生命变化 */}
        <div>
          <h4 className="text-[#aaaaaa] mb-2">生命变化</h4>
          <div className="space-y-1">
            {settlement.healthChanges.map((change, idx) => {
              const player = players.find(p => p.id === change.playerId);
              return (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-2 rounded",
                    change.change < 0 ? "bg-[#c9302c22]" : "bg-[#2ca02c22]"
                  )}
                >
                  <span className="text-[#f5f5f5]">{player?.name}</span>
                  <span className={change.change < 0 ? "text-[#c9302c]" : "text-[#2ca02c]"}>
                    {change.change > 0 ? '+' : ''}{change.change} ({change.reason})
                  </span>
                </div>
              );
            })}
            {settlement.healthChanges.length === 0 && (
              <span className="text-[#666]">无生命变化</span>
            )}
          </div>
        </div>

        {/* 重叠玩家 */}
        <div>
          <h4 className="text-[#aaaaaa] mb-2">亮灯地点重叠玩家</h4>
          <div className="space-y-1">
            {settlement.overlappingPlayers.map((overlap, idx) => {
              const loc = getLocationById(overlap.locationId);
              return (
                <div key={idx} className="p-2 bg-[#2a2a2a] rounded border border-[#444]">
                  <div className="text-[#d4a853]">{loc?.name}</div>
                  <div className="text-sm text-[#aaaaaa]">
                    {overlap.players.map(pid => {
                      const p = players.find(pl => pl.id === pid);
                      return p?.name;
                    }).filter(Boolean).join(', ')}
                  </div>
                </div>
              );
            })}
            {settlement.overlappingPlayers.length === 0 && (
              <span className="text-[#666]">无重叠玩家</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 玩家详情
function PlayerDetail({ player }: { player: Player }) {
  return (
    <Card className="bg-[#1a1a1a] border-[#d4a853]">
      <CardHeader>
        <CardTitle className="text-[#d4a853]">{player.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 基本信息 */}
        <div className="flex items-center justify-between">
          <div className="text-[#aaaaaa]">身份</div>
          <div className="text-[#f5f5f5] font-bold">
            {getRoleIcon(player.role)} {getRoleName(player.role)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[#aaaaaa]">阵营</div>
          <div 
            className="font-bold"
            style={{ color: getCampColor(player.camp) }}
          >
            {player.camp === 'killer' && '凶手阵营'}
            {player.camp === 'detective' && '侦探阵营'}
            {player.camp === 'neutral' && '中立'}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[#aaaaaa]">生命值</div>
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4 text-[#c9302c]" />
            <span className="text-[#f5f5f5]">{player.health}/{player.maxHealth}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[#aaaaaa]">当前位置</div>
          <div className="text-[#f5f5f5]">
            {getLocationById(player.currentLocation)?.name || '未选择'}
          </div>
        </div>

        {/* 道具 */}
        <div>
          <div className="text-[#aaaaaa] mb-2">道具</div>
          <div className="flex flex-wrap gap-1">
            {player.items.map((item, idx) => (
              <Badge key={idx} variant="outline" className="border-[#d4a853] text-[#d4a853]">
                {item === 'bandage' && '🩹 绷带'}
                {item === 'powder' && '✨ 荧光粉'}
                {item === 'extinguisher' && '🧯 灭火器'}
                {item === 'rope' && '🪢 绳索'}
                {item === 'ski' && '⛷️ 滑雪套装'}
              </Badge>
            ))}
            {player.items.length === 0 && (
              <span className="text-[#666]">无道具</span>
            )}
          </div>
        </div>

        {/* 技能 */}
        <div className="p-3 bg-[#2a2a2a] rounded border border-[#444]">
          <div className="text-[#d4a853] font-bold mb-1">技能</div>
          <div className="text-sm text-[#aaaaaa]">
            {getRoleSkillDescription(player.role)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
