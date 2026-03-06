/**
 * ============================================
 * 暴风雪山庄游戏系统 - 游戏大厅组件
 * ============================================
 * 
 * 文件说明：
 * - 显示游戏配置界面
 * - 显示已加入的玩家列表
 * - 主持人可以在这里分配身份并开始游戏
 * 
 * 如何修改：
 * 1. 修改玩家卡片样式：修改 player-card 的 className
 * 2. 修改身份分配说明：修改身份分配区域的内容
 * 3. 修改游戏规则：修改 GameRules 组件
 * ============================================
 */

import { useWebSocketStore } from '@/store/websocketStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Play, Settings, Users } from 'lucide-react';

// 角色名称映射
const roleNames: Record<string, string> = {
  killer: '🔪 凶手',
  accomplice: '🎭 帮凶',
  detective: '🔍 侦探',
  engineer: '⚙️ 工程师',
  hacker: '💻 黑客',
  doctor: '💉 医生',
  fan: '🧠 推理迷'
};

/**
 * 游戏大厅组件
 * 功能：显示游戏配置界面，包括玩家列表、身份分配说明、开始游戏按钮
 */
export function Lobby() {
  const { players, startGame, roomCode, myHostId, myPlayerId } = useWebSocketStore();
  
  // 如果是主持人，不显示玩家大厅，而是显示主持人面板或加载状态
  const isHost = !!myHostId && myHostId === myPlayerId;
  
  if (isHost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4a853] mx-auto mb-4" />
          <p className="text-[#d4a853]">正在恢复主持人状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        // 使用主背景图
        backgroundImage: 'url(/images/main-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* 半透明遮罩 */}
      <div className="absolute inset-0 bg-black/70" />
      
      {/* 主卡片 */}
      <Card 
        className="w-full max-w-3xl relative z-10"
        style={{
          background: 'rgba(26, 26, 26, 0.95)',
          border: '2px solid #d4a853',
          boxShadow: '0 0 30px rgba(212, 168, 83, 0.3)'
        }}
      >
        <CardHeader className="text-center border-b border-[#333] pb-4">
          <CardTitle 
            className="text-3xl font-bold"
            style={{ color: '#d4a853' }}
          >
            游戏配置
          </CardTitle>
          <div className="text-[#aaaaaa] text-sm mt-2">
            房间码: <span className="text-[#d4a853] font-bold text-xl tracking-widest">{roomCode}</span>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-6">
          {/* 玩家列表区域 */}
          <div>
            <h3 
              className="text-lg font-bold mb-3 flex items-center gap-2"
              style={{ color: '#d4a853' }}
            >
              <Users className="w-5 h-5" />
              玩家列表（{players.length}/10人）
            </h3>
            
            {/* 玩家卡片网格 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {players.map((player, index) => (
                <div 
                  key={player.id}
                  className="p-3 rounded-lg text-center transition-all hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                    border: '1px solid #444'
                  }}
                >
                  {/* 玩家编号 */}
                  <div 
                    className="text-xs mb-1"
                    style={{ color: '#d4a853' }}
                  >
                    玩家 {index + 1}
                  </div>
                  
                  {/* 玩家名字 */}
                  <div className="text-[#f5f5f5] font-medium truncate">
                    {player.name}
                  </div>
                  
                  {/* 身份显示 */}
                  <div 
                    className="text-xs mt-1 px-2 py-1 rounded"
                    style={{
                      background: player.role ? 'rgba(212, 168, 83, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                      color: player.role ? '#d4a853' : '#666'
                    }}
                  >
                    {player.role ? roleNames[player.role] : '等待分配'}
                  </div>
                </div>
              ))}
              
              {/* 空位显示 */}
              {Array.from({ length: Math.max(0, 10 - players.length) }).map((_, i) => (
                <div 
                  key={`empty-${i}`}
                  className="p-3 rounded-lg text-center"
                  style={{
                    background: 'rgba(40, 40, 40, 0.5)',
                    border: '1px dashed #444'
                  }}
                >
                  <div className="text-xs mb-1" style={{ color: '#666' }}>
                    玩家 {players.length + i + 1}
                  </div>
                  <div className="text-[#666]">等待加入...</div>
                </div>
              ))}
            </div>
          </div>

          {/* 身份分配说明 */}
          <div 
            className="p-4 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
              border: '1px solid #444'
            }}
          >
            <h3 className="text-[#d4a853] font-bold mb-3">身份分配</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* 凶手阵营 */}
              <div>
                <div 
                  className="font-bold mb-2 flex items-center gap-2"
                  style={{ color: '#c9302c' }}
                >
                  <span className="w-3 h-3 rounded-full bg-[#c9302c]" />
                  凶手阵营
                </div>
                <div className="text-[#aaaaaa] space-y-1">
                  <div>凶手 × 1</div>
                  <div>帮凶 × 2</div>
                </div>
              </div>
              
              {/* 侦探阵营 */}
              <div>
                <div 
                  className="font-bold mb-2 flex items-center gap-2"
                  style={{ color: '#5bc0de' }}
                >
                  <span className="w-3 h-3 rounded-full bg-[#5bc0de]" />
                  侦探阵营
                </div>
                <div className="text-[#aaaaaa] space-y-1">
                  <div>侦探 × 1</div>
                  <div>工程师 × 1</div>
                  <div>黑客 × 2</div>
                  <div>医生 × 2</div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-[#aaaaaa] text-sm text-center">
              推理迷 × 1（可中途加入阵营）
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4">
            {/* 查看规则按钮 */}
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex-1 h-12"
                  style={{
                    borderColor: '#d4a853',
                    color: '#d4a853'
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  查看规则
                </Button>
              </DialogTrigger>
              <DialogContent 
                className="max-w-3xl max-h-[80vh] overflow-y-auto"
                style={{
                  background: '#1a1a1a',
                  border: '2px solid #d4a853'
                }}
              >
                <DialogHeader>
                  <DialogTitle style={{ color: '#d4a853' }}>游戏规则</DialogTitle>
                </DialogHeader>
                <GameRules />
              </DialogContent>
            </Dialog>
            
            {/* 开始游戏按钮 */}
            <Button 
              onClick={startGame}
              className="flex-1 h-12 font-bold text-lg"
              disabled={players.length < 2}
              style={{
                background: players.length >= 2 
                  ? 'linear-gradient(135deg, #d4a853 0%, #b8941d 100%)' 
                  : '#444',
                color: '#0a0a0a'
              }}
            >
              <Play className="w-5 h-5 mr-2" />
              {players.length < 2 ? '等待更多玩家...' : '开始游戏'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 游戏规则说明组件
 * 功能：显示完整的游戏规则
 * 
 * 如何修改：
 * 直接修改下面的 JSX 内容即可
 */
function GameRules() {
  return (
    <div className="space-y-6 text-[#f5f5f5]">
      {/* 游戏目标 */}
      <section>
        <h3 
          className="text-lg font-bold mb-2"
          style={{ color: '#d4a853' }}
        >
          游戏目标
        </h3>
        <p className="text-[#aaaaaa]">
          本场游戏为阵营战，10名玩家均有各自的身份和阵营。玩家需在山庄的各个地点间秘密行动，攻击对手或维持自己的生命值，并通过"投凶"来获得分数。
        </p>
      </section>

      {/* 游戏机制 */}
      <section>
        <h3 
          className="text-lg font-bold mb-2"
          style={{ color: '#d4a853' }}
        >
          游戏机制
        </h3>
        <div className="space-y-2 text-[#aaaaaa]">
          <p>
            <strong className="text-[#f5f5f5]">行动线：</strong>
            每名玩家每轮有8个行动点，需按先后顺序安排自己的行动。
          </p>
          <p>
            <strong className="text-[#f5f5f5]">投凶：</strong>
            从第二轮开始，拥有生命值的玩家可秘密投凶，指认一名玩家为凶手。投凶正确者可获得1分。
          </p>
          <p>
            <strong className="text-[#f5f5f5]">生命值：</strong>
            每名玩家初始有3点生命值，生命上限为3，下限为0。
          </p>
        </div>
      </section>

      {/* 游戏流程 */}
      <section>
        <h3 
          className="text-lg font-bold mb-2"
          style={{ color: '#d4a853' }}
        >
          游戏流程
        </h3>
        <p className="text-[#aaaaaa]">
          游戏共5轮，每轮分为自由阶段、行动阶段、结算阶段。
        </p>
        <ul className="list-disc list-inside mt-2 text-[#aaaaaa] space-y-1">
          <li>
            <strong className="text-[#f5f5f5]">自由阶段：</strong>
            玩家可自由交流和交易道具
          </li>
          <li>
            <strong className="text-[#f5f5f5]">行动阶段：</strong>
            玩家规划8步行动
          </li>
          <li>
            <strong className="text-[#f5f5f5]">结算阶段：</strong>
            结算生命值变化，公示行动信息
          </li>
        </ul>
      </section>

      {/* 胜利条件 */}
      <section>
        <h3 
          className="text-lg font-bold mb-2"
          style={{ color: '#d4a853' }}
        >
          胜利条件
        </h3>
        <p className="text-[#aaaaaa]">
          第五轮结算阶段后，将统计所有玩家的有效分数。最终比较两个阵营玩家的总分，总分更高的一方获胜。
        </p>
      </section>
    </div>
  );
}
