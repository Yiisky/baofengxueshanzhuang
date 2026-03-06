// src/utils/adminCommands.ts
/**
 * 主持人管理命令模块
 * 提供主持人管理玩家状态的功能
 */

import type { Player, ItemType } from '@/types/game';

// ====================== 类型定义 ======================

/** 管理员命令类型 */
export type AdminCommandType = 
  | 'ADD_HEALTH'
  | 'REMOVE_HEALTH'
  | 'ADD_ACTION_POINTS'
  | 'REMOVE_ACTION_POINTS'
  | 'ADD_ITEM'
  | 'REMOVE_ITEM';

/** 管理员命令接口 */
export interface AdminCommand {
  type: AdminCommandType;
  targetPlayerId: string;
  value?: number;
  itemType?: ItemType;
  reason?: string;
}

/** 命令执行结果 */
export interface CommandResult {
  success: boolean;
  message: string;
  oldValue?: any;
  newValue?: any;
}

/** WebSocket 消息结构 */
export interface AdminCommandMessage {
  type: 'ADMIN_COMMAND';
  command: AdminCommand;
  hostPlayerId: string;
  timestamp: number;
}

// ====================== WebSocket 消息发送 ======================

/**
 * 构建管理员命令消息
 */
export function buildAdminCommandMessage(
  command: AdminCommand,
  hostPlayerId: string
): AdminCommandMessage {
  return {
    type: 'ADMIN_COMMAND',
    command: command,
    hostPlayerId: hostPlayerId,
    timestamp: Date.now()
  };
}