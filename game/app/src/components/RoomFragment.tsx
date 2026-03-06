import React from 'react';
import type { RoomFragmentData } from '@/data/roomFragments';

type RoomState = 'normal' | 'visited' | 'burning';

interface RoomFragmentProps {
  room: RoomFragmentData;
  state: RoomState;
  isCurrentLocation: boolean;
  isAvailable: boolean;
  // 保留参数但标记为可选，保持接口兼容性
  playerCount?: number;
  maxPlayers?: number;
  onClick: () => void;
}

export const RoomFragment: React.FC<RoomFragmentProps> = ({
  room,
  state,
  isCurrentLocation,
  isAvailable,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  playerCount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  maxPlayers,
  onClick
}) => {
  // 根据状态获取样式
  const getStateStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      left: room.position.left,
      top: room.position.top,
      width: room.position.width,
      height: room.position.height,
      transform: undefined,
      cursor: isAvailable || isCurrentLocation ? 'pointer' : 'not-allowed',
      clipPath: room.clipPath,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'auto',
    };

    // 只保留 visited 状态样式
    if (state === 'visited') {
      return {
        ...base,
        backgroundColor: 'rgba(76, 175, 80, 0.6)',
        border: '2px solid rgba(76, 175, 80, 0.6)',
        boxShadow: '0 0 20px rgba(76, 175, 80, 0.3), inset 0 0 30px rgba(76, 175, 80, 0.1)',
      };
    }

    // 燃烧状态只保留燃烧效果层，不添加特殊边框样式
    if (state === 'burning') {
      return {
        ...base,
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
      };
    }

    // 默认状态（normal）
    return {
      ...base,
      backgroundColor: 'transparent',
      border: 'none',
      boxShadow: 'none',
    };
  };

  return (
    <div
      className="room-fragment"
      style={getStateStyles()}
      onClick={onClick}
      title={room.name}
    >
      {/* 删除：房间内容层（包含人数标识、案发现场标识等） */}

      {/* 燃烧效果层 - 保留 */}
      {state === 'burning' && (
        <div className="fire-effect" style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(255,100,50,0.3) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* 删除：当前位置指示器（黄色"我"标识） */}
    </div>
  );
};