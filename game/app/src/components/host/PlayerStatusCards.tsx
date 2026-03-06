// src/components/host/PlayerStatusCards.tsx
/**
 * 实时玩家状态卡片 - 置顶布局版
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { Player } from '@/types/game';
import { getRoleName, getCampColor } from '@/data/roles';
import { getLocationById } from '@/data/locations';
import { cn } from '@/lib/utils';

interface PlayerStatusCardsProps {
  players: Player[];
  onPlayerClick: (player: Player) => void;
}

export const PlayerStatusCards: React.FC<PlayerStatusCardsProps> = ({
  players,
  onPlayerClick
}) => {
  const displayPlayers = players.slice(0, 10);

  return (
    <div className="grid grid-cols-5 gap-3">
      {displayPlayers.map((player, index) => (
        <PlayerCard 
          key={player.id}
          player={player}
          index={index}
          onClick={() => onPlayerClick(player)}
        />
      ))}

      {Array.from({ length: Math.max(0, 10 - displayPlayers.length) }).map((_, idx) => (
        <div 
          key={`empty-${idx}`}
          className="h-[160px] rounded-xl border-2 border-dashed border-[#333] bg-[#0a0a0a]/30 flex items-center justify-center"
        >
          <span className="text-[#555] text-xs">等待加入</span>
        </div>
      ))}
    </div>
  );
};

interface PlayerCardProps {
  player: Player;
  index: number;
  onClick: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, 
  index,
  onClick 
}) => {
  const location = getLocationById(player.currentLocation);
  const campColor = getCampColor(player.camp);
  const isLowHealth = player.health <= 1;

  return (
    <Card 
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all duration-200 hover:scale-[1.02] h-[160px] overflow-hidden relative",
        "border-2 rounded-xl flex flex-col p-0 m-0", // 移除卡片默认内边距和外边距
        player.isAlive ? "bg-[#141414]" : "bg-[#0a0a0a] opacity-60",
        player.camp === 'killer' && "border-[#c9302c]/40 hover:border-[#c9302c]/70",
        player.camp === 'detective' && "border-[#2ca02c]/40 hover:border-[#2ca02c]/70",
        !player.camp && "border-[#333] hover:border-[#555]"
      )}
    >
      <CardContent className="p-0 m-0 flex flex-col h-full w-full"> {/* 移除CardContent默认内边距和外边距 */}
        {/* 顶部栏 - 置顶紧贴边缘 */}
        <div className="px-3 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between w-full">
          <span className="text-[#f0f0f0] font-bold text-sm">
            {index + 1}号玩家
          </span>
          <span 
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ 
              color: campColor,
              backgroundColor: `${campColor}20`
            }}
          >
            {getRoleName(player.role) || '未分配'}
          </span>
        </div>

        {/* 状态列表 - 紧跟顶部栏 */}
        <div className="flex-1 px-3 py-2 flex flex-col justify-around w-full">
          {/* 位置 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#777]">位置</span>
            <span className="text-[#bbb] truncate max-w-[90px]">
              {location?.name || '未知'}
            </span>
          </div>

          {/* 血量 */}
          <div className={cn(
            "flex items-center justify-between text-xs py-0.5 px-1.5 rounded",
            isLowHealth && "bg-[#c9302c]/15"
          )}>
            <span className="text-[#777]">血量</span>
            <span className={cn(
              "font-mono font-bold",
              isLowHealth ? "text-[#ff5555]" : "text-[#ddd]"
            )}>
              {player.health ?? 0}<span className="text-[#666]">/</span>{player.maxHealth ?? 3}
            </span>
          </div>

          {/* 行动点 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#777]">行动</span>
            <span className="text-[#d4a853] font-mono font-bold">{player.actionPoints ?? 0}</span>
          </div>

          {/* 分数 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#777]">分数</span>
            <span className="text-[#d4a853] font-mono font-bold">{player.score ?? 0}</span>
          </div>

          {/* 道具 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#777]">道具</span>
            <span className="text-[#4ade80] font-mono font-bold">{player.items?.length ?? 0}</span>
          </div>
        </div>

        {/* 死亡遮罩 */}
        {!player.isAlive && (
          <div className="absolute inset-0 bg-[#000]/70 flex items-center justify-center backdrop-blur-sm">
            <span className="text-[#aaa] text-xs font-bold tracking-widest border-2 border-[#666] px-3 py-1.5 rounded bg-[#1a1a1a]/90">
              已出局
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerStatusCards;