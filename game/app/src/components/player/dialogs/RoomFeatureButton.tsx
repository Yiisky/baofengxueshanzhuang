//房间功能按钮组件
// src/components/player/RoomFeatureButton.tsx
import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { Player } from '@/types/game';
import { useWebSocketStore } from '@/store/websocketStore';
import { getRoomFeature, canAcquireItem, getItemName } from '@/data/roomFeatures';
import { ConfirmDialog } from '@/components/player';

interface RoomFeatureButtonProps {
  currentPlayer: Player;
  showAlert: (title: string, message: React.ReactNode, type: 'info' | 'warning' | 'error') => void;
}

export const RoomFeatureButton: React.FC<RoomFeatureButtonProps> = ({ 
  currentPlayer, 
  showAlert 
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    type: 'info' | 'warning';
  } | null>(null);

  const { sendMessage } = useWebSocketStore();

  const currentRoomId = currentPlayer.currentLocation;
  const feature = currentRoomId ? getRoomFeature(currentRoomId) : undefined;

  // 检查是否显示按钮
  const shouldShowButton = () => {
    if (!feature) return false;
    return true; // 始终显示，点击时检查行动点
  };

  const handleFeatureClick = () => {
    if (!feature) return;

    // 检查是否有足够行动点使用房间功能
    if (currentPlayer.actionPoints < feature.cost) {
      showAlert(
        '行动点不足',
        `使用${feature.roomName}功能需要${feature.cost}点行动点，你当前只有${currentPlayer.actionPoints}点`,
        'warning'
      );
      return;
    }

    // 检查道具获取限制（已有该道具则不能重复获取）
    if (feature.itemReward) {
      const check = canAcquireItem(currentRoomId!, currentPlayer.items || []);
      if (!check.canAcquire) {
        showAlert('无法获取', check.reason, 'warning');
        return;
      }
    }

    // 显示确认对话框
    const isViewScore = feature.action === 'view_score';
    setConfirmConfig({
      title: isViewScore ? '查看分数' : `获取${getItemName(feature.itemReward!)}`,
      message: (
        <div className="space-y-2">
          <p>{feature.description}</p>
          <p className="text-[#aaaaaa] text-sm">
            消耗行动点：<span className="text-[#d4a853]">{feature.cost}</span>
          </p>
          {feature.itemReward && (
            <p className="text-[#4CAF50] text-sm">
              获得道具后不可重复获取
            </p>
          )}
        </div>
      ),
      onConfirm: executeFeature,
      type: 'info'
    });
    setShowConfirm(true);
  };

  const executeFeature = () => {
    if (!feature) return;

    // 发送 ROOM_FEATURE 动作
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'ROOM_FEATURE',
      roomId: feature.roomId,
      featureAction: feature.action,
      itemReward: feature.itemReward,
      cost: feature.cost,
      playerId: currentPlayer.id
    });

    setShowConfirm(false);
    
    showAlert(
      '请求已发送',
      '正在处理...',
      'info'
    );
  };

  if (!shouldShowButton()) return null;

  const isViewScore = feature?.action === 'view_score';
  const buttonText = isViewScore ? '查看分数' : '地点功能';

  return (
    <>
      <button
        onClick={handleFeatureClick}
        disabled={currentPlayer.actionPoints === 0}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-all ${
          currentPlayer.actionPoints === 0
            ? 'bg-[#1a1a1a] border-[#444] text-[#666] cursor-not-allowed'
            : 'bg-[#2a2a2a] border-[#d4a853] text-[#d4a853] hover:bg-[#d4a853] hover:text-[#0a0a0a] active:scale-95'
        }`}
      >
        <MapPin className="w-4 h-4" />
        {buttonText}
      </button>

      {confirmConfig && (
        <ConfirmDialog
          isOpen={showConfirm}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmText="确认"
          cancelText="取消"
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setShowConfirm(false)}
          type={confirmConfig.type}
        />
      )}
    </>
  );
};

export default RoomFeatureButton;