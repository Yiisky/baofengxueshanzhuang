//管理hook

// src/hooks/useItems.ts
import { useCallback } from 'react';
import { useWebSocketStore } from '@/store/websocketStore';
import type { ItemType, Player } from '@/types/game';
import { itemDetails } from '@/data/roomFeatures';

export interface UseItemsReturn {
  hasItem: (item: ItemType) => boolean;
  getItemDetail: (item: ItemType) => typeof itemDetails[0];
  useItem: (item: ItemType, targetId?: string) => void;
  getAllItemsStatus: () => Array<{
    id: ItemType;
    owned: boolean;
    usable: boolean;  // 是否可以使用（有行动点且是可消耗道具）
    detail: typeof itemDetails[0];
  }>;
}

export function useItems(player: Player): UseItemsReturn {
  const { sendMessage } = useWebSocketStore();

  const hasItem = useCallback((item: ItemType): boolean => {
    return player.items?.includes(item) ?? false;
  }, [player.items]);

  const getItemDetail = useCallback((item: ItemType) => {
    return itemDetails.find(d => d.id === item)!;
  }, []);

  const useItem = useCallback((item: ItemType, targetId?: string) => {
    const detail = getItemDetail(item);
    
    // 检查是否是被动道具
    if (!detail.consumable) {
      console.log(`[useItems] ${item} 是被动道具，无需使用`);
      return;
    }

    // 检查是否有足够行动点
    if (player.actionPoints < detail.useCost) {
      console.log(`[useItems] 行动点不足，需要 ${detail.useCost} 点`);
      return;
    }

    console.log(`[useItems] 使用道具: ${item}, 目标: ${targetId || '无'}, 消耗行动点: ${detail.useCost}`);
    
    // 发送 USE_ITEM 动作
    sendMessage({
      type: 'PLAYER_ACTION',
      action: 'USE_ITEM',
      item: item,
      target: targetId,
      playerId: player.id
    });
  }, [player.id, player.actionPoints, sendMessage, getItemDetail]);

  const getAllItemsStatus = useCallback(() => {
    return itemDetails.map(detail => ({
      id: detail.id,
      owned: hasItem(detail.id),
      usable: hasItem(detail.id) && detail.consumable && player.actionPoints >= detail.useCost,
      detail
    }));
  }, [hasItem, player.actionPoints]);

  return {
    hasItem,
    getItemDetail,
    useItem,
    getAllItemsStatus
  };
}