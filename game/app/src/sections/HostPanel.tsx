import { useState } from 'react';
import { useWebSocketStore } from '@/store/websocketStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Heart, 
  MapPin, 
  ChevronRight,
  Flame,
  Lightbulb,
  Play,
  RotateCcw,
  Skull
} from 'lucide-react';
import { getLocationById, getLocationsByFloor } from '@/data/locations';
import { getRoleIcon, getRoleName, getCampColor } from '@/data/roles';
import { cn } from '@/lib/utils';
import type { Player, Role } from '@/types/game';

export function HostPanel() {
  const { 
    round = 1, 
    phase = 'config', 
    players = [], 
    fireLocations = [], 
    lightLocations = [],
    roomCode = '',
    isHost,
    nextPhase,
    resetGame,
    setPlayerRole,
    startGame,
    calculateSettlement
  } = useWebSocketStore();

  const [activeTab, setActiveTab] = useState('players');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);

  const phaseNames: Record<string, string> = {
    lobby: '等待开始',
    config: '配置中',
    free: '自由阶段',
    action: '行动阶段',
    settlement: '结算阶段',
    ended: '游戏结束'
  };

  // 包装设置身份函数，添加权限检查
  const handleSetRole = (playerId: string, role: Role) => {
    if (!isHost) {
      alert('只有主持人可以设置身份');
      console.error('[HostPanel] 权限拒绝：非主持人尝试设置身份');
      return;
    }
    setPlayerRole(playerId, role);
  };

  // 包装开始游戏函数，添加权限检查
  const handleStartGame = () => {
    if (!isHost) {
      alert('只有主持人可以开始游戏');
      console.error('[HostPanel] 权限拒绝：非主持人尝试开始游戏');
      return;
    }
    startGame();
  };

  const handleNextPhase = () => {
    nextPhase();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      {/* 顶部状态栏 */}
      <header className="flex items-center justify-between mb-4 p-4 bg-[#1a1a1a] border border-[#d4a853] rounded-lg">
        <div className="flex items-center gap-4">
          {/* 房间号 - 最左边 */}
          <div className="flex items-center gap-1">
            <span className="text-[#aaaaaa] text-sm">房间:</span>
            <span className="text-lg font-bold text-[#d4a853] tracking-wider">
              {roomCode || '-'}
            </span>
          </div>
          
          {/* 分隔线 */}
          <div className="w-px h-6 bg-[#444]" />
          
          {/* 轮次 */}
          <div className="text-xl font-bold text-[#d4a853]">
            第 {round} 轮
          </div>
          
          {/* 分隔线 */}
          <div className="w-px h-6 bg-[#444]" />
          
          {/* 阶段 */}
          <div className="text-base text-[#f5f5f5]">
            {phaseNames[phase] || phase}
          </div>
          
          {/* 分隔线 */}
          <div className="w-px h-6 bg-[#444]" />
          
          {/* 状态图标 */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-[#c9302c] text-[#c9302c] text-xs">
              <Flame className="w-3 h-3 mr-1" />
              {fireLocations.length}
            </Badge>
            <Badge variant="outline" className="border-[#5bc0de] text-[#5bc0de] text-xs">
              <Lightbulb className="w-3 h-3 mr-1" />
              {lightLocations.length}
            </Badge>
          </div>

          {/* 主持人标识 */}
          {isHost && (
            <Badge className="bg-[#d4a853] text-[#0a0a0a] ml-2">
              👑 主持人
            </Badge>
          )}
        </div>
        
        {/* 右侧按钮 */}
        <div className="flex items-center gap-2">
          {phase === 'config' && (
            <Button 
              onClick={handleStartGame}
              disabled={!isHost}
              className="bg-[#2ca02c] text-white hover:bg-[#259025] h-9 disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-1" />
              开始游戏
            </Button>
          )}
          {phase !== 'config' && phase !== 'lobby' && phase !== 'ended' && (
            <>
              {phase === 'settlement' && (
                <Button 
                  variant="outline"
                  onClick={() => setShowSettlement(true)}
                  className="border-[#d4a853] text-[#d4a853] h-9"
                >
                  查看结算
                </Button>
              )}
              <Button 
                onClick={handleNextPhase}
                className="bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4b] h-9"
              >
                {phase === 'settlement' && round >= 5 ? '结束游戏' : '下一阶段'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
          <Button 
            variant="outline" 
            onClick={resetGame}
            className="border-[#444] text-[#aaaaaa] h-9"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
        </div>
      </header>

      {/* 主内容区 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-[#1a1a1a] border border-[#444]">
          <TabsTrigger value="players" className="flex-1 data-[state=active]:bg-[#d4a853] data-[state=active]:text-[#0a0a0a]">
            <Heart className="w-4 h-4 mr-1" />
            玩家管理
          </TabsTrigger>
          <TabsTrigger value="map" className="flex-1 data-[state=active]:bg-[#d4a853] data-[state=active]:text-[#0a0a0a]">
            <MapPin className="w-4 h-4 mr-1" />
            地图
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="mt-4">
          <PlayerManagement 
            players={players}
            selectedPlayer={selectedPlayer}
            onSelectPlayer={setSelectedPlayer}
            onSetRole={handleSetRole}
            phase={phase}
            isHost={isHost}
          />
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <HostMapView 
            fireLocations={fireLocations}
            lightLocations={lightLocations}
            players={players}
          />
        </TabsContent>
      </Tabs>

      {/* 结算弹窗 */}
      <Dialog open={showSettlement} onOpenChange={setShowSettlement}>
        <DialogContent className="bg-[#1a1a1a] border-[#d4a853] max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-[#d4a853]">第{round}轮结算详情</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <SettlementDetail settlement={calculateSettlement()} players={players} />
            <PublicAnnouncement settlement={calculateSettlement()} players={players} round={round} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PlayerManagementProps {
  players: Player[];
  selectedPlayer: Player | null;
  onSelectPlayer: (player: Player) => void;
  onSetRole: (playerId: string, role: Role) => void;
  phase: string;
  isHost: boolean;
}

function PlayerManagement({ players, selectedPlayer, onSelectPlayer, onSetRole, phase, isHost }: PlayerManagementProps) {
  const roles: Role[] = ['killer', 'accomplice', 'detective', 'engineer', 'hacker', 'doctor', 'fan'];

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-7">
        <Card className="bg-[#1a1a1a] border-[#d4a853]">
          <CardHeader>
            <CardTitle className="text-[#d4a853]">玩家列表 ({players.length}人)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {players.map((player, index) => (
                <PlayerCard 
                  key={player.id}
                  player={player}
                  index={index}
                  isSelected={selectedPlayer?.id === player.id}
                  onClick={() => onSelectPlayer(player)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="col-span-5">
        {selectedPlayer ? (
          <PlayerDetail 
            player={selectedPlayer}
            phase={phase}
            roles={roles}
            onSetRole={onSetRole}
            isHost={isHost}
          />
        ) : (
          <Card className="bg-[#1a1a1a] border-[#444]">
            <CardContent className="p-6 text-center text-[#aaaaaa]">
              选择一名玩家查看详情
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface PlayerCardProps {
  player: Player;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

function PlayerCard({ player, index, isSelected, onClick }: PlayerCardProps) {
  const healthColor = player.health > 0 ? 'text-[#c9302c]' : 'text-[#444]';
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg cursor-pointer transition-all",
        "border border-[#444] hover:border-[#d4a853]",
        isSelected && "border-[#d4a853] bg-[#2a2a2a]",
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
          <Heart className={cn("w-4 h-4", healthColor)} />
          <span className={healthColor}>
            {player.health}/{player.maxHealth}
          </span>
        </div>
        <div className="text-[#d4a853]">{player.score}分</div>
      </div>
      <div className="mt-1 text-xs text-[#8b7355]">
        {getRoleName(player.role)}
      </div>
    </div>
  );
}

interface PlayerDetailProps {
  player: Player;
  phase: string;
  roles: Role[];
  onSetRole: (playerId: string, role: Role) => void;
  isHost: boolean;
}

function PlayerDetail({ player, phase, roles, onSetRole, isHost }: PlayerDetailProps) {
  const campText = 
    player.camp === 'killer' ? '凶手阵营' :
    player.camp === 'detective' ? '侦探阵营' : '中立';
  
  const locationName = getLocationById(player.currentLocation)?.name || '未设置';

  return (
    <Card className="bg-[#1a1a1a] border-[#d4a853]">
      <CardHeader>
        <CardTitle className="text-[#d4a853]">{player.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'config' && (
          <div>
            <label className="text-[#aaaaaa] text-sm mb-2 block">
              设置身份 {!isHost && <span className="text-[#c9302c]">(仅主持人可操作)</span>}
            </label>
            <Select 
              value={player.role} 
              onValueChange={(value) => onSetRole(player.id, value as Role)}
              disabled={!isHost}
            >
              <SelectTrigger className="bg-[#2a2a2a] border-[#444] text-[#f5f5f5] disabled:opacity-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-[#444]">
                {roles.map((role) => (
                  <SelectItem 
                    key={role} 
                    value={role}
                    className="text-[#f5f5f5]"
                  >
                    {getRoleIcon(role)} {getRoleName(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[#aaaaaa]">阵营</span>
            <span style={{ color: getCampColor(player.camp) }}>{campText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#aaaaaa]">生命值</span>
            <span className="text-[#f5f5f5]">{player.health}/{player.maxHealth}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#aaaaaa]">当前位置</span>
            <span className="text-[#f5f5f5]">{locationName}</span>
          </div>
        </div>

        <div>
          <span className="text-[#aaaaaa] text-sm">道具</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {player.items.map((item, idx) => (
              <ItemBadge key={idx} item={item} />
            ))}
            {player.items.length === 0 && (
              <span className="text-[#666]">无道具</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemBadge({ item }: { item: string }) {
  const itemLabels: Record<string, string> = {
    'bandage': '[绷带]',
    'powder': '[荧光粉]',
    'extinguisher': '[灭火器]',
    'rope': '[绳索]',
    'ski': '[滑雪套装]'
  };
  
  return (
    <Badge variant="outline" className="border-[#d4a853] text-[#d4a853]">
      {itemLabels[item] || item}
    </Badge>
  );
}

interface HostMapViewProps {
  fireLocations: string[];
  lightLocations: string[];
  players: Player[];
}

function HostMapView({ fireLocations, lightLocations, players }: HostMapViewProps) {
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
          {floors.map(floor => (
            <FloorSection 
              key={floor.id}
              floor={floor}
              fireLocations={fireLocations}
              lightLocations={lightLocations}
              players={players}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FloorSectionProps {
  floor: { id: string; name: string; color: string };
  fireLocations: string[];
  lightLocations: string[];
  players: Player[];
}

function FloorSection({ floor, fireLocations, lightLocations, players }: FloorSectionProps) {
  const floorLocations = getLocationsByFloor(floor.id as any);
  
  return (
    <div className="border border-[#444] rounded-lg p-3">
      <div 
        className="text-sm font-bold mb-2 px-2 py-1 rounded"
        style={{ backgroundColor: floor.color + '33', color: floor.color }}
      >
        {floor.name}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {floorLocations.map(loc => (
          <LocationCell 
            key={loc.id}
            location={loc}
            isOnFire={fireLocations.includes(loc.id)}
            isLit={lightLocations.includes(loc.id)}
            playersHere={players.filter(p => p.currentLocation === loc.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface LocationCellProps {
  location: { id: string; name: string };
  isOnFire: boolean;
  isLit: boolean;
  playersHere: Player[];
}

function LocationCell({ location, isOnFire, isLit, playersHere }: LocationCellProps) {
  let borderClass = 'border-[#444] bg-[#2a2a2a]';
  if (isOnFire) borderClass = 'border-[#c9302c] bg-[#c9302c22]';
  if (isLit) borderClass = 'border-[#5bc0de] bg-[#5bc0de22]';
  
  return (
    <div className={cn("p-2 rounded border text-center text-sm", borderClass)}>
      <div className="text-[#f5f5f5] text-xs">{location.name}</div>
      <div className="flex items-center justify-center gap-1 mt-1">
        {isOnFire && <Flame className="w-3 h-3 text-[#c9302c]" />}
        {isLit && <Lightbulb className="w-3 h-3 text-[#5bc0de]" />}
      </div>
      {playersHere.length > 0 && (
        <div className="mt-1 text-[10px] text-[#d4a853]">
          {playersHere.map(p => p.name).join(', ')}
        </div>
      )}
    </div>
  );
}

interface SettlementDetailProps {
  settlement: any;
  players: Player[];
}

function SettlementDetail({ settlement, players }: SettlementDetailProps) {
  const healthChanges = settlement.healthChanges || [];
  const overlappingPlayers = settlement.overlappingPlayers || [];
  const exposedActionLines = settlement.exposedActionLines || [];
  
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-[#d4a853] border-b border-[#444] pb-2">
        完整结算信息（仅主持人可见）
      </h3>
      
      <div>
        <h4 className="text-[#d4a853] mb-2">生命变化</h4>
        <div className="space-y-1">
          {healthChanges.map((change: any, idx: number) => {
            const player = players.find(p => p.id === change.playerId);
            const changeClass = change.change < 0 ? 'text-[#c9302c]' : 'text-[#2ca02c]';
            const bgClass = change.change < 0 ? 'bg-[#c9302c22]' : 'bg-[#2ca02c22]';
            const sign = change.change > 0 ? '+' : '';
            
            return (
              <div key={idx} className={cn("flex items-center justify-between p-2 rounded", bgClass)}>
                <span className="text-[#f5f5f5]">{player?.name}</span>
                <span className={changeClass}>
                  {sign}{change.change} ({change.reason})
                </span>
              </div>
            );
          })}
          {healthChanges.length === 0 && <span className="text-[#666]">无生命变化</span>}
        </div>
      </div>

      <div>
        <h4 className="text-[#d4a853] mb-2">亮灯地点重叠玩家</h4>
        <div className="space-y-1">
          {overlappingPlayers.map((overlap: any, idx: number) => {
            const loc = getLocationById(overlap.locationId);
            const playerNames = overlap.players
              .map((pid: string) => players.find(p => p.id === pid)?.name)
              .filter(Boolean)
              .join(', ');
            
            return (
              <div key={idx} className="p-2 bg-[#2a2a2a] rounded border border-[#444]">
                <div className="text-[#5bc0de]">{loc?.name}</div>
                <div className="text-sm text-[#aaaaaa]">{playerNames}</div>
              </div>
            );
          })}
          {overlappingPlayers.length === 0 && <span className="text-[#666]">无重叠玩家</span>}
        </div>
      </div>

      {exposedActionLines.length > 0 && (
        <div>
          <h4 className="text-[#d4a853] mb-2">荧光粉暴露的行动线</h4>
          {exposedActionLines.map((exposed: any, idx: number) => {
            const player = players.find(p => p.id === exposed.playerId);
            const fakeText = exposed.isFake ? '(编造)' : '';
            
            return (
              <div key={idx} className="p-2 bg-[#2a2a2a] rounded border border-[#d4a853]">
                <div className="text-[#f5f5f5] font-bold">{player?.name} {fakeText}</div>
                <div className="text-sm text-[#aaaaaa] mt-1">
                  {exposed.actionLine.map((step: any, i: number) => (
                    <span key={i} className="inline-block mr-2">
                      第{step.step}步:{getLocationById(step.locationId)?.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PublicAnnouncementProps {
  settlement: any;
  players: Player[];
  round: number;
}

function PublicAnnouncement({ settlement, players }: PublicAnnouncementProps) {
  const fireDamage = settlement.fireDamage || [];
  const overlappingPlayers = settlement.overlappingPlayers || [];
  const healthChanges = settlement.healthChanges || [];
  const exposedActionLines = settlement.exposedActionLines || [];
  const voteResults = settlement.voteResults || [];
  
  const fireLocs = fireDamage.map((d: any) => d.locationId);
  const uniqueFireLocs = [...new Set(fireLocs)] as string[];
  
  const healthChangedPlayers = healthChanges.filter((c: any) => c.change !== 0);
  const eliminatedPlayers = players.filter(p => !p.isAlive);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-[#5bc0de] border-b border-[#444] pb-2">
        公示信息（可展示给玩家）
      </h3>
      
      <div className="p-3 bg-[#c9302c22] rounded border border-[#c9302c]">
        <h4 className="text-[#c9302c] font-bold mb-2 flex items-center">
          <Flame className="w-4 h-4 mr-1" />
          着火地点预告（下一轮）
        </h4>
        {uniqueFireLocs.length > 0 ? (
          <div className="text-[#f5f5f5]">
            以下地点将在下一轮着火：
            <div className="flex flex-wrap gap-2 mt-2">
              {uniqueFireLocs.map((locId, idx) => (
                <Badge key={idx} variant="outline" className="border-[#c9302c] text-[#c9302c]">
                  {getLocationById(locId)?.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-[#aaaaaa]">本轮无新的着火地点</span>
        )}
      </div>

      <div className="p-3 bg-[#5bc0de22] rounded border border-[#5bc0de]">
        <h4 className="text-[#5bc0de] font-bold mb-2 flex items-center">
          <Lightbulb className="w-4 h-4 mr-1" />
          亮灯地点重叠公告
        </h4>
        {overlappingPlayers.length > 0 ? (
          <div className="space-y-2">
            {overlappingPlayers.map((overlap: any, idx: number) => {
              const loc = getLocationById(overlap.locationId);
              return (
                <div key={idx} className="text-[#f5f5f5]">
                  <span className="text-[#5bc0de]">{loc?.name}</span> 
                  有 {overlap.players.length} 名玩家同时出现
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-[#aaaaaa]">本轮无亮灯地点重叠</span>
        )}
      </div>

      <div className="p-3 bg-[#2a2a2a] rounded border border-[#444]">
        <h4 className="text-[#d4a853] font-bold mb-2 flex items-center">
          <Heart className="w-4 h-4 mr-1" />
          生命变化公告
        </h4>
        {healthChangedPlayers.length > 0 ? (
          <div className="space-y-1">
            {healthChangedPlayers.map((change: any, idx: number) => {
              const player = players.find(p => p.id === change.playerId);
              const changeClass = change.change < 0 ? 'text-[#c9302c]' : 'text-[#2ca02c]';
              const bgClass = change.change < 0 ? 'bg-[#c9302c11]' : 'bg-[#2ca02c11]';
              const sign = change.change > 0 ? '+' : '';
              
              return (
                <div key={idx} className={cn("flex items-center justify-between p-2 rounded", bgClass)}>
                  <span className="text-[#f5f5f5]">{player?.name}</span>
                  <span className={changeClass}>
                    {sign}{change.change} 生命
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-[#aaaaaa]">本轮无生命变化</span>
        )}
      </div>

      {eliminatedPlayers.length > 0 && (
        <div className="p-3 bg-[#444] rounded border border-[#666]">
          <h4 className="text-[#666] font-bold mb-2 flex items-center">
            <Skull className="w-4 h-4 mr-1" />
            出局公告
          </h4>
          <div className="text-[#f5f5f5]">
            以下玩家在本轮出局：
            <div className="flex flex-wrap gap-2 mt-2">
              {eliminatedPlayers.map((player, idx) => (
                <Badge key={idx} variant="outline" className="border-[#666] text-[#aaaaaa]">
                  {player.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {exposedActionLines.length > 0 && (
        <div className="p-3 bg-[#d4a85322] rounded border border-[#d4a853]">
          <h4 className="text-[#d4a853] font-bold mb-2">[荧光粉] 暴露</h4>
          {exposedActionLines.map((exposed: any, idx: number) => {
            const player = players.find(p => p.id === exposed.playerId);
            return (
              <div key={idx} className="text-[#f5f5f5]">
                <span className="text-[#d4a853] font-bold">{player?.name}</span> 
                的行动线已被暴露！
              </div>
            );
          })}
        </div>
      )}

      {voteResults.length > 0 && (
        <div className="p-3 bg-[#2ca02c22] rounded border border-[#2ca02c]">
          <h4 className="text-[#2ca02c] font-bold mb-2">[投票] 投凶结果</h4>
          <div className="text-[#f5f5f5]">
            本轮共有 {voteResults.length} 名玩家参与投凶
          </div>
        </div>
      )}
    </div>
  );
}