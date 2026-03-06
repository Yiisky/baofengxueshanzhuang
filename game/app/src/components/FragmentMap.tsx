// src/components/FragmentMap.tsx
import React, { useMemo } from 'react';
import { RoomFragment } from './RoomFragment';
import { roomFragments } from '@/data/roomFragments';
import type { Player } from '@/types/game';

interface FragmentMapProps {
  currentPlayer: Player;
  players: Player[];
  fireLocations: string[];
  onRoomClick: (roomId: string) => void;
}

export const FragmentMap: React.FC<FragmentMapProps> = ({
  currentPlayer,
  players,
  fireLocations,
  onRoomClick
}) => {
  // 计算每个房间的状态
  const roomStates = useMemo(() => {
    const states = new Map<string, {
      state: 'normal' | 'visited' | 'burning';
      playerCount: number;
      isCurrent: boolean;
      isAvailable: boolean;
    }>();

    roomFragments.forEach(room => {
      const isVisited = currentPlayer.visitedLocations?.includes(room.id) || false;
      const isBurning = fireLocations.includes(room.id) || room.isBurning || false;
      const isCurrent = currentPlayer.currentLocation === room.id;
      
      // 计算可移动性（相邻且未锁定的房间）
      const currentRoomId = currentPlayer.currentLocation;
      const currentRoom = roomFragments.find(r => r.id === currentRoomId);
      const isConnected = currentRoom?.connections.includes(room.id) || false;
      // 修复：第一轮没有位置时，所有房间都可用（用于选择初始位置）
      const isAvailable = !currentRoomId || isCurrent || isConnected;

      // 计算人数
      const playerCount = players.filter(p => p.currentLocation === room.id && p.isAlive).length;

      // 确定状态 - 删除 visited-burning，优先显示燃烧效果
      let state: 'normal' | 'visited' | 'burning' = 'normal';
      if (isBurning) state = 'burning';
      else if (isVisited) state = 'visited';

      states.set(room.id, { state, playerCount, isCurrent, isAvailable });
    });

    return states;
  }, [currentPlayer, players, fireLocations]);

  return (
    <div className="fragment-map-container" style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'auto',
    }}>
      {/* 房间层 */}
      {roomFragments.map(room => {
        const state = roomStates.get(room.id)!;
        return (
          <RoomFragment
            key={room.id}
            room={room}
            state={state.state}
            isCurrentLocation={state.isCurrent}
            isAvailable={state.isAvailable}
            playerCount={state.playerCount}
            maxPlayers={room.maxPlayers || 4}
            onClick={() => onRoomClick(room.id)}
          />
        );
      })}

      {/* 删除：连接线层（相邻房间虚线） */}
    </div>
  );
};

// 同时提供默认导出，保持兼容性
export default FragmentMap;